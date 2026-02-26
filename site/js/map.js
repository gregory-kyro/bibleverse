/**
 * Semantic Map — UMAP scatter of verse embeddings with neighbor lookup.
 */

(async function () {
  const [verses, coords, neighbors] = await Promise.all([
    loadJSON('verses.json'),
    loadJSON('umap_coords.json'),
    loadJSON('neighbors.json'),
  ]);

  const genres = [...new Set(verses.map(v => v.genre))];
  const genreSelect = document.getElementById('filter-genre');
  genres.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    genreSelect.appendChild(opt);
  });

  buildLegend('legend', GENRE_COLORS);

  let currentFilter = { testament: 'all', genre: 'all' };

  function getFilteredIndices() {
    return verses.reduce((acc, v, i) => {
      if (currentFilter.testament !== 'all' && v.testament !== currentFilter.testament) return acc;
      if (currentFilter.genre !== 'all' && v.genre !== currentFilter.genre) return acc;
      acc.push(i);
      return acc;
    }, []);
  }

  function getColor(v, i, mode) {
    if (mode === 'genre') return GENRE_COLORS[v.genre] || '#888';
    if (mode === 'testament') return v.testament === 'OT' ? '#e6c865' : '#5b9bd5';
    // book: sequential hue
    const hue = (v.book_num / 66) * 330;
    return `hsl(${hue}, 60%, 55%)`;
  }

  function render() {
    const indices = getFilteredIndices();
    const colorMode = document.getElementById('color-mode').value;
    const ptSize = parseFloat(document.getElementById('point-size').value);
    const opacity = parseFloat(document.getElementById('opacity-ctrl').value);

    const x = indices.map(i => coords[i][0]);
    const y = indices.map(i => coords[i][1]);
    const colors = indices.map(i => getColor(verses[i], i, colorMode));
    const customdata = indices;
    const hovertext = indices.map(i => {
      const v = verses[i];
      return `<b>${v.ref}</b><br><i>${truncate(v.text, 120)}</i><br><span style="color:${GENRE_COLORS[v.genre]}">${v.genre}</span> · ${v.book}`;
    });

    const trace = {
      x, y,
      customdata,
      type: 'scattergl',
      mode: 'markers',
      marker: { color: colors, size: ptSize, opacity },
      hovertext,
      hoverinfo: 'text',
      hoverlabel: {
        bgcolor: '#16162a',
        bordercolor: '#2a2a4a',
        font: { family: 'Inter, sans-serif', size: 12, color: '#e8e4dc' },
      },
    };

    const layout = {
      ...PLOTLY_LAYOUT_DEFAULTS,
      xaxis: { ...PLOTLY_LAYOUT_DEFAULTS.xaxis, showticklabels: false, title: '' },
      yaxis: { ...PLOTLY_LAYOUT_DEFAULTS.yaxis, showticklabels: false, title: '' },
      margin: { t: 10, r: 10, b: 10, l: 10 },
      hovermode: 'closest',
      dragmode: 'pan',
    };

    const container = document.getElementById('scatter-container');
    container.innerHTML = '';
    Plotly.newPlot(container, [trace], layout, PLOTLY_CONFIG);

    container.on('plotly_click', function (data) {
      if (!data.points.length) return;
      const idx = data.points[0].customdata;
      showVerseDetail(idx);
    });
  }

  function showVerseDetail(idx) {
    const v = verses[idx];
    document.getElementById('panel-hint').style.display = 'none';

    const selDiv = document.getElementById('selected-verse');
    selDiv.innerHTML = `
      <div style="margin-bottom:0.5rem;">
        <span class="gold mono" style="font-size:0.85rem;">${v.ref}</span>
        <span class="faint small" style="margin-left:0.5rem;">${v.genre}</span>
      </div>
      <p style="color:var(--text-dim); font-size:0.9rem; line-height:1.6;">${v.text}</p>
    `;

    const nbDiv = document.getElementById('neighbors-list');
    const nbs = neighbors[idx];
    if (!nbs || nbs.length === 0) {
      nbDiv.innerHTML = '<p class="dim small">No neighbor data available.</p>';
      return;
    }

    nbDiv.innerHTML = '<h3 style="margin-top:0.5rem;">Nearest Neighbors</h3>';
    nbs.forEach(([nbIdx, score]) => {
      const nv = verses[nbIdx];
      const item = document.createElement('div');
      item.className = 'neighbor-item';
      item.innerHTML = `
        <span class="neighbor-ref">${nv.ref}</span>
        <span class="neighbor-score">${score.toFixed(3)}</span>
        <div class="neighbor-text">${truncate(nv.text, 160)}</div>
      `;
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => showVerseDetail(nbIdx));
      nbDiv.appendChild(item);
    });
  }

  // Event listeners
  document.getElementById('color-mode').addEventListener('change', render);
  document.getElementById('point-size').addEventListener('input', render);
  document.getElementById('opacity-ctrl').addEventListener('input', render);
  document.getElementById('filter-testament').addEventListener('change', (e) => {
    currentFilter.testament = e.target.value;
    render();
  });
  document.getElementById('filter-genre').addEventListener('change', (e) => {
    currentFilter.genre = e.target.value;
    render();
  });

  render();
})();
