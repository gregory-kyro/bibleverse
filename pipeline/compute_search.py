"""
Export Bible-model embeddings as a compact uint8 binary for client-side semantic search.

Reads the 768-dim embeddings already computed by compute_embeddings.py (using the
Bible-trained sentence transformer), L2-normalises them, and quantises to uint8 so
the browser can load ~23 MB instead of ~96 MB.  Cosine-similarity ranking is
order-preserving under this quantisation because all vectors share the same
affine mapping [-1, 1] → [0, 255].
"""

import json
import numpy as np
from pathlib import Path

SEARCH_FILE = "search_embeddings.bin"
SEARCH_META_FILE = "search_meta.json"


def run(verses: list[dict], data_dir: Path):
    print("[search] Exporting search embeddings from Bible-model vectors...")
    out_path = data_dir / SEARCH_FILE
    meta_path = data_dir / SEARCH_META_FILE

    emb_path = data_dir / "embeddings.npy"
    if not emb_path.exists():
        raise FileNotFoundError(f"embeddings.npy not found at {emb_path}; run step 2 first")

    embeddings = np.load(emb_path).astype(np.float32)
    assert embeddings.shape[0] == len(verses), (
        f"Mismatch: {embeddings.shape[0]} embeddings vs {len(verses)} verses"
    )

    # L2-normalise so dot product == cosine similarity
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    embeddings = embeddings / np.clip(norms, 1e-8, None)

    # Quantise [-1, 1] → [0, 255]
    emb_uint8 = ((embeddings + 1.0) * 127.5).clip(0, 255).astype(np.uint8)
    emb_uint8.tofile(out_path)

    meta = {
        "n_verses": len(verses),
        "dim": int(embeddings.shape[1]),
        "dtype": "uint8",
        "model": "odunola/sentence-transformers-bible-reference-final",
        "note": "L2-normalised, then affine-quantised [-1,1]→[0,255]",
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f)

    size_mb = out_path.stat().st_size / 1e6
    print(f"  {embeddings.shape} → {out_path} ({size_mb:.1f} MB)")
