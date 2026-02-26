/**
 * Shared utilities for The Bible, Mapped.
 */

const DATA_BASE = 'data/';

async function loadJSON(filename) {
  const resp = await fetch(DATA_BASE + filename);
  if (!resp.ok) throw new Error(`Failed to load ${filename}: ${resp.status}`);
  return resp.json();
}

function setLoading(containerId, loading) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (loading) {
    el.innerHTML = '<div class="loading">Loading data</div>';
  }
}

const GENRE_COLORS = {
  'Law':               '#e6c865',
  'History':           '#7cb5a0',
  'Wisdom':            '#c490d1',
  'Major Prophets':    '#e07a5f',
  'Minor Prophets':    '#f2a65a',
  'Gospels':           '#5b9bd5',
  'Acts':              '#45a0a0',
  'Pauline Epistles':  '#8bc34a',
  'General Epistles':  '#4dd0e1',
  'Apocalyptic':       '#ef5350',
};

function buildLegend(containerId, colorMap) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  for (const [label, color] of Object.entries(colorMap)) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-swatch" style="background:${color}"></span>${label}`;
    el.appendChild(item);
  }
}

const PLOTLY_LAYOUT_DEFAULTS = {
  paper_bgcolor: '#13132a',
  plot_bgcolor: '#0a0a12',
  font: { family: 'Inter, system-ui, sans-serif', color: '#e8e4dc', size: 12 },
  margin: { t: 40, r: 30, b: 50, l: 60 },
  xaxis: { gridcolor: '#1e1e38', zerolinecolor: '#2a2a4a' },
  yaxis: { gridcolor: '#1e1e38', zerolinecolor: '#2a2a4a' },
};

const PLOTLY_CONFIG = {
  displaylogo: false,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  responsive: true,
};

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}
