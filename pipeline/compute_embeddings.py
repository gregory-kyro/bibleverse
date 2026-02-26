"""
Compute sentence embeddings for every verse, reduce to 2D with UMAP,
and find nearest neighbors in the full embedding space.
"""

import json
import numpy as np
from pathlib import Path

from .config import (
    EMBEDDING_MODEL, EMBEDDINGS_FILE, UMAP_FILE, NEIGHBORS_FILE,
    UMAP_N_NEIGHBORS, UMAP_MIN_DIST, UMAP_METRIC, UMAP_RANDOM_STATE,
    TOP_K_NEIGHBORS, HEATMAP_FILE, BOOKS, BOOK_NAME_TO_META, GENRE_COLORS,
)


def _compute_embeddings(texts: list[str], cache_path: Path) -> np.ndarray:
    if cache_path.exists():
        print(f"  [skip] Embeddings cached at {cache_path}")
        return np.load(cache_path)

    from sentence_transformers import SentenceTransformer
    print(f"  Loading model {EMBEDDING_MODEL}...")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print(f"  Encoding {len(texts)} verses...")
    embeddings = model.encode(texts, show_progress_bar=True, batch_size=256)
    embeddings = np.array(embeddings, dtype=np.float32)
    np.save(cache_path, embeddings)
    print(f"  Saved embeddings {embeddings.shape} → {cache_path}")
    return embeddings


def _run_umap(embeddings: np.ndarray, out_path: Path) -> list[list[float]]:
    if out_path.exists():
        print(f"  [skip] UMAP coordinates cached at {out_path}")
        with open(out_path) as f:
            return json.load(f)

    import umap
    print(f"  Running UMAP ({embeddings.shape[0]} points)...")
    reducer = umap.UMAP(
        n_neighbors=UMAP_N_NEIGHBORS,
        min_dist=UMAP_MIN_DIST,
        metric=UMAP_METRIC,
        random_state=UMAP_RANDOM_STATE,
        n_components=2,
    )
    coords = reducer.fit_transform(embeddings)
    coords_list = coords.tolist()
    with open(out_path, "w") as f:
        json.dump(coords_list, f)
    print(f"  UMAP complete → {out_path}")
    return coords_list


def _find_neighbors(embeddings: np.ndarray, out_path: Path) -> list[list]:
    if out_path.exists():
        print(f"  [skip] Neighbors cached at {out_path}")
        with open(out_path) as f:
            return json.load(f)

    print(f"  Computing top-{TOP_K_NEIGHBORS} neighbors for {len(embeddings)} verses...")
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    normed = embeddings / (norms + 1e-10)

    neighbors = []
    batch_size = 500
    for start in range(0, len(normed), batch_size):
        end = min(start + batch_size, len(normed))
        sims = normed[start:end] @ normed.T  # (batch, N)
        for i, row in enumerate(sims):
            idx = start + i
            row[idx] = -1  # exclude self
            top_k = np.argsort(row)[-TOP_K_NEIGHBORS:][::-1]
            neighbors.append([[int(j), round(float(row[j]), 4)] for j in top_k])

    with open(out_path, "w") as f:
        json.dump(neighbors, f)
    print(f"  Neighbors → {out_path}")
    return neighbors


def _book_heatmap(verses: list[dict], embeddings: np.ndarray, out_path: Path):
    """Compute book×book cosine similarity matrix from mean embeddings."""
    if out_path.exists():
        print(f"  [skip] Heatmap cached at {out_path}")
        return

    from collections import defaultdict
    book_embs = defaultdict(list)
    for v, emb in zip(verses, embeddings):
        book_embs[v["book"]].append(emb)

    book_names = [b["name"] for b in BOOKS]
    means = {}
    for name in book_names:
        vecs = np.array(book_embs[name])
        means[name] = vecs.mean(axis=0)

    n = len(book_names)
    matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            a, b = means[book_names[i]], means[book_names[j]]
            cos = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))
            matrix[i][j] = round(cos, 4)

    result = {
        "books": [{"name": b["name"], "abbrev": b["abbrev"], "genre": b["genre"]}
                  for b in BOOKS],
        "matrix": matrix.tolist(),
        "genre_colors": GENRE_COLORS,
    }
    with open(out_path, "w") as f:
        json.dump(result, f)
    print(f"  Heatmap → {out_path}")


def run(verses: list[dict], data_dir: Path):
    print("[2/5] Computing embeddings...")
    texts = [v["text"] for v in verses]
    emb_path = data_dir / EMBEDDINGS_FILE
    embeddings = _compute_embeddings(texts, emb_path)

    umap_path = data_dir / UMAP_FILE
    _run_umap(embeddings, umap_path)

    nb_path = data_dir / NEIGHBORS_FILE
    _find_neighbors(embeddings, nb_path)

    heatmap_path = data_dir / HEATMAP_FILE
    _book_heatmap(verses, embeddings, heatmap_path)
