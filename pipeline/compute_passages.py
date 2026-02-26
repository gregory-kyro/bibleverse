"""
Build passage (pericope) records for passage-level semantic search.

Uses the ~5,300 pericope boundaries from biblestudystart.com (via sil-ai/pericopes)
and computes each passage's embedding as the L2-normalised mean of its verse embeddings.
Exports a JSON manifest and a uint8 binary identical in format to the verse search data.
"""

import csv
import json
import urllib.request
import numpy as np
from pathlib import Path

PERICOPE_URL = (
    "https://raw.githubusercontent.com/sil-ai/pericopes/main/pericopes.csv"
)

PASSAGES_JSON = "passages.json"
PASSAGE_EMB_FILE = "passage_embeddings.bin"
PASSAGE_META_FILE = "passage_meta.json"

# Map from the pericope CSV's 3-letter codes to our book names (config.py)
_PERI_CODE_TO_BOOK = {
    "GEN": "Genesis", "EXO": "Exodus", "LEV": "Leviticus", "NUM": "Numbers",
    "DEU": "Deuteronomy", "JOS": "Joshua", "JDG": "Judges", "RUT": "Ruth",
    "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Kings", "2KI": "2 Kings",
    "1CH": "1 Chronicles", "2CH": "2 Chronicles", "EZR": "Ezra", "NEH": "Nehemiah",
    "EST": "Esther", "JOB": "Job", "PSA": "Psalms", "PRO": "Proverbs",
    "ECC": "Ecclesiastes", "SNG": "Song of Solomon", "ISA": "Isaiah",
    "JER": "Jeremiah", "LAM": "Lamentations", "EZK": "Ezekiel", "DAN": "Daniel",
    "HOS": "Hosea", "JOL": "Joel", "AMO": "Amos", "OBA": "Obadiah",
    "JON": "Jonah", "MIC": "Micah", "NAM": "Nahum", "HAB": "Habakkuk",
    "ZEP": "Zephaniah", "HAG": "Haggai", "ZEC": "Zechariah", "MAL": "Malachi",
    "MAT": "Matthew", "MRK": "Mark", "LUK": "Luke", "JHN": "John",
    "ACT": "Acts", "ROM": "Romans", "1CO": "1 Corinthians", "2CO": "2 Corinthians",
    "GAL": "Galatians", "EPH": "Ephesians", "PHP": "Philippians", "COL": "Colossians",
    "1TH": "1 Thessalonians", "2TH": "2 Thessalonians", "1TI": "1 Timothy",
    "2TI": "2 Timothy", "TIT": "Titus", "PHM": "Philemon", "HEB": "Hebrews",
    "JAS": "James", "1PE": "1 Peter", "2PE": "2 Peter", "1JN": "1 John",
    "2JN": "2 John", "3JN": "3 John", "JUD": "Jude", "REV": "Revelation",
}


def _fetch_pericopes(data_dir: Path) -> list[dict]:
    """Download and cache the pericope CSV."""
    cache = data_dir / "pericopes_raw.csv"
    if not cache.exists():
        print("  Downloading pericope data...")
        urllib.request.urlretrieve(PERICOPE_URL, cache)
    rows = []
    with open(cache, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    return rows


def run(verses: list[dict], data_dir: Path):
    print("[passages] Building passage records from pericope boundaries...")

    raw = _fetch_pericopes(data_dir)
    print(f"  {len(raw)} pericope rows loaded")

    emb_path = data_dir / "embeddings.npy"
    if not emb_path.exists():
        raise FileNotFoundError("embeddings.npy not found; run step 2 first")
    all_emb = np.load(emb_path).astype(np.float32)

    # Build a lookup: (book_name, chapter, verse) → verse index
    verse_idx = {}
    for i, v in enumerate(verses):
        verse_idx[(v["book"], v["chapter"], v["verse"])] = i

    from pipeline.config import BOOK_NAME_TO_META

    passages = []
    passage_embeddings = []
    skipped = 0

    for r in raw:
        code = r["Book"]
        book_name = _PERI_CODE_TO_BOOK.get(code)
        if not book_name:
            skipped += 1
            continue
        ch = int(r["Chapter"])
        sv = int(r["Start Verse"])
        ev = int(r["End Verse"])
        summary = r["Summary"].strip().rstrip(";").strip()

        # Collect verse indices for this passage
        v_indices = []
        for vn in range(sv, ev + 1):
            idx = verse_idx.get((book_name, ch, vn))
            if idx is not None:
                v_indices.append(idx)

        if not v_indices:
            skipped += 1
            continue

        meta = BOOK_NAME_TO_META.get(book_name, {})
        ref_start = f"{book_name} {ch}:{sv}"
        ref_end = f"{ch}:{ev}" if ev != sv else ""
        ref = f"{ref_start}–{ref_end}" if ref_end else ref_start

        # Mean embedding for the passage
        emb = all_emb[v_indices].mean(axis=0)

        verse_texts = [verses[i]["text"] for i in v_indices]
        bsb_texts = [verses[i].get("text_bsb", "") for i in v_indices]

        rec = {
            "id": len(passages),
            "title": summary,
            "ref": ref,
            "book": book_name,
            "book_num": meta.get("num", 0),
            "testament": meta.get("testament", ""),
            "chapter": ch,
            "start_verse": sv,
            "end_verse": ev,
            "verse_ids": v_indices,
            "n_verses": len(v_indices),
            "text": " ".join(verse_texts),
        }
        bsb_joined = " ".join(t for t in bsb_texts if t)
        if bsb_joined:
            rec["text_bsb"] = bsb_joined
        passages.append(rec)
        passage_embeddings.append(emb)

    print(f"  {len(passages)} passages built, {skipped} skipped")

    # Save passage manifest
    with open(data_dir / PASSAGES_JSON, "w") as f:
        json.dump(passages, f)
    print(f"  → {data_dir / PASSAGES_JSON}")

    # L2-normalise and quantise to uint8 (same scheme as verse search)
    emb_arr = np.array(passage_embeddings, dtype=np.float32)
    norms = np.linalg.norm(emb_arr, axis=1, keepdims=True)
    emb_arr = emb_arr / np.clip(norms, 1e-8, None)

    emb_uint8 = ((emb_arr + 1.0) * 127.5).clip(0, 255).astype(np.uint8)
    emb_uint8.tofile(data_dir / PASSAGE_EMB_FILE)

    meta_out = {
        "n_passages": len(passages),
        "dim": int(emb_arr.shape[1]),
        "dtype": "uint8",
        "model": "odunola/sentence-transformers-bible-reference-final",
        "note": "Mean of verse embeddings, L2-normalised, affine-quantised [-1,1]→[0,255]",
    }
    with open(data_dir / PASSAGE_META_FILE, "w") as f:
        json.dump(meta_out, f)

    size_mb = (data_dir / PASSAGE_EMB_FILE).stat().st_size / 1e6
    print(f"  {emb_arr.shape} → {data_dir / PASSAGE_EMB_FILE} ({size_mb:.1f} MB)")
