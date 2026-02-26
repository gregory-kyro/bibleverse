"""
Compute the interactive 3D sphere for the homepage.

Pipeline:
  1. UMAP all 31k verse embeddings to 3D
  2. Project onto unit sphere (clusters preserved)
  3. Download scholarly cross-references (openbible.info, public domain)
  4. Bin arcs by vote count for interactive frontend filtering
  5. Compute arc geometry with variable bow height
  6. Output sphere.json for Plotly frontend
"""

import csv
import io
import json
import numpy as np
import urllib.request
from pathlib import Path

from .config import (
    BOOKS, EMBEDDINGS_FILE,
    UMAP_METRIC, UMAP_RANDOM_STATE,
)

SPHERE_FILE = "sphere.json"
XREF_CSV_URL = (
    "https://raw.githubusercontent.com/shandran/openbible/"
    "master/cross_references_expanded.csv"
)
XREF_CACHE = "cross_references.csv"
MIN_VOTES = 20

MIN_BOW = 0.003
MAX_BOW = 0.02
ARC_SEGMENTS = 30

VOTE_BINS = [
    {"min": 20,  "max": 30,  "label": "20–29"},
    {"min": 30,  "max": 50,  "label": "30–49"},
    {"min": 50,  "max": 100, "label": "50–99"},
    {"min": 100, "max": 9999, "label": "100+"},
]

_ABBREV_ALIASES = {
    "Psa": "Ps", "Psm": "Ps",
    "SOS": "Song", "Sol": "Song",
    "Phm": "Phlm",
}


def _umap_3d(embeddings, cache_path):
    if cache_path.exists():
        print(f"  [skip] 3D UMAP cached at {cache_path}")
        return np.load(cache_path)

    import umap
    print(f"  Running 3D UMAP on {len(embeddings)} points...")
    reducer = umap.UMAP(
        n_components=3,
        n_neighbors=15,
        min_dist=0.1,
        metric=UMAP_METRIC,
        random_state=UMAP_RANDOM_STATE,
    )
    coords = reducer.fit_transform(embeddings)
    np.save(cache_path, coords)
    return coords


def _project_to_sphere(coords):
    centered = coords - coords.mean(axis=0)
    norms = np.linalg.norm(centered, axis=1, keepdims=True)
    return centered / np.clip(norms, 1e-8, None)


