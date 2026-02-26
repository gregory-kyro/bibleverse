"""
Compute information-theoretic and lexical metrics per book:
  - Shannon entropy (token distribution)
  - Compression ratio (gzip)
  - Lexical diversity (type-token ratio, hapax ratio)
  - Mean word/sentence length
  - Hapax legomena (words appearing exactly once in the entire Bible)
"""

import gzip
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

from .config import BOOKS, METRICS_FILE, HAPAX_FILE, GENRE_COLORS


def _tokenize(text: str) -> list[str]:
    return re.findall(r'[a-zA-Z]+', text.lower())


def _shannon_entropy(tokens: list[str]) -> float:
    counts = Counter(tokens)
    total = len(tokens)
    if total == 0:
        return 0.0
    return -sum(
        (c / total) * math.log2(c / total)
        for c in counts.values()
    )


def _compression_ratio(text: str) -> float:
    raw = text.encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=9)
    return len(compressed) / len(raw) if len(raw) > 0 else 1.0


def _compute_book_metrics(verses: list[dict]) -> list[dict]:
    book_texts = defaultdict(list)
    book_tokens = defaultdict(list)
    for v in verses:
        book_texts[v["book"]].append(v["text"])
        book_tokens[v["book"]].extend(_tokenize(v["text"]))

    metrics = []
    for book_meta in BOOKS:
        name = book_meta["name"]
        tokens = book_tokens.get(name, [])
        full_text = " ".join(book_texts.get(name, []))
        types = set(tokens)
        n_tokens = len(tokens)
        n_types = len(types)

        sentences = re.split(r'[.!?;:]', full_text)
        sentences = [s.strip() for s in sentences if s.strip()]

        hapax_in_book = sum(1 for w, c in Counter(tokens).items() if c == 1)

        metrics.append({
            "book": name,
            "abbrev": book_meta["abbrev"],
            "book_num": book_meta["num"],
            "testament": book_meta["testament"],
            "genre": book_meta["genre"],
            "genre_color": GENRE_COLORS[book_meta["genre"]],
            "n_verses": len(book_texts.get(name, [])),
            "n_tokens": n_tokens,
            "n_types": n_types,
            "shannon_entropy": round(_shannon_entropy(tokens), 4),
            "compression_ratio": round(_compression_ratio(full_text), 4),
            "type_token_ratio": round(n_types / n_tokens, 4) if n_tokens > 0 else 0,
            "hapax_ratio": round(hapax_in_book / n_types, 4) if n_types > 0 else 0,
            "mean_word_length": round(
                sum(len(t) for t in tokens) / n_tokens, 2
            ) if n_tokens else 0,
            "mean_sentence_length": round(
                n_tokens / len(sentences), 2
            ) if sentences else 0,
        })
    return metrics


def _compute_hapax_legomena(verses: list[dict]) -> list[dict]:
    """Find words appearing exactly once in the entire Bible."""
    global_counts = Counter()
    word_locations = {}

    for v in verses:
        tokens = _tokenize(v["text"])
        for tok in set(tokens):
            global_counts[tok] += 1
            word_locations[tok] = v["id"]

    hapax = []
    for word, count in global_counts.items():
        if count == 1 and len(word) > 3:
            vid = word_locations[word]
            verse = verses[vid]
            hapax.append({
                "word": word,
                "verse_id": vid,
                "ref": verse["ref"],
                "book": verse["book"],
                "genre": verse["genre"],
            })

    hapax.sort(key=lambda h: h["verse_id"])
    return hapax


def _genre_aggregates(book_metrics: list[dict]) -> list[dict]:
    genre_data = defaultdict(list)
    for m in book_metrics:
        genre_data[m["genre"]].append(m)

    aggregates = []
    for genre in GENRE_COLORS:
        books = genre_data.get(genre, [])
        if not books:
            continue
        n = len(books)
        aggregates.append({
            "genre": genre,
            "color": GENRE_COLORS[genre],
            "n_books": n,
            "mean_entropy": round(sum(b["shannon_entropy"] for b in books) / n, 4),
            "mean_compression": round(sum(b["compression_ratio"] for b in books) / n, 4),
            "mean_ttr": round(sum(b["type_token_ratio"] for b in books) / n, 4),
            "mean_hapax_ratio": round(sum(b["hapax_ratio"] for b in books) / n, 4),
            "mean_word_length": round(sum(b["mean_word_length"] for b in books) / n, 2),
            "mean_sentence_length": round(sum(b["mean_sentence_length"] for b in books) / n, 2),
            "total_tokens": sum(b["n_tokens"] for b in books),
        })
    return aggregates


def run(verses: list[dict], data_dir: Path):
    print("[4/5] Computing information-theoretic metrics...")
    book_metrics = _compute_book_metrics(verses)
    genre_aggs = _genre_aggregates(book_metrics)

    result = {
        "books": book_metrics,
        "genres": genre_aggs,
        "genre_colors": GENRE_COLORS,
    }

    out_path = data_dir / METRICS_FILE
    with open(out_path, "w") as f:
        json.dump(result, f)
    print(f"  Metrics → {out_path}")

    print("  Computing hapax legomena...")
    hapax = _compute_hapax_legomena(verses)
    hapax_path = data_dir / HAPAX_FILE
    with open(hapax_path, "w") as f:
        json.dump(hapax, f)
    print(f"  Found {len(hapax)} hapax legomena → {hapax_path}")
