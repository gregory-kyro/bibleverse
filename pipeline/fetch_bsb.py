"""
Fetch and merge the Berean Standard Bible (BSB) translation alongside KJV.
Produces a lookup keyed by (book_name, chapter, verse) → BSB text.
"""

import json
from pathlib import Path

BSB_FILE = "bsb.json"
BSB_LOOKUP_FILE = "bsb_lookup.json"

# Map BSB book names to our canonical names (pipeline/config.py)
_BSB_BOOK_ALIASES = {
    "Psalm": "Psalms",
    "Song of Songs": "Song of Solomon",
    "Revelation of John": "Revelation",
    "I Samuel": "1 Samuel",
    "II Samuel": "2 Samuel",
    "I Kings": "1 Kings",
    "II Kings": "2 Kings",
    "I Chronicles": "1 Chronicles",
    "II Chronicles": "2 Chronicles",
    "I Corinthians": "1 Corinthians",
    "II Corinthians": "2 Corinthians",
    "I Thessalonians": "1 Thessalonians",
    "II Thessalonians": "2 Thessalonians",
    "I Timothy": "1 Timothy",
    "II Timothy": "2 Timothy",
    "I Peter": "1 Peter",
    "II Peter": "2 Peter",
    "I John": "1 John",
    "II John": "2 John",
    "III John": "3 John",
    "Sirach": None,
    "Tobit": None,
    "Judith": None,
    "Wisdom": None,
    "Baruch": None,
    "1 Maccabees": None,
    "2 Maccabees": None,
    "Letter of Jeremiah": None,
    "Prayer of Azariah": None,
    "Susanna": None,
    "Bel and the Dragon": None,
    "1 Esdras": None,
    "2 Esdras": None,
    "Prayer of Manasseh": None,
}


def run(verses: list[dict], data_dir: Path):
    print("[bsb] Merging Berean Standard Bible translation...")

    bsb_path = data_dir / BSB_FILE
    if not bsb_path.exists():
        raise FileNotFoundError(
            f"{bsb_path} not found. Download from "
            "https://raw.githubusercontent.com/scrollmapper/bible_databases/"
            "master/sources/en/BSB/BSB.json"
        )

    with open(bsb_path, encoding="utf-8") as f:
        bsb_data = json.load(f)

    # Build BSB lookup: (book_name, chapter, verse) → text
    bsb_lookup = {}
    for book in bsb_data["books"]:
        book_name = book["name"]
        if book_name in _BSB_BOOK_ALIASES:
            book_name = _BSB_BOOK_ALIASES[book_name]
            if book_name is None:
                continue
        for chapter in book["chapters"]:
            ch_num = chapter["chapter"]
            for v in chapter["verses"]:
                key = f"{book_name}|{ch_num}|{v['verse']}"
                bsb_lookup[key] = v["text"].strip()

    # Match against our KJV verses
    matched = 0
    for verse in verses:
        key = f"{verse['book']}|{verse['chapter']}|{verse['verse']}"
        bsb_text = bsb_lookup.get(key)
        if bsb_text:
            verse["text_bsb"] = bsb_text
            matched += 1
        else:
            verse["text_bsb"] = ""

    print(f"  {len(bsb_lookup)} BSB verses loaded")
    print(f"  {matched} / {len(verses)} KJV verses matched ({100*matched/len(verses):.1f}%)")

    out_path = data_dir / BSB_LOOKUP_FILE
    with open(out_path, "w") as f:
        json.dump(bsb_lookup, f)
    print(f"  → {out_path}")

    verses_path = data_dir / "verses.json"
    with open(verses_path, "w") as f:
        json.dump(verses, f)
    print(f"  → {verses_path} (updated with BSB text)")

    return verses
