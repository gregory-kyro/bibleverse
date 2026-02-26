"""
Extract biblical entities (people, places, groups) from verse text using
curated dictionaries, build a co-occurrence graph, and extract top TF-IDF
concept keywords per book.
"""

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

from .config import (
    PEOPLE, PLACES, GROUPS, ENTITY_ALIASES,
    GRAPH_FILE, BOOKS, BOOK_NAME_TO_META,
)


def _find_entities_in_text(text: str, entity_list: list[str]) -> list[str]:
    """Return all entities from entity_list that appear in text."""
    found = []
    for entity in entity_list:
        pattern = r'\b' + re.escape(entity) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            canonical = ENTITY_ALIASES.get(entity, entity)
            found.append(canonical)
    return found


def _extract_all(verses: list[dict]) -> dict:
    """
    For each verse, extract entities.  Return:
      - verse_entities: list of (verse_id, entity, entity_type) tuples
      - per-chapter co-occurrence edges
    """
    verse_entities = []
    chapter_entities = defaultdict(lambda: defaultdict(set))

    for v in verses:
        text = v["text"]
        vid = v["id"]
        chapter_key = (v["book"], v["chapter"])

        for ent in _find_entities_in_text(text, PEOPLE):
            verse_entities.append((vid, ent, "person"))
            chapter_entities[chapter_key]["person"].add(ent)

        for ent in _find_entities_in_text(text, PLACES):
            verse_entities.append((vid, ent, "place"))
            chapter_entities[chapter_key]["place"].add(ent)

        for ent in _find_entities_in_text(text, GROUPS):
            verse_entities.append((vid, ent, "group"))
            chapter_entities[chapter_key]["group"].add(ent)

    return verse_entities, chapter_entities


def _build_cooccurrence(chapter_entities: dict) -> dict:
    """Build undirected weighted co-occurrence graph from chapter-level presence."""
    edge_counts = Counter()
    for _chap_key, type_ents in chapter_entities.items():
        all_ents = set()
        for ent_set in type_ents.values():
            all_ents.update(ent_set)
        ents_sorted = sorted(all_ents)
        for i in range(len(ents_sorted)):
            for j in range(i + 1, len(ents_sorted)):
                edge_counts[(ents_sorted[i], ents_sorted[j])] += 1
    return edge_counts


def _compute_tfidf_concepts(verses: list[dict], top_n: int = 15) -> dict:
    """
    Compute TF-IDF per book and return top concept keywords.
    Excludes common stop words and very short tokens.
    """
    stop = {
        "the", "and", "of", "to", "in", "a", "that", "is", "was", "for",
        "it", "with", "he", "his", "as", "be", "on", "not", "but", "they",
        "are", "at", "this", "have", "from", "or", "an", "by", "which",
        "their", "had", "she", "her", "were", "been", "has", "its", "who",
        "did", "do", "will", "would", "there", "them", "than", "so", "if",
        "my", "me", "him", "our", "no", "we", "you", "your", "thee", "thou",
        "thy", "shall", "unto", "upon", "hath", "ye", "also", "said", "one",
        "all", "when", "then", "out", "up", "came", "come", "went", "into",
        "us", "am", "may", "i", "now", "man", "let", "even", "every",
        "before", "after", "through", "made", "put", "say", "set", "own",
        "more", "great", "hand", "day", "because", "over", "how", "what",
        "about", "being", "make", "like", "might", "could", "again", "know",
        "these", "those", "other", "some", "can", "only", "any", "away",
        "thing", "things", "go", "give", "take", "way", "many", "much",
        "down", "get", "here", "just", "still", "new", "old", "first",
        "last", "two", "three", "her", "herself", "himself", "itself",
        "themselves", "should", "while", "where", "why", "each", "both",
        "between", "above", "below", "under", "such",
        "saith", "thus", "therefore", "thereof", "wherefore", "hast",
        "doth", "shalt", "among", "wherein", "whose", "whom",
    }

    book_docs = defaultdict(list)
    for v in verses:
        tokens = re.findall(r'[a-z]+', v["text"].lower())
        tokens = [t for t in tokens if len(t) > 3 and t not in stop]
        book_docs[v["book"]].extend(tokens)

    tf = {}
    for book, tokens in book_docs.items():
        counts = Counter(tokens)
        total = sum(counts.values())
        tf[book] = {w: c / total for w, c in counts.items()}

    n_docs = len(book_docs)
    df = Counter()
    for book, tokens in book_docs.items():
        df.update(set(tokens))

    idf = {w: math.log(n_docs / (1 + df[w])) for w in df}

    concepts = {}
    for book in book_docs:
        scores = {w: tf[book].get(w, 0) * idf.get(w, 0) for w in tf[book]}
        top = sorted(scores.items(), key=lambda x: -x[1])[:top_n]
        concepts[book] = [{"word": w, "score": round(s, 5)} for w, s in top]

    return concepts


def _build_graph_json(
    verse_entities: list,
    edge_counts: dict,
    concepts: dict,
    verses: list[dict],
    min_edge_weight: int = 2,
) -> dict:
    """Assemble the graph JSON for the frontend D3 visualization."""
    entity_freq = Counter()
    entity_type = {}
    entity_books = defaultdict(set)

    for vid, ent, etype in verse_entities:
        entity_freq[ent] += 1
        entity_type[ent] = etype
        entity_books[ent].add(verses[vid]["book"])

    # Only include entities that appear at least 3 times
    significant = {e for e, c in entity_freq.items() if c >= 3}

    nodes = []
    node_ids = set()
    for ent in significant:
        nodes.append({
            "id": ent,
            "type": entity_type[ent],
            "count": entity_freq[ent],
            "books": sorted(entity_books[ent]),
        })
        node_ids.add(ent)

    # Add concept nodes (top 5 per book, deduplicated)
    concept_freq = Counter()
    concept_books = defaultdict(set)
    for book, kws in concepts.items():
        for kw in kws[:5]:
            w = kw["word"]
            concept_freq[w] += 1
            concept_books[w].add(book)
    for word, freq in concept_freq.items():
        if word not in node_ids and freq >= 2:
            nodes.append({
                "id": word,
                "type": "concept",
                "count": freq,
                "books": sorted(concept_books[word]),
            })
            node_ids.add(word)

    edges = []
    for (a, b), weight in edge_counts.items():
        if weight >= min_edge_weight and a in node_ids and b in node_ids:
            edges.append({"source": a, "target": b, "weight": weight})

    return {"nodes": nodes, "edges": edges, "concepts_by_book": concepts}


def run(verses: list[dict], data_dir: Path):
    print("[3/5] Extracting entities and building graph...")
    verse_entities, chapter_entities = _extract_all(verses)
    print(f"  Found {len(verse_entities)} entity mentions")

    edge_counts = _build_cooccurrence(chapter_entities)
    print(f"  Built {len(edge_counts)} co-occurrence edges")

    concepts = _compute_tfidf_concepts(verses)
    graph = _build_graph_json(verse_entities, edge_counts, concepts, verses)
    print(f"  Graph: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")

    out_path = data_dir / GRAPH_FILE
    with open(out_path, "w") as f:
        json.dump(graph, f)
    print(f"  Graph → {out_path}")