def _download_xrefs(data_dir):
    cache = data_dir / XREF_CACHE
    if cache.exists():
        print(f"  [skip] Cross-references cached at {cache}")
        with open(cache) as f:
            return f.read()
    print(f"  Downloading cross-references from openbible.info...")
    req = urllib.request.Request(XREF_CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
    resp = urllib.request.urlopen(req, timeout=60)
    text = resp.read().decode("utf-8")
    with open(cache, "w") as f:
        f.write(text)
    return text


def _parse_xrefs(csv_text, verse_lookup):
    """Returns (arcs_above_threshold, total_unique_in_dataset)."""
    reader = csv.DictReader(io.StringIO(csv_text))
    raw = {}

    for row in reader:
        try:
            votes = int(row["Votes"])
            from_book = _ABBREV_ALIASES.get(row["From Book"], row["From Book"])
            from_ch = int(row["From Chapter"])
            from_vs = int(row["From Verse number"])
            to_book = _ABBREV_ALIASES.get(
                row["To Verse start Book"], row["To Verse start Book"]
            )
            to_ch = int(row["To Verse start Chapter"])
            to_vs = int(float(row["To Verse start number"]))
        except (ValueError, TypeError, KeyError):
            continue

        src = verse_lookup.get((from_book, from_ch, from_vs))
        tgt = verse_lookup.get((to_book, to_ch, to_vs))
        if src is None or tgt is None or src == tgt:
            continue

        key = (min(src, tgt), max(src, tgt))
        if key not in raw or votes > raw[key][2]:
            from_test = row.get("From Book Testament", "")
            to_test = row.get("To Book Testament", "")
            cross = from_test != to_test
            raw[key] = (key[0], key[1], votes, cross)

    total_unique = len(raw)
    total_dataset_inter = sum(1 for a in raw.values() if a[3])
    total_dataset_intra = total_unique - total_dataset_inter
    arcs = sorted(
        [a for a in raw.values() if a[2] >= MIN_VOTES],
        key=lambda x: -x[2],
    )
    return arcs, total_unique, total_dataset_intra, total_dataset_inter


def _angular_distance(p1, p2):
    return np.arccos(np.clip(np.dot(p1, p2), -1.0, 1.0))


def _arc_curve(p1, p2, height, n_seg=ARC_SEGMENTS):
    """Generate n_seg+1 points along a smooth bowed arc on the sphere."""
    points = []
    for i in range(n_seg + 1):
        t = i / n_seg
        interp = p1 * (1.0 - t) + p2 * t
        norm = np.linalg.norm(interp)
        if norm < 1e-8:
            perp = np.cross(p1, np.array([0.0, 0.0, 1.0]))
            if np.linalg.norm(perp) < 1e-8:
                perp = np.cross(p1, np.array([0.0, 1.0, 0.0]))
            interp = perp / np.linalg.norm(perp)
            norm = 1.0
        interp = interp / norm
        bow = height * np.sin(np.pi * t)
        points.append(interp * (1.0 + bow))
    return points


def _build_vote_bins(arcs, sphere_coords):
    """Bin arcs by vote count, split into intra/inter-testament traces."""
    bins = []
    for b in VOTE_BINS:
        bins.append({
            **b,
            "intra": {"x": [], "y": [], "z": []},
            "inter": {"x": [], "y": [], "z": []},
            "count_intra": 0,
            "count_inter": 0,
        })

    for src, tgt, votes, cross_testament in arcs:
        p1 = sphere_coords[src]
        p2 = sphere_coords[tgt]
        angle = _angular_distance(p1, p2)

        t = angle / np.pi
        bow = MIN_BOW + (MAX_BOW - MIN_BOW) * t
        curve = _arc_curve(p1, p2, bow)

        for b in bins:
            if b["min"] <= votes < b["max"]:
                bucket = b["inter"] if cross_testament else b["intra"]
                for pt in curve:
                    bucket["x"].append(round(float(pt[0]), 3))
                    bucket["y"].append(round(float(pt[1]), 3))
                    bucket["z"].append(round(float(pt[2]), 3))
                bucket["x"].append(None)
                bucket["y"].append(None)
                bucket["z"].append(None)
                if cross_testament:
                    b["count_inter"] += 1
                else:
                    b["count_intra"] += 1
                break

    result = []
    for b in bins:
        result.append({
            "vote_min": b["min"],
            "vote_max": b["max"],
            "label": b["label"],
            "count_intra": b["count_intra"],
            "count_inter": b["count_inter"],
            "intra": b["intra"],
            "inter": b["inter"],
        })
    return result


def run(verses, data_dir):
    print("[sphere] Building homepage 3D sphere...")

    emb_path = data_dir / EMBEDDINGS_FILE
    if not emb_path.exists():
        print("  [error] Embeddings not found. Run step 2 first.")
        return
    embeddings = np.load(emb_path)

    coords = _umap_3d(embeddings, data_dir / "umap3d.npy")
    sphere = _project_to_sphere(coords)
    print(f"  {len(sphere)} verses projected to unit sphere")

    lookup = {}
    for i, v in enumerate(verses):
        lookup[(v["book_abbrev"], v["chapter"], v["verse"])] = i

    csv_text = _download_xrefs(data_dir)
    arcs, total_unique, dataset_intra, dataset_inter = _parse_xrefs(csv_text, lookup)
    print(f"  {total_unique} unique cross-references in dataset ({dataset_intra} intra, {dataset_inter} inter)")
    print(f"  {len(arcs)} with votes >= {MIN_VOTES} (rendered)")

    vote_bins = _build_vote_bins(arcs, sphere)
    total_cross = 0
    total_intra = 0
    for b in vote_bins:
        n = b["count_intra"] + b["count_inter"]
        if n:
            print(f"    votes {b['label']}: {n} arcs "
                  f"({b['count_intra']} intra, {b['count_inter']} inter-testament)")
            total_cross += b["count_inter"]
            total_intra += b["count_intra"]

    n_ot = sum(1 for v in verses if v["testament"] == "OT")
    n_nt = sum(1 for v in verses if v["testament"] == "NT")

    points = []
    bsb_list = []
    for v, sc in zip(verses, sphere):
        pt = {
            "ref": v["ref"],
            "text": v["text"],
            "book": v["book"],
            "book_num": v["book_num"],
            "testament": v["testament"],
            "sx": round(float(sc[0]), 4),
            "sy": round(float(sc[1]), 4),
            "sz": round(float(sc[2]), 4),
        }
        points.append(pt)
        bsb_list.append(v.get("text_bsb", ""))

    # Write BSB translations as a separate lightweight file
    bsb_path = data_dir / "bsb_verses.json"
    with open(bsb_path, "w") as f:
        json.dump(bsb_list, f)
    print(f"  BSB translations → {bsb_path} ({bsb_path.stat().st_size / 1e6:.1f} MB)")

    # Representative verse per book: closest to mean embedding
    book_indices = {}
    for i, v in enumerate(verses):
        book_indices.setdefault(v["book_num"], []).append(i)

    rep_verses = []
    for b in BOOKS:
        bn = b["num"]
        idxs = book_indices.get(bn, [])
        if not idxs:
            continue
        book_emb = embeddings[idxs]
        mean_emb = book_emb.mean(axis=0)
        mean_norm = mean_emb / (np.linalg.norm(mean_emb) + 1e-8)
        norms = np.linalg.norm(book_emb, axis=1, keepdims=True)
        sims = (book_emb / np.clip(norms, 1e-8, None)) @ mean_norm
        best = idxs[int(np.argmax(sims))]
        rep_verses.append({
            "book_num": bn,
            "book": b["name"],
            "testament": b["testament"],
            "ref": verses[best]["ref"],
            "text": verses[best]["text"],
            "similarity": round(float(np.max(sims)), 4),
            "n_verses": len(idxs),
        })
    print(f"  {len(rep_verses)} representative verses computed")

    result = {
        "points": points,
        "vote_bins": vote_bins,
        "representative_verses": rep_verses,
        "stats": {
            "total_verses": len(verses),
            "books": len(BOOKS),
            "ot_verses": n_ot,
            "nt_verses": n_nt,
            "arcs_rendered": len(arcs),
            "arcs_in_dataset": total_unique,
            "dataset_intra": dataset_intra,
            "dataset_inter": dataset_inter,
            "arcs_cross": total_cross,
            "arcs_same": len(arcs) - total_cross,
        },
    }

    out_path = data_dir / SPHERE_FILE
    with open(out_path, "w") as f:
        json.dump(result, f)
    size_mb = out_path.stat().st_size / 1e6
    print(f"  sphere.json -> {out_path} ({size_mb:.1f} MB, "
          f"{len(points)} points, {len(arcs)} arcs in {len(vote_bins)} vote bins)")
