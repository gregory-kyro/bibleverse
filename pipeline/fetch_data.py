"""
Download and normalize the KJV Bible from a public-domain GitHub source.
Produces a flat list of verse records with book metadata attached.
"""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from .config import BOOKS, KJV_SOURCE_BASE, RAW_DATA_FILE, VERSES_FILE

def _book_filename(name: str) -> str:
    """aruljohn/Bible-kjv strips all spaces from filenames."""
    return name.replace(" ", "") + ".json"


def fetch_kjv(data_dir: Path) -> list[dict]:
    """Download all 66 books from the aruljohn/Bible-kjv repository."""
    data_dir.mkdir(parents=True, exist_ok=True)
    raw_path = data_dir / RAW_DATA_FILE

    if raw_path.exists():
        print(f"  [skip] Raw data already exists at {raw_path}")
        with open(raw_path) as f:
            return json.load(f)

    all_verses = []
    for book in BOOKS:
        fname = _book_filename(book["name"])
        url = f"{KJV_SOURCE_BASE}/{fname}"
        print(f"  Fetching {book['name']}...")
        try:
            with urllib.request.urlopen(url) as resp:
                book_data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"    [error] Failed to fetch {url}: {e}")
            continue

        chapters = book_data.get("chapters", [])
        for chapter_obj in chapters:
            ch_num = int(chapter_obj["chapter"])
            for verse in chapter_obj.get("verses", []):
                all_verses.append({
                    "book": book["name"],
                    "book_abbrev": book["abbrev"],
                    "book_num": book["num"],
                    "chapter": ch_num,
                    "verse": int(verse["verse"]),
                    "text": verse.get("text", "").strip(),
                    "testament": book["testament"],
                    "genre": book["genre"],
                })

    with open(raw_path, "w") as f:
        json.dump(all_verses, f)
    print(f"  Saved {len(all_verses)} verses to {raw_path}")
    return all_verses


def normalize(verses: list[dict], data_dir: Path) -> list[dict]:
    """Clean text, add reference strings, assign sequential IDs."""
    for i, v in enumerate(verses):
        v["id"] = i
        v["ref"] = f"{v['book']} {v['chapter']}:{v['verse']}"
        v["text"] = re.sub(r"\s+", " ", v["text"]).strip()

    out_path = data_dir / VERSES_FILE
    with open(out_path, "w") as f:
        json.dump(verses, f)
    print(f"  Normalized {len(verses)} verses → {out_path}")
    return verses


def run(data_dir: Path) -> list[dict]:
    print("[1/5] Fetching KJV data...")
    verses = fetch_kjv(data_dir)
    verses = normalize(verses, data_dir)
    return verses
