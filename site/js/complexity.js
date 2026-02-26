/**
 * Complexity Dashboard — information-theoretic metrics, genre comparisons,
 * intertextuality heatmap, and hapax legomena distribution.
 */

(async function () {
  const [metricsData, heatmapData, hapaxData] = await Promise.all([
    loadJSON('metrics.json'),
    loadJSON('heatmap.json'),
    loadJSON('hapax.json'),
  ]);

  const books = metricsData.books;
  const genres = metricsData.genres;

  // --- Summary stats ---
  const totalVerses = books.reduce((s, b) => s + b.n_verses, 0);
  const totalTokens = books.reduce((s, b) => s + b.n_tokens, 0);
  const totalTypes = books.reduce((s, b) => s + b.n_types, 0);
  document.getElementById('stat-verses').textContent = totalVerses.toLocaleString();
  document.getElementById('stat-tokens').textContent = totalTokens.toLocaleString();
  document.getElementById('stat-types').textContent = totalTypes.toLocaleString();
  document.getElementById('stat-hapax').textContent = hapaxData.length.toLocaleString();

  buildLegend('legend', GENRE_COLORS);

  // --- Metric labels for axis titles ---
  const METRIC_LABELS = {
    shannon_entropy: 'Shannon Entropy (bits)',
    compression_ratio: 'Compression Ratio (compressed/raw)',
    type_token_ratio: 'Type-Token Ratio',
    hapax_ratio: 'Hapax Ratio (hapax/types)',
    mean_word_length: 'Mean Word Length (chars)',
    mean_sentence_length: 'Mean Sentence Length (tokens)',
  };

  // --- Main bar chart ---
  function renderMetricChart() {
    const metric = document.getElementById('metric-select').value;
    const sortMode = document.getElementById('sort-mode').value;

    let sorted = [...books];
    if (sortMode === 'value_asc') sorted.sort((a, b) => a[metric] - b[metric]);
    else if (sortMode === 'value_desc') sorted.sort((a, b) => b[metric] - a[metric]);

    const trace = {
      x: sorted.map(b => b.abbrev),
      y: sorted.map(b => b[metric]),
      type: 'bar',
      marker: { color: sorted.map(b => GENRE_COLORS[b.genre] || '#888') },
      hovertext: sorted.map(b =>
        `<b>${b.book}</b><br>${METRIC_LABELS[metric]}: ${b[metric]}<br>Genre: ${b.genre}<br>Tokens: ${b.n_tokens.toLocaleString()}`
      ),
      hoverinfo: 'text',
      hoverlabel: { bgcolor: '#16162a', bordercolor: '#2a2a4a', font: { family: 'Inter', size: 12, color: '#e8e4dc' } },
    };

    const layout = {
      ...PLOTLY_LAYOUT_DEFAULTS,
      xaxis: {
        ...PLOTLY_LAYOUT_DEFAULTS.xaxis,
        tickangle: -45,
        tickfont: { size: 9 },
      },
      yaxis: {
        ...PLOTLY_LAYOUT_DEFAULTS.yaxis,
        title: METRIC_LABELS[metric],
        titlefont: { size: 11 },
      },
      margin: { t: 20, r: 20, b: 80, l: 70 },
      bargap: 0.15,
    };

    const el = document.getElementById('metric-chart');
    el.innerHTML = '';
    Plotly.newPlot(el, [trace], layout, PLOTLY_CONFIG);
  }

  // --- Genre comparison (grouped bar) ---
  function renderGenreChart() {
    const metricKeys = ['mean_entropy', 'mean_compression', 'mean_ttr', 'mean_hapax_ratio'];
    const metricNames = ['Entropy', 'Compression', 'TTR', 'Hapax Ratio'];
    const barColors = ['#c9a84c', '#5b7fa5', '#8bc34a', '#c490d1'];

    const traces = metricKeys.map((key, i) => ({
      x: genres.map(g => g.genre),
      y: genres.map(g => g[key]),
      name: metricNames[i],
      type: 'bar',
      marker: { color: barColors[i] },
      hoverlabel: { bgcolor: '#16162a', bordercolor: '#2a2a4a', font: { family: 'Inter', size: 12, color: '#e8e4dc' } },
    }));

    const layout = {
      ...PLOTLY_LAYOUT_DEFAULTS,
      barmode: 'group',
      xaxis: { ...PLOTLY_LAYOUT_DEFAULTS.xaxis, tickangle: -30, tickfont: { size: 10 } },
      yaxis: { ...PLOTLY_LAYOUT_DEFAULTS.yaxis, title: 'Value', titlefont: { size: 11 } },
      margin: { t: 20, r: 20, b: 80, l: 60 },
      legend: { orientation: 'h', y: 1.12, font: { size: 11 } },
      bargap: 0.2,
      bargroupgap: 0.05,
    };

    const el = document.getElementById('genre-chart');
    el.innerHTML = '';
    Plotly.newPlot(el, traces, layout, PLOTLY_CONFIG);
  }

  // --- Heatmap ---
  function renderHeatmap() {
    const labels = heatmapData.books.map(b => b.abbrev);
    const matrix = heatmapData.matrix;

    const hovertext = matrix.map((row, i) =>
      row.map((val, j) =>
        `${heatmapData.books[i].name} × ${heatmapData.books[j].name}<br>Cosine: ${val.toFixed(4)}`
      )
    );

    const trace = {
      z: matrix,
      x: labels,
      y: labels,
      type: 'heatmap',
      colorscale: [
        [0, '#0a0a12'],
        [0.3, '#1c1c3a'],
        [0.5, '#5b3a1a'],
        [0.7, '#9a6a2a'],
        [0.85, '#c9a84c'],
        [1.0, '#f0d878'],
      ],
      hovertext,
      hoverinfo: 'text',
      hoverlabel: { bgcolor: '#16162a', bordercolor: '#2a2a4a', font: { family: 'Inter', size: 12, color: '#e8e4dc' } },
      colorbar: {
        title: { text: 'Cosine Similarity', font: { size: 11 } },
        tickfont: { size: 10 },
      },
    };

    const layout = {
      ...PLOTLY_LAYOUT_DEFAULTS,
      xaxis: {
        ...PLOTLY_LAYOUT_DEFAULTS.xaxis,
        tickangle: -45,
        tickfont: { size: 8 },
        side: 'bottom',
      },
      yaxis: {
        ...PLOTLY_LAYOUT_DEFAULTS.yaxis,
        tickfont: { size: 8 },
        autorange: 'reversed',
      },
      margin: { t: 10, r: 80, b: 80, l: 60 },
    };

    const el = document.getElementById('heatmap-chart');
    el.innerHTML = '';
    Plotly.newPlot(el, [trace], layout, PLOTLY_CONFIG);
  }

  // --- Hapax distribution by book ---
  function renderHapax() {
    const bookCounts = {};
    hapaxData.forEach(h => {
      bookCounts[h.book] = (bookCounts[h.book] || 0) + 1;
    });

    const ordered = books.filter(b => bookCounts[b.book]);
    const trace = {
      x: ordered.map(b => b.abbrev),
      y: ordered.map(b => bookCounts[b.book] || 0),
      type: 'bar',
      marker: { color: ordered.map(b => GENRE_COLORS[b.genre] || '#888') },
      hovertext: ordered.map(b =>
        `<b>${b.book}</b><br>Hapax: ${bookCounts[b.book] || 0}<br>Genre: ${b.genre}`
      ),
      hoverinfo: 'text',
      hoverlabel: { bgcolor: '#16162a', bordercolor: '#2a2a4a', font: { family: 'Inter', size: 12, color: '#e8e4dc' } },
    };

    const layout = {
      ...PLOTLY_LAYOUT_DEFAULTS,
      xaxis: { ...PLOTLY_LAYOUT_DEFAULTS.xaxis, tickangle: -45, tickfont: { size: 9 } },
      yaxis: { ...PLOTLY_LAYOUT_DEFAULTS.yaxis, title: 'Hapax Count', titlefont: { size: 11 } },
      margin: { t: 20, r: 20, b: 80, l: 60 },
      bargap: 0.15,
    };

    const el = document.getElementById('hapax-chart');
    el.innerHTML = '';
    Plotly.newPlot(el, [trace], layout, PLOTLY_CONFIG);
  }

  // --- Event listeners ---
  document.getElementById('metric-select').addEventListener('change', renderMetricChart);
  document.getElementById('sort-mode').addEventListener('change', renderMetricChart);

  // --- Initial render ---
  renderMetricChart();
  renderGenreChart();
  renderHeatmap();
  renderHapax();
})();
