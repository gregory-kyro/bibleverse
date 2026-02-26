#!/usr/bin/env python3
"""
Master pipeline for The Bible, Mapped.
Downloads KJV text, computes embeddings, extracts entities,
calculates metrics, builds the homepage sphere, and stages JSON.

Usage:
    python run_pipeline.py            # full pipeline
    python run_pipeline.py --step 2   # run only step N (1-6)
"""

import argparse
import json
import shutil
from pathlib import Path

from pipeline import (
    fetch_data, compute_embeddings, extract_entities,
    compute_metrics, compute_sphere, compute_search, compute_passages,
    fetch_bsb,
)
from pipeline.config import VERSES_FILE


DATA_DIR = Path("data")
SITE_DATA_DIR = Path("site") / "data"


def stage_for_site(data_dir: Path, site_dir: Path):
    """Copy final JSON artifacts into site/data/ for the frontend."""
    print("[6/6] Staging data for site...")
    site_dir.mkdir(parents=True, exist_ok=True)

    artifacts = [
        "verses.json",
        "umap_coords.json",
        "neighbors.json",
        "graph.json",
        "metrics.json",
        "heatmap.json",
        "hapax.json",
        "sphere.json",
        "search_embeddings.bin",
        "search_meta.json",
        "passages.json",
        "passage_embeddings.bin",
        "passage_meta.json",
        "bsb_verses.json",
    ]

    for name in artifacts:
        src = data_dir / name
        dst = site_dir / name
        if src.exists():
            shutil.copy2(src, dst)
            print(f"  {src} → {dst}")
        else:
            print(f"  [warn] {src} not found, skipping")

    print("Done. Serve site/ with any static server to view the project.")


def main():
    parser = argparse.ArgumentParser(description="Run the Bible Mapped pipeline")
    parser.add_argument("--step", type=int, default=0,
                        help="Run only step N (1=fetch, 2=embed, 3=entities, "
                             "4=metrics, 5=sphere, 6=stage, 7=search, 8=passages, 9=bsb)")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    def load_verses():
        vpath = DATA_DIR / VERSES_FILE
        if vpath.exists():
            with open(vpath) as f:
                return json.load(f)
        return None

    if args.step == 0 or args.step == 1:
        verses = fetch_data.run(DATA_DIR)
    else:
        verses = load_verses()

    if verses is None:
        print("No verse data found. Run step 1 first: python run_pipeline.py --step 1")
        return

    if args.step == 0 or args.step == 2:
        compute_embeddings.run(verses, DATA_DIR)

    if args.step == 0 or args.step == 3:
        extract_entities.run(verses, DATA_DIR)

    if args.step == 0 or args.step == 4:
        compute_metrics.run(verses, DATA_DIR)

    if args.step == 0 or args.step == 9:
        verses = fetch_bsb.run(verses, DATA_DIR)

    if args.step == 0 or args.step == 5:
        compute_sphere.run(verses, DATA_DIR)

    if args.step == 0 or args.step == 7:
        compute_search.run(verses, DATA_DIR)

    if args.step == 0 or args.step == 8:
        compute_passages.run(verses, DATA_DIR)

    if args.step == 0 or args.step == 6:
        stage_for_site(DATA_DIR, SITE_DATA_DIR)


if __name__ == "__main__":
    main()
