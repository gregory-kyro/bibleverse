# The Bible, Mapped

A computational lens on Scripture's structure and semantics. Three interactive modules — semantic map, entity network, and information-theoretic dashboard — applied to the King James Bible (public domain).

Not devotional, not polemical. Structural.

## Modules

**Semantic Map** — Every verse embedded with a sentence transformer and projected to 2D via UMAP. Hover to read; click to see nearest neighbors in embedding space.

**Entity Network** — People, places, groups, and concepts extracted via dictionary matching and TF-IDF, connected by chapter-level co-occurrence. Interactive D3 force-directed graph with filters.

**Complexity** — Shannon entropy, gzip compression ratio, type-token ratio, hapax ratio, and sentence-level statistics per book and genre. Includes a book×book cosine similarity heatmap and hapax legomena distribution.

## Setup

### Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- ~2 GB disk (model weights + data)

### Install

```bash
cd bible-mapped
uv sync
```

### Run the pipeline

```bash
uv run python run_pipeline.py
```

This will:
1. Download the KJV text from a public-domain GitHub source
2. Compute sentence embeddings (all-MiniLM-L6-v2) and UMAP coordinates
3. Extract entities and build the co-occurrence graph
4. Compute information-theoretic metrics and hapax legomena
5. Stage all JSON data into `site/data/`

Each step caches its output; rerunning skips completed steps.

To run a single step:
```bash
python run_pipeline.py --step 2  # only embeddings
```

### Serve the site

```bash
cd site
python -m http.server 8000
```

Then open `http://localhost:8000`.

### Deploy to GitHub Pages

Push the contents of `site/` to the `gh-pages` branch, or configure GitHub Pages to serve from `site/` on `main`.

## Data

- **Text**: King James Version (1769 Oxford edition), public domain
- **Embeddings**: `all-MiniLM-L6-v2` (Apache 2.0 license)
- **No copyrighted translations are used or redistributed**

## Architecture

```
bible-mapped/
├── pipeline/
│   ├── config.py              # Book metadata, genres, entity dictionaries
│   ├── fetch_data.py          # KJV download and normalization
│   ├── compute_embeddings.py  # Sentence embeddings + UMAP + neighbors
│   ├── extract_entities.py    # Entity extraction + graph construction
│   └── compute_metrics.py     # Information-theoretic metrics + hapax
├── site/
│   ├── index.html             # Landing page
│   ├── map.html               # Semantic map (Plotly scattergl)
│   ├── network.html           # Entity network (D3 force)
│   ├── complexity.html        # Complexity dashboard (Plotly)
│   ├── css/style.css          # Design system
│   ├── js/                    # Module scripts
│   └── data/                  # Generated JSON (gitignored for size)
├── run_pipeline.py            # Pipeline orchestrator
└── requirements.txt
```

## License

Code: MIT. Text: public domain. Embedding model: Apache 2.0.
