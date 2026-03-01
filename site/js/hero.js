/**
 * Homepage 3D sphere — 31k verses on S² via UMAP-3D projection.
 * Color: spectral gradient by canonical book (1–66).
 * OT = diamond, NT = cross. Edges: intra = gray, inter = gold.
 * Semantic search (Bible-trained MPNet via ONNX), per-book toggles,
 * vote slider, zoom buttons.
 */

(async function () {
  const isMobileDevice = window.innerWidth <= 800;
  const data = await loadJSON('sphere.json?v=' + Date.now());
  const pts = data.points;
  const stats = data.stats;

  // BSB translations loaded lazily (separate file to keep sphere.json lean)
  let bsbVerses = null;
  let bsbLoading = false;
  async function loadBsb() {
    if (bsbVerses) return bsbVerses;
    if (bsbLoading) { while (!bsbVerses) await new Promise(r => setTimeout(r, 50)); return bsbVerses; }
    bsbLoading = true;
    try { bsbVerses = await loadJSON('bsb_verses.json?v=' + Date.now()); }
    catch (e) { console.warn('BSB translations not available', e); bsbVerses = []; }
    return bsbVerses;
  }

  const INTRA_COLOR = 'rgba(220,220,230,0.12)';
  const INTER_COLOR = 'rgba(220,220,230,0.12)';
  const ARC_WIDTH = 0.7;

  // Light blue → dark blue → dark red → gold → bright gold (fast transition)
  const bookScale = [
    [0.00, '#68B8E8'],
    [0.08, '#3A8AD0'],
    [0.16, '#1A4A9A'],
    [0.24, '#142868'],
    [0.32, '#681818'],
    [0.40, '#8B1A1A'],
    [0.50, '#A85020'],
    [0.60, '#C88A30'],
    [0.75, '#D8B040'],
    [0.88, '#E8C850'],
    [1.00, '#F0D060'],
  ];

  function bookColor(num) {
    const t = (num - 1) / 65;
    for (let i = 0; i < bookScale.length - 1; i++) {
      const [t0, c0] = bookScale[i];
      const [t1, c1] = bookScale[i + 1];
      if (t >= t0 && t <= t1) {
        const f = (t - t0) / (t1 - t0);
        const r0 = parseInt(c0.slice(1, 3), 16), g0 = parseInt(c0.slice(3, 5), 16), b0 = parseInt(c0.slice(5, 7), 16);
        const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
        return '#' + [Math.round(r0 + (r1 - r0) * f), Math.round(g0 + (g1 - g0) * f), Math.round(b0 + (b1 - b0) * f)]
          .map(v => v.toString(16).padStart(2, '0')).join('');
      }
    }
    return bookScale[bookScale.length - 1][1];
  }

  const bookNames = {}, bookTestament = {}, chapterCounts = {};
  for (const p of pts) {
    if (!bookNames[p.book_num]) { bookNames[p.book_num] = p.book; bookTestament[p.book_num] = p.testament; }
  }
  const allBookNums = Object.keys(bookNames).map(Number).sort((a, b) => a - b);
  const visibleBooks = new Set(allBookNums);

  const ot = { x: [], y: [], z: [], text: [], bookNum: [] };
  const nt = { x: [], y: [], z: [], text: [], bookNum: [] };

  function wrapText(str, maxLen) {
    const words = str.split(' ');
    let line = '', lines = [];
    for (const w of words) {
      if (line && (line.length + w.length + 1) > maxLen) { lines.push(line); line = w; }
      else { line = line ? line + ' ' + w : w; }
    }
    if (line) lines.push(line);
    return lines.join('<br>');
  }

  for (const p of pts) {
    const bucket = p.testament === 'OT' ? ot : nt;
    bucket.x.push(p.sx); bucket.y.push(p.sy); bucket.z.push(p.sz);
    bucket.bookNum.push(p.book_num);
    bucket.text.push(`<b>${p.ref}</b><br><i>${wrapText(p.text, 60)}</i>`);
  }

  const traces = [];

  // Semi-transparent inner sphere surface
  {
    const N = 32;
    const sx = [], sy = [], sz = [], si = [], sj = [], sk = [];
    const R = 0.97;
    for (let lat = 0; lat <= N; lat++) {
      const theta = Math.PI * lat / N;
      for (let lon = 0; lon <= N * 2; lon++) {
        const phi = 2 * Math.PI * lon / (N * 2);
        sx.push(R * Math.sin(theta) * Math.cos(phi));
        sy.push(R * Math.sin(theta) * Math.sin(phi));
        sz.push(R * Math.cos(theta));
      }
    }
    const cols = N * 2 + 1;
    for (let lat = 0; lat < N; lat++) {
      for (let lon = 0; lon < N * 2; lon++) {
        const a = lat * cols + lon, b = a + 1, c = a + cols, d = c + 1;
        si.push(a); sj.push(b); sk.push(c);
        si.push(b); sj.push(d); sk.push(c);
      }
    }
    traces.push({
      type: 'mesh3d', x: sx, y: sy, z: sz, i: si, j: sj, k: sk,
      color: '#080810', opacity: 0.55, flatshading: true,
      lighting: { ambient: 0.6, diffuse: 0.3, specular: 0.05, roughness: 0.9 },
      hoverinfo: 'skip', showlegend: false,
    });
  }

  const voteBins = data.vote_bins;
  const VOTE_THRESHOLDS = voteBins.map(b => b.vote_min);

  const arcTraceStart = traces.length;
  for (const bin of voteBins) {
    const vis = bin.vote_min >= 30;
    traces.push({ type: 'scatter3d', mode: 'lines', x: bin.intra.x, y: bin.intra.y, z: bin.intra.z,
      line: { color: INTRA_COLOR, width: ARC_WIDTH }, hoverinfo: 'skip', showlegend: false, visible: vis });
    traces.push({ type: 'scatter3d', mode: 'lines', x: bin.inter.x, y: bin.inter.y, z: bin.inter.z,
      line: { color: INTER_COLOR, width: ARC_WIDTH }, hoverinfo: 'skip', showlegend: false, visible: vis });
  }
  const arcTraceEnd = traces.length;

  const hoverCfg = { bgcolor: '#0a0a14', bordercolor: '#2a2a3a',
    font: { family: 'Inter, sans-serif', size: 11, color: '#e8e4dc' } };

  const OT_SIZE = 2.5, NT_SIZE = 3;

  const otTraceIdx = traces.length;
  traces.push({ type: 'scatter3d', mode: 'markers', x: ot.x, y: ot.y, z: ot.z,
    text: ot.text, hoverinfo: 'skip', showlegend: false,
    marker: { size: OT_SIZE, symbol: 'diamond', color: ot.bookNum, colorscale: bookScale,
      cmin: 1, cmax: 66, opacity: ot.bookNum.map(() => 0.85), showscale: false },
    hoverlabel: hoverCfg });

  const ntTraceIdx = traces.length;
  traces.push({ type: 'scatter3d', mode: 'markers', x: nt.x, y: nt.y, z: nt.z,
    text: nt.text, hoverinfo: 'skip', showlegend: false,
    marker: { size: NT_SIZE, symbol: 'cross', color: nt.bookNum, colorscale: bookScale,
      cmin: 1, cmax: 66, opacity: nt.bookNum.map(() => 0.85), showscale: false },
    hoverlabel: hoverCfg });

  // Flat index of all points for nearest-neighbor hover
  const allPts3D = [];
  for (let i = 0; i < ot.x.length; i++) {
    allPts3D.push({ x: ot.x[i], y: ot.y[i], z: ot.z[i], text: ot.text[i] });
  }
  for (let i = 0; i < nt.x.length; i++) {
    allPts3D.push({ x: nt.x[i], y: nt.y[i], z: nt.z[i], text: nt.text[i] });
  }

  const axisRange = [-1.15, 1.15];
  const axisCfg = { showgrid: false, zeroline: false, showticklabels: false,
    title: '', showspikes: false, showbackground: false,
    range: axisRange, autorange: false };

  const layout = {
    paper_bgcolor: '#000', plot_bgcolor: '#000',
    font: { family: 'Inter, system-ui, sans-serif', color: '#e8e4dc' },
    scene: { xaxis: axisCfg, yaxis: axisCfg, zaxis: axisCfg,
      aspectmode: 'cube', bgcolor: '#000', dragmode: false,
      camera: { eye: { x: 0.8, y: 0.8, z: 0.3 }, up: { x: 0, y: 0, z: 1 } } },
    showlegend: false, margin: { l: 0, r: 0, t: 300, b: -180 }, autosize: true,
  };

  const plotEl = document.getElementById('sphere-plot');
  if (!isMobileDevice) {
  await Plotly.newPlot(plotEl, traces, layout, {
    responsive: true, displayModeBar: false, scrollZoom: false, doubleClick: false,
  });

  // Block Plotly from handling wheel events — let browser scroll natively
  plotEl.addEventListener('wheel', function (e) {
    e.stopImmediatePropagation();
  }, { capture: true });

  // --- Custom nearest-point hover tooltip ---
  const hoverTip = document.createElement('div');
  hoverTip.className = 'sphere-hover-tip';
  hoverTip.style.cssText = 'position:absolute;display:none;pointer-events:none;z-index:50;' +
    'background:rgba(10,10,20,0.92);border:1px solid #2a2a3a;border-radius:6px;padding:8px 12px;' +
    'font:11px/1.5 Inter,sans-serif;color:#e8e4dc;max-width:320px;white-space:normal;';
  plotEl.style.position = 'relative';
  plotEl.appendChild(hoverTip);

  function projectPoint(px, py, pz) {
    try {
      const glplot = plotEl._fullLayout.scene._scene.glplot;
      const m = glplot.camera.matrix;
      const clipW = m[3] * px + m[7] * py + m[11] * pz + m[15];
      if (clipW <= 0) return null;
      const ndcX = (m[0] * px + m[4] * py + m[8] * pz + m[12]) / clipW;
      const ndcY = (m[1] * px + m[5] * py + m[9] * pz + m[13]) / clipW;
      const canvas = glplot.canvas || plotEl.querySelector('canvas');
      const dpr = window.devicePixelRatio || 1;
      const canvasRect = canvas.getBoundingClientRect();
      const plotRect = plotEl.getBoundingClientRect();
      const offX = canvasRect.left - plotRect.left;
      const offY = canvasRect.top - plotRect.top;
      return [offX + (ndcX + 1) * 0.5 * canvasRect.width,
              offY + (1 - ndcY) * 0.5 * canvasRect.height];
    } catch (_) { return null; }
  }

  // --- Double-click to smoothly zoom into a region ---
  const DEFAULT_EYE = { x: 0.8, y: 0.8, z: 0.3 };
  let zoomAnimating = false;

  function animateCamera(fromEye, toEye, duration, onDone) {
    zoomAnimating = true;
    const start = performance.now();
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const e = ease(t);
      const eye = {
        x: fromEye.x + (toEye.x - fromEye.x) * e,
        y: fromEye.y + (toEye.y - fromEye.y) * e,
        z: fromEye.z + (toEye.z - fromEye.z) * e,
      };
      Plotly.relayout(plotEl, { 'scene.camera.eye': eye });
      if (t < 1) { requestAnimationFrame(step); }
      else {
        zoomAnimating = false;
        radius = Math.sqrt(toEye.x * toEye.x + toEye.y * toEye.y);
        camZ = toEye.z;
        angle = Math.atan2(toEye.y, toEye.x);
        if (onDone) onDone();
      }
    }
    requestAnimationFrame(step);
  }

  let lastClickedPoint = null;
  let lastHoveredPoint = null;
  let viewerMode = false;
  const sphereSection = document.querySelector('.sphere-section');
  const viewerExitBtn = document.getElementById('viewer-exit');

  function getEye() {
    try { return plotEl._fullLayout.scene._scene.getCamera().eye; }
    catch (_) { return DEFAULT_EYE; }
  }

  // Nearest-point hover via mousemove + 3D-to-2D projection
  let hoverRafId = null;
  plotEl.addEventListener('mousemove', function (e) {
    if (hoverRafId) return;
    hoverRafId = requestAnimationFrame(() => {
      hoverRafId = null;
      const rect = plotEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Only activate when cursor is within the visual sphere circle
      const cx = rect.width / 2, cy = rect.height / 2;
      const sphereR = Math.min(rect.width, rect.height) * 0.26;
      const dCenter = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
      if (dCenter > sphereR) {
        hoverTip.style.display = 'none';
        return;
      }

      const eye = getEye();
      let nearest = null, minDist = Infinity;
      for (const pt of allPts3D) {
        if (pt.x * eye.x + pt.y * eye.y + pt.z * eye.z <= 0) continue;
        const sp = projectPoint(pt.x, pt.y, pt.z);
        if (!sp) continue;
        const d2 = (sp[0] - mx) ** 2 + (sp[1] - my) ** 2;
        if (d2 < minDist) { minDist = d2; nearest = pt; }
      }

      if (nearest) {
        hoverTip.innerHTML = nearest.text;
        const sp = projectPoint(nearest.x, nearest.y, nearest.z);
        if (sp) {
          hoverTip.style.left = (sp[0] + 14) + 'px';
          hoverTip.style.top = (sp[1] - 14) + 'px';
        }
        hoverTip.style.display = 'block';
        lastHoveredPoint = { x: nearest.x, y: nearest.y, z: nearest.z };
      } else {
        hoverTip.style.display = 'none';
      }
    });
  });

  plotEl.addEventListener('mouseleave', () => { hoverTip.style.display = 'none'; });

  plotEl.addEventListener('click', function () {
    if (lastHoveredPoint) lastClickedPoint = lastHoveredPoint;
  });

  function enterViewer(pt) {
    if (zoomAnimating || viewerMode) return;
    viewerMode = true;
    sphereSection.classList.add('viewer-mode');
    spinning = false;

    const sx = pt.x, sy = pt.y, sz = pt.z;
    const norm = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
    const d = 1.25;
    const toEye = { x: sx / norm * d, y: sy / norm * d, z: sz / norm * d };
    let fromEye;
    try { fromEye = { ...plotEl._fullLayout.scene._scene.getCamera().eye }; }
    catch (_) { fromEye = { ...DEFAULT_EYE }; }
    animateCamera(fromEye, toEye, 900);
  }

  function exitViewer() {
    if (!viewerMode) return;
    viewerMode = false;
    sphereSection.classList.remove('viewer-mode');
    let fromEye;
    try { fromEye = { ...plotEl._fullLayout.scene._scene.getCamera().eye }; }
    catch (_) { fromEye = { ...DEFAULT_EYE }; }
    animateCamera(fromEye, DEFAULT_EYE, 700, () => {
      angle = Math.atan2(DEFAULT_EYE.y, DEFAULT_EYE.x);
      startRotation();
    });
  }

  plotEl.addEventListener('dblclick', function (e) {
    e.preventDefault();
    e.stopPropagation();
  });

  viewerExitBtn.addEventListener('click', exitViewer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewerMode) exitViewer();
  });

  // --- Default to 100 minimum votes ---
  const MIN_VOTES_DEFAULT = 100;
  {
    const visibility = traces.map((_, i) => {
      if (i >= arcTraceStart && i < arcTraceEnd) {
        return voteBins[Math.floor((i - arcTraceStart) / 2)].vote_min >= MIN_VOTES_DEFAULT;
      }
      return true;
    });
    Plotly.restyle(plotEl, { visible: visibility });
  }
  } // end if (!isMobileDevice) — Plotly init & sphere interactions

  // Stats (desktop only — sphere not used on mobile)
  if (!isMobileDevice) {
    document.getElementById('stat-verses').textContent = stats.total_verses.toLocaleString();
    document.getElementById('stat-books').textContent = stats.books;
    document.getElementById('stat-refs').textContent = stats.arcs_in_dataset.toLocaleString();
    const legVerseMeth = document.getElementById('leg-verse-count-meth');
    const legEdgeMeth = document.getElementById('leg-edge-count-meth');
    if (legVerseMeth) legVerseMeth.textContent = stats.total_verses.toLocaleString();
    if (legEdgeMeth) legEdgeMeth.textContent = stats.arcs_in_dataset.toLocaleString();
    const legIntra = document.getElementById('leg-intra-count');
    const legInter = document.getElementById('leg-inter-count');
    if (legIntra) legIntra.textContent = (stats.dataset_intra || 0).toLocaleString();
    if (legInter) legInter.textContent = (stats.dataset_inter || 0).toLocaleString();
  }

  // --- Semantic search (Bible-trained MPNet via ONNX in browser) ---
  const SEARCH_DIM = 768;
  const searchInput = document.getElementById('home-chat-input');
  const searchStatus = document.getElementById('home-search-status');
  const homeSearchResults = document.getElementById('home-search-results');
  const searchDesc = document.getElementById('home-search-results-desc');
  const searchList = document.getElementById('home-search-results-list');
  const highlightTraceIdx = traces.length;
  let focusTraceIdx = highlightTraceIdx + 1;

  if (!isMobileDevice) {
    Plotly.addTraces(plotEl, [
      { type: 'scatter3d', mode: 'markers',
        x: [], y: [], z: [], text: [], hoverinfo: 'text', showlegend: false,
        marker: { size: 5, color: '#ffffff', opacity: 0.95 }, hoverlabel: hoverCfg },
      { type: 'scatter3d', mode: 'markers',
        x: [], y: [], z: [], text: [], hoverinfo: 'text', showlegend: false,
        marker: { size: 12, color: 'rgba(201,168,76,0.9)', symbol: 'diamond',
          line: { width: 2, color: '#fff' } }, hoverlabel: hoverCfg },
    ]);
    focusTraceIdx = highlightTraceIdx + 1;
  }

  // Translation state — controlled per-modal, defaults to KJV in search results
  let activeTrans = 'kjv';
  function refreshResultTexts() {
    searchList.querySelectorAll('.sr-item').forEach(item => {
      const textEl = item.querySelector('.sr-text');
      if (textEl) {
        textEl.textContent = activeTrans === 'bsb' && item.dataset.textBsb
          ? item.dataset.textBsb : item.dataset.text;
      }
      const pEl = item.querySelector('.sr-passage-text');
      if (pEl) {
        const raw = activeTrans === 'bsb' && item.dataset.passageBsb
          ? item.dataset.passageBsb : item.dataset.passageKjv || '';
        pEl.textContent = raw.length > 200 ? raw.slice(0, 200) + '\u2026' : raw;
      }
    });
  }

  let searchMode = 'verses';

  const searchFilterBooks = new Set(allBookNums);

  // --- Book filter dropdown ---
  const filterBtn = document.getElementById('search-filter-btn');
  const filterLabel = document.getElementById('search-filter-label');
  const filterDropdown = document.getElementById('search-filter-dropdown');
  const filterBackdrop = document.getElementById('search-filter-backdrop');

  function openFilterPanel() {
    filterDropdown.classList.add('open');
    filterBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeFilterPanel() {
    filterDropdown.classList.remove('open');
    filterBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (filterDropdown.classList.contains('open')) closeFilterPanel();
    else openFilterPanel();
  });
  filterBackdrop.addEventListener('click', closeFilterPanel);
  document.getElementById('sfd-done').addEventListener('click', closeFilterPanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filterDropdown.classList.contains('open')) closeFilterPanel();
  });

  function updateFilterLabel() {
    const n = searchFilterBooks.size;
    const total = allBookNums.length;
    if (n === total) { filterLabel.textContent = 'All books'; filterBtn.classList.remove('filtered'); }
    else if (n === 0) { filterLabel.textContent = 'None'; filterBtn.classList.add('filtered'); }
    else { filterLabel.textContent = n + ' / ' + total + ' books'; filterBtn.classList.add('filtered'); }
  }

  function syncTestamentTrack(testament) {
    const books = allBookNums.filter(bn => bookTestament[bn] === testament);
    const anyOn = books.some(bn => searchFilterBooks.has(bn));
    const allOn = books.every(bn => searchFilterBooks.has(bn));
    const toggle = document.getElementById(testament === 'OT' ? 'sfd-ot-toggle' : 'sfd-nt-toggle');
    const track = toggle.querySelector('.sfd-track');
    const cb = track.querySelector('input');
    track.classList.toggle('on', anyOn);
    track.classList.toggle('partial', anyOn && !allOn);
    cb.checked = allOn;
    cb.indeterminate = anyOn && !allOn;
  }

  ['OT', 'NT'].forEach(testament => {
    const booksEl = document.getElementById(testament === 'OT' ? 'sfd-ot-books' : 'sfd-nt-books');
    const toggle = document.getElementById(testament === 'OT' ? 'sfd-ot-toggle' : 'sfd-nt-toggle');
    const track = toggle.querySelector('.sfd-track');
    const masterCb = track.querySelector('input');

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isPartial = masterCb.indeterminate;
      const nowOn = isPartial ? true : !masterCb.checked;
      masterCb.checked = nowOn;
      masterCb.indeterminate = false;
      track.classList.remove('partial');
      track.classList.toggle('on', nowOn);
      const books = allBookNums.filter(bn => bookTestament[bn] === testament);
      books.forEach(bn => { if (nowOn) searchFilterBooks.add(bn); else searchFilterBooks.delete(bn); });
      booksEl.querySelectorAll('.sfd-book').forEach(row => row.classList.toggle('off', !nowOn));
      updateFilterLabel();
      if (searchInput.value.trim().length >= 1) doSearch();
    });

    booksEl.addEventListener('click', (e) => { e.stopPropagation(); });

    allBookNums.filter(bn => bookTestament[bn] === testament).forEach(bn => {
      const row = document.createElement('div');
      row.className = 'sfd-book';
      row.innerHTML = `<span class="sfd-book-swatch" style="background:${bookColor(bn)}"></span><span>${bookNames[bn]}</span>`;
      row.addEventListener('click', () => {
        const wasOn = searchFilterBooks.has(bn);
        if (wasOn) searchFilterBooks.delete(bn); else searchFilterBooks.add(bn);
        row.classList.toggle('off', wasOn);
        syncTestamentTrack(testament);
        updateFilterLabel();
        if (searchInput.value.trim().length >= 1) doSearch();
      });
      booksEl.appendChild(row);
    });
  });

  updateFilterLabel();

  // Embeddings (uint8-quantised, loaded lazily)
  let verseEmbU8 = null;
  let passageEmbU8 = null;
  let passageData = null;
  let searchPipeline = null;
  let searchReady = false;
  let searchLoading = false;

  function showSearchError(msg) {
    const bar = document.getElementById('search-loading-bar');
    const textEl = document.getElementById('search-loading-text');
    if (bar && textEl) {
      textEl.textContent = msg;
      textEl.style.color = 'rgba(220,80,80,0.6)';
      bar.classList.add('active');
      setTimeout(() => { bar.classList.remove('active'); textEl.style.color = ''; }, 5000);
    }
  }

  const defaultPlaceholder = searchInput.placeholder;
  let searchLoadingDots = null;

  const searchLoadingBarEl = document.getElementById('search-loading-bar');
  const searchLoadingTextEl = document.getElementById('search-loading-text');
  const searchLoadingFillEl = document.getElementById('search-loading-fill');

  function showSearchLoading() {
    searchLoadingFillEl.style.width = '0%';
    searchLoadingTextEl.textContent = 'Loading search model';
    searchLoadingBarEl.classList.add('active');
    let pct = 0;
    searchLoadingDots = setInterval(() => {
      pct = Math.min(pct + Math.random() * 8 + 2, 92);
      searchLoadingFillEl.style.width = pct + '%';
    }, 300);
  }

  function hideSearchLoading() {
    if (searchLoadingDots) { clearInterval(searchLoadingDots); searchLoadingDots = null; }
    searchLoadingFillEl.style.width = '100%';
    setTimeout(() => searchLoadingBarEl.classList.remove('active'), 300);
  }

  async function loadSearchAssets() {
    if (searchReady || searchLoading) return;
    searchLoading = true;
    showSearchLoading();

    try {
      const embResp = fetch('data/search_embeddings.bin').then(r => {
        if (!r.ok) throw new Error('search_embeddings.bin: ' + r.status);
        return r.arrayBuffer();
      });
      const passEmbResp = fetch('data/passage_embeddings.bin').then(r => {
        if (!r.ok) throw new Error('passage_embeddings.bin: ' + r.status);
        return r.arrayBuffer();
      });
      const passJsonResp = fetch('data/passages.json').then(r => {
        if (!r.ok) throw new Error('passages.json: ' + r.status);
        return r.json();
      });

      const [embBuf, passEmbBuf, passJson, bsbJson, transformers] = await Promise.all([
        embResp, passEmbResp, passJsonResp, loadBsb(),
        import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'),
      ]);
      verseEmbU8 = new Uint8Array(embBuf);
      passageEmbU8 = new Uint8Array(passEmbBuf);
      passageData = passJson;

      transformers.env.allowLocalModels = true;
      transformers.env.allowRemoteModels = false;
      const base = new URL('./', document.baseURI).href;
      transformers.env.localModelPath = base;
      if (transformers.env.backends?.onnx?.wasm) {
        transformers.env.backends.onnx.wasm.numThreads = 1;
      }
      searchPipeline = await transformers.pipeline('feature-extraction', 'model', {
        local_files_only: true,
        quantized: true,
      });
      searchReady = true;
      searchStatus.innerHTML = '';
      hideSearchLoading();
    } catch (err) {
      console.error('Search model load failed:', err);
      hideSearchLoading();
      showSearchError('Search failed: ' + err.message);
      searchStatus.innerHTML = '';
    } finally {
      searchLoading = false;
    }
  }

  // Encode query → normalised float32 embedding
  async function embedQuery(text) {
    const output = await searchPipeline(text, { pooling: 'mean', normalize: true });
    return output.tolist()[0];
  }

  function rankEmbeddings(queryEmb, embU8, count) {
    const scores = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let dot = 0;
      const off = i * SEARCH_DIM;
      for (let d = 0; d < SEARCH_DIM; d++) {
        dot += queryEmb[d] * (embU8[off + d] / 127.5 - 1.0);
      }
      scores[i] = dot;
    }
    const indices = Array.from({ length: count }, (_, i) => i);
    indices.sort((a, b) => scores[b] - scores[a]);
    return indices.slice(0, 200).map(i => ({ idx: i, score: scores[i] }));
  }

  // Search event listeners are wired via the unified home input (see below)

  async function doSearch() {
    const q = searchInput.value.trim();
    if (q.length < 1) { clearSearch(); return; }
    if (!searchReady) {
      await loadSearchAssets();
      if (!searchReady) return;
    }

    searchStatus.innerHTML = '<span class="search-dot"></span>Encoding query\u2026';
    await new Promise(r => setTimeout(r, 0));

    const queryEmb = await embedQuery(q);
    searchStatus.innerHTML = '';

    if (searchMode === 'verses') {
      await doVerseResults(queryEmb);
    } else {
      await doPassageResults(queryEmb);
    }
  }

  async function doVerseResults(queryEmb) {
    const top = rankEmbeddings(queryEmb, verseEmbU8, verseEmbU8.length / SEARCH_DIM);
    const allResults = top.map(m => ({ ...m, p: pts[m.idx] }));
    const results = allResults.filter(m => searchFilterBooks.has(m.p.book_num));
    const maxScore = results.length > 0 ? results[0].score : 1;

    const bsb = bsbVerses || [];

    const shown = results.slice(0, 15);
    const hx = [], hy = [], hz = [], ht = [];
    for (const m of shown) { hx.push(m.p.sx); hy.push(m.p.sy); hz.push(m.p.sz); ht.push(`<b>${m.p.ref}</b><br><i>${wrapText(m.p.text, 60)}</i>`); }
    Plotly.restyle(plotEl, { x: [hx], y: [hy], z: [hz], text: [ht] }, [highlightTraceIdx]);

    homeSearchResults.style.display = 'none';
    void homeSearchResults.offsetHeight;
    homeSearchResults.style.display = 'block';
    document.querySelector('.page-wrap').classList.add('search-active');
    if (shown.length > 0) {
      searchDesc.innerHTML = 'Ranked by <b style="color:rgba(201,168,76,0.4);">cosine similarity</b> across all 31,102 verse embeddings.';
      searchList.innerHTML = shown.map((m, i) => {
        const pct = Math.max(0, (m.score / maxScore * 100)).toFixed(0);
        const bsbText = (bsb[m.idx] || '').replace(/"/g, '&quot;');
        const displayText = activeTrans === 'bsb' && bsbText ? bsbText : m.p.text;
        return `<div class="sr-item" data-sx="${m.p.sx}" data-sy="${m.p.sy}" data-sz="${m.p.sz}" data-ref="${m.p.ref}" data-text="${m.p.text.replace(/"/g, '&quot;')}" data-text-bsb="${bsbText}" data-mode="verse" style="cursor:pointer;animation-delay:${i * 0.04}s;">` +
          `<span class="sr-ref">${i + 1}. ${m.p.ref}</span><span class="sr-score" title="Cosine similarity">${m.score.toFixed(3)}</span>` +
          `<span class="sr-text">${displayText}</span><div class="sr-bar"><div class="sr-bar-fill" style="width:${pct}%"></div></div></div>`;
      }).join('');
      bindResultClicks();
      aimCamera(hx, hy, hz);
    } else { searchList.innerHTML = '<div style="text-align:center;color:rgba(232,228,220,0.4);font-size:0.72rem;padding:20px;">No results found.</div>'; searchDesc.innerHTML = ''; }
  }

  function doPassageResults(queryEmb) {
    const top = rankEmbeddings(queryEmb, passageEmbU8, passageData.length);
    const allResults = top.map(m => ({ ...m, psg: passageData[m.idx] }));
    const filtered = allResults.filter(m => searchFilterBooks.has(m.psg.book_num));
    const shown = filtered.slice(0, 15);
    const maxScore = shown.length > 0 ? shown[0].score : 1;

    const hx = [], hy = [], hz = [], ht = [];
    for (const m of shown) {
      for (const vi of m.psg.verse_ids) {
        const p = pts[vi];
        if (p) { hx.push(p.sx); hy.push(p.sy); hz.push(p.sz); ht.push(`<b>${p.ref}</b><br><i>${wrapText(p.text, 60)}</i>`); }
      }
    }
    Plotly.restyle(plotEl, { x: [hx], y: [hy], z: [hz], text: [ht] }, [highlightTraceIdx]);

    homeSearchResults.style.display = 'none';
    void homeSearchResults.offsetHeight;
    homeSearchResults.style.display = 'block';
    document.querySelector('.page-wrap').classList.add('search-active');
    if (shown.length > 0) {
      searchDesc.innerHTML = 'Ranked by <b style="color:rgba(201,168,76,0.4);">cosine similarity</b> across ' + passageData.length.toLocaleString() + ' passages.';
      searchList.innerHTML = shown.map((m, i) => {
        const psg = m.psg;
        const pct = Math.max(0, (m.score / maxScore * 100)).toFixed(0);
        const vids = JSON.stringify(psg.verse_ids);
        const bsbFull = (psg.text_bsb || '').replace(/"/g, '&quot;');
        const kjvFull = psg.text.replace(/"/g, '&quot;');
        const rawPreview = activeTrans === 'bsb' && psg.text_bsb ? psg.text_bsb : psg.text;
        const preview = rawPreview.length > 200 ? rawPreview.slice(0, 200) + '\u2026' : rawPreview;
        return `<div class="sr-item" data-verse-ids='${vids}' data-ref="${psg.ref}" data-title="${psg.title.replace(/"/g, '&quot;')}" data-passage-kjv="${kjvFull}" data-passage-bsb="${bsbFull}" data-mode="passage" style="cursor:pointer;animation-delay:${i * 0.04}s;">` +
          `<span class="sr-ref">${i + 1}. ${psg.ref}</span><span class="sr-score" title="Cosine similarity">${m.score.toFixed(3)}</span>` +
          `<span class="sr-title">${psg.title}</span>` +
          `<span class="sr-passage-text">${preview}</span>` +
          `<div class="sr-bar"><div class="sr-bar-fill" style="width:${pct}%"></div></div></div>`;
      }).join('');
      bindResultClicks();
      aimCamera(hx, hy, hz);
    } else { searchList.innerHTML = '<div style="text-align:center;color:rgba(232,228,220,0.4);font-size:0.72rem;padding:20px;">No results found.</div>'; searchDesc.innerHTML = ''; }
  }

  function bindResultClicks() {
    searchList.querySelectorAll('.sr-item').forEach(item => {
      item.addEventListener('click', () => focusResult(item));
    });
  }

  function aimCamera(hx, hy, hz) {
    if (!hx.length) return;
    const cx = hx.reduce((a, b) => a + b, 0) / hx.length;
    const cy = hy.reduce((a, b) => a + b, 0) / hy.length;
    const newAngle = Math.atan2(cy, cx);
    spinning = false;
    angle = newAngle;
    setCameraAtAngle(angle);
  }

  let sphereFaded = false;

  function fadeSphere() {
    if (sphereFaded) return;
    sphereFaded = true;
    Plotly.restyle(plotEl, { 'marker.opacity': [ot.bookNum.map(() => 0.06)] }, [otTraceIdx]);
    Plotly.restyle(plotEl, { 'marker.opacity': [nt.bookNum.map(() => 0.06)] }, [ntTraceIdx]);
    for (let i = arcTraceStart; i < arcTraceEnd; i++) {
      Plotly.restyle(plotEl, { 'line.width': 0.15 }, [i]);
    }
  }

  function restoreSphere() {
    if (isMobileDevice || !sphereFaded) return;
    sphereFaded = false;
    Plotly.restyle(plotEl, { 'marker.opacity': [ot.bookNum.map(() => 0.85)] }, [otTraceIdx]);
    Plotly.restyle(plotEl, { 'marker.opacity': [nt.bookNum.map(() => 0.85)] }, [ntTraceIdx]);
    for (let i = arcTraceStart; i < arcTraceEnd; i++) {
      Plotly.restyle(plotEl, { 'line.width': ARC_WIDTH }, [i]);
    }
    Plotly.restyle(plotEl, { x: [[]], y: [[]], z: [[]], text: [[]] }, [focusTraceIdx]);
    if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
  }

  function clearSearch() {
    searchStatus.innerHTML = '';
    homeSearchResults.style.display = 'none';
    searchList.innerHTML = '';
    searchDesc.innerHTML = '';
    document.querySelector('.page-wrap').classList.remove('search-active');
    if (!isMobileDevice) {
      Plotly.restyle(plotEl, { x: [[]], y: [[]], z: [[]], text: [[]] }, [highlightTraceIdx]);
      if (!sphereFaded) {
        Plotly.restyle(plotEl, { x: [[]], y: [[]], z: [[]], text: [[]] }, [focusTraceIdx]);
        if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
      }
    }
    document.querySelectorAll('.sr-item.active').forEach(el => el.classList.remove('active'));
  }

  // --- Passage modal ---
  const modalOverlay = document.getElementById('passage-modal-overlay');
  const modalRef = document.getElementById('passage-modal-ref');
  const modalTitle = document.getElementById('passage-modal-title');
  const modalBody = document.getElementById('passage-modal-body');
  const modalBodyBsb = document.getElementById('passage-modal-body-bsb');
  const pmKjvBtn = document.getElementById('pm-kjv');
  const pmBsbBtn = document.getElementById('pm-bsb');
  let pmTrans = 'kjv';

  pmKjvBtn.addEventListener('click', () => {
    pmTrans = 'kjv';
    pmKjvBtn.classList.add('active'); pmBsbBtn.classList.remove('active');
    modalBody.style.display = ''; modalBodyBsb.style.display = 'none';
  });
  pmBsbBtn.addEventListener('click', () => {
    pmTrans = 'bsb';
    pmBsbBtn.classList.add('active'); pmKjvBtn.classList.remove('active');
    modalBody.style.display = 'none'; modalBodyBsb.style.display = '';
  });

  async function openPassageModal(item) {
    const vids = JSON.parse(item.dataset.verseIds);
    const ref = item.dataset.ref;
    const title = item.dataset.title;

    modalRef.textContent = ref;
    modalTitle.textContent = title;

    const bsb = await loadBsb();

    let kjvHtml = '', bsbHtml = '';
    const passageRefs = [];
    let passageBookNum = null;
    for (const vi of vids) {
      const p = pts[vi];
      if (p) {
        const vn = p.ref.split(':').pop();
        kjvHtml += `<span class="pm-verse-num">${vn}</span>${p.text} `;
        const bsbText = bsb[vi] || '';
        if (bsbText) {
          bsbHtml += `<span class="pm-verse-num">${vn}</span>${bsbText} `;
        }
        passageRefs.push(p.ref);
        if (!passageBookNum) passageBookNum = p.book_num;
      }
    }
    modalBody.innerHTML = kjvHtml;
    modalBodyBsb.innerHTML = bsbHtml || '<span style="color:rgba(232,228,220,0.25);font-style:italic;">Modern English translation not available for this passage.</span>';

    currentModalBookNum = passageBookNum;
    currentModalRefs = passageRefs;

    pmTrans = activeTrans;
    pmKjvBtn.classList.toggle('active', pmTrans === 'kjv');
    pmBsbBtn.classList.toggle('active', pmTrans === 'bsb');
    modalBody.style.display = pmTrans === 'kjv' ? '' : 'none';
    modalBodyBsb.style.display = pmTrans === 'bsb' ? '' : 'none';

    modalOverlay.classList.add('open');
  }

  document.getElementById('passage-modal-close').addEventListener('click', () => {
    modalOverlay.classList.remove('open');
  });
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('open')) {
      modalOverlay.classList.remove('open');
    }
    if (e.key === 'Escape' && readerOverlay.classList.contains('open')) {
      readerOverlay.classList.remove('open');
    }
  });

  // --- Custom dropdown helper ---
  function setupDropdown(wrapId, triggerId, menuId, onChange) {
    const wrap = document.getElementById(wrapId);
    const trigger = document.getElementById(triggerId);
    const menu = document.getElementById(menuId);
    let value = null;
    const dd = {
      get value() { return value; },
      set value(v) {
        value = v;
        const items = menu.querySelectorAll('.cd-item[data-value]');
        items.forEach(it => {
          it.classList.toggle('active', it.dataset.value === String(v));
        });
        const active = menu.querySelector('.cd-item.active');
        if (active) trigger.querySelector('span').textContent = active.dataset.triggerLabel || active.dataset.label || active.textContent.trim();
      },
      setItems(items, groupBy) {
        const listContainer = menu.querySelector('#cd-book-list') || menu;
        let html = '';
        if (groupBy) {
          const groups = {};
          items.forEach(it => {
            const g = groupBy(it);
            if (!groups[g]) groups[g] = [];
            groups[g].push(it);
          });
          Object.keys(groups).forEach((g, gi) => {
            if (gi > 0) html += '<div class="cd-divider"></div>';
            html += `<div class="cd-group-label">${g}</div>`;
            groups[g].forEach(it => {
              html += `<div class="cd-item" data-value="${it.value}" data-label="${it.label}"><span class="cd-check"><svg viewBox="0 0 12 12" fill="none" stroke="rgba(201,168,76,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6l3 3 5-5"/></svg></span>${it.label}</div>`;
            });
          });
        } else {
          items.forEach(it => {
            const tl = it.triggerLabel ? ` data-trigger-label="${it.triggerLabel}"` : '';
            html += `<div class="cd-item" data-value="${it.value}" data-label="${it.label}"${tl}><span class="cd-check"><svg viewBox="0 0 12 12" fill="none" stroke="rgba(201,168,76,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6l3 3 5-5"/></svg></span>${it.label}</div>`;
          });
        }
        listContainer.innerHTML = html;
        menu.querySelectorAll('.cd-item').forEach(it => {
          it.addEventListener('click', () => {
            dd.value = it.dataset.value;
            wrap.classList.remove('open');
            if (onChange) onChange(it.dataset.value);
          });
        });
      },
      close() { wrap.classList.remove('open'); },
    };
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.cd-wrap.open').forEach(w => { if (w !== wrap) w.classList.remove('open'); });
      wrap.classList.toggle('open');
      const searchInput = menu.querySelector('.cd-menu-search input');
      if (searchInput && wrap.classList.contains('open')) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        setTimeout(() => searchInput.focus(), 50);
      }
    });
    return dd;
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cd-wrap')) {
      document.querySelectorAll('.cd-wrap.open').forEach(w => w.classList.remove('open'));
    }
  });

  // --- Bible Reader ---
  const readerOverlay = document.getElementById('reader-overlay');
  const readerInner = document.getElementById('reader-inner');
  const readerContent = document.getElementById('reader-content');
  const readerKjvBtn = document.getElementById('reader-kjv');
  const readerBsbBtn = document.getElementById('reader-bsb');
  let readerTrans = 'kjv';
  let readerBookNum = 1;
  let readerHighlightRefs = new Set();

  const bookChapters = {};
  for (const p of pts) {
    const cv = p.ref.substring(p.book.length + 1);
    const ch = parseInt(cv.split(':')[0], 10);
    if (!bookChapters[p.book_num]) bookChapters[p.book_num] = new Set();
    bookChapters[p.book_num].add(ch);
  }

  const readerBookSelect = setupDropdown('cd-book', 'cd-book-trigger', 'cd-book-menu', (val) => {
    readerHighlightRefs.clear();
    renderBook(parseInt(val, 10), null);
    if (typeof clearChat === 'function') clearChat();
  });
  const otBooks = allBookNums.filter(bn => bn <= 39);
  const ntBooks = allBookNums.filter(bn => bn > 39);
  const bookItems = allBookNums.map(bn => ({ value: String(bn), label: bookNames[bn] }));
  const bookListEl = document.getElementById('cd-book-list');
  readerBookSelect.setItems(bookItems, (it) => parseInt(it.value) <= 39 ? 'Old Testament' : 'New Testament');
  readerBookSelect.value = '1';

  const bookSearchInput = document.getElementById('cd-book-search');
  bookSearchInput.addEventListener('input', () => {
    const q = bookSearchInput.value.toLowerCase();
    bookListEl.querySelectorAll('.cd-item').forEach(it => {
      it.style.display = it.dataset.label.toLowerCase().includes(q) ? '' : 'none';
    });
    bookListEl.querySelectorAll('.cd-group-label, .cd-divider').forEach(el => {
      el.style.display = q ? 'none' : '';
    });
  });

  const readerChapterSelect = setupDropdown('cd-chapter', 'cd-chapter-trigger', 'cd-chapter-menu', (val) => {
    const ch = parseInt(val, 10);
    const el = document.getElementById('reader-ch-' + ch);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const chapters = [...(bookChapters[readerBookNum] || [])].sort((a, b) => a - b);
    updateNavButtons(chapters);
    if (typeof loadReaderChatHistory === 'function') loadReaderChatHistory();
  });

  function parseChapterVerse(ref, bookName) {
    const cv = ref.substring(bookName.length + 1);
    const parts = cv.split(':');
    return { chapter: parseInt(parts[0], 10), verse: parseInt(parts[1], 10) };
  }

  const bookVerseIndex = {};
  const verseCounts = {};
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!bookVerseIndex[p.book_num]) bookVerseIndex[p.book_num] = [];
    const cv = parseChapterVerse(p.ref, p.book);
    bookVerseIndex[p.book_num].push({ idx: i, chapter: cv.chapter, verse: cv.verse, ref: p.ref });
    const bn = p.book_num;
    if (!chapterCounts[bn] || cv.chapter > chapterCounts[bn]) chapterCounts[bn] = cv.chapter;
    const vcKey = bn + '_' + cv.chapter;
    if (!verseCounts[vcKey] || cv.verse > verseCounts[vcKey]) verseCounts[vcKey] = cv.verse;
  }

  async function renderBook(bookNum, scrollToRef) {
    readerBookNum = bookNum;
    readerBookSelect.value = String(bookNum);
    const bsb = await loadBsb();
    const chapters = [...(bookChapters[bookNum] || [])].sort((a, b) => a - b);

    readerChapterSelect.setItems(chapters.map(ch => ({ value: String(ch), label: 'Chapter ' + ch })));

    const entries = bookVerseIndex[bookNum] || [];
    const byChapter = {};
    for (const e of entries) {
      if (!byChapter[e.chapter]) byChapter[e.chapter] = [];
      byChapter[e.chapter].push(e);
    }

    let html = '';
    let scrollTargetId = '';
    for (const ch of chapters) {
      html += `<div class="reader-chapter-heading" id="reader-ch-${ch}">Chapter ${ch}</div>`;
      const vv = byChapter[ch] || [];
      for (const v of vv) {
        const p = pts[v.idx];
        const isHighlight = readerHighlightRefs.has(v.ref);
        const verseId = `reader-v-${ch}-${v.verse}`;
        if (isHighlight && !scrollTargetId) scrollTargetId = verseId;

        const text = readerTrans === 'bsb' && bsb[v.idx] ? bsb[v.idx] : p.text;
        html += `<span class="reader-verse${isHighlight ? ' highlight' : ''}" id="${verseId}">` +
          `<span class="reader-verse-num">${v.verse}</span>` +
          `<span class="reader-verse-text">${text}</span></span> `;
      }
    }

    const isVisible = readerOverlay.classList.contains('visible');
    if (isVisible && readerInner.innerHTML) {
      readerInner.style.transition = 'opacity 0.25s ease';
      readerInner.style.opacity = '0';
      await new Promise(r => setTimeout(r, 250));
    }

    readerInner.innerHTML = html;

    if (scrollToRef && scrollTargetId) {
      requestAnimationFrame(() => {
        const target = document.getElementById(scrollTargetId);
        if (target) {
          target.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      });
    }

    if (scrollToRef) {
      const cv = parseChapterVerse(scrollToRef, bookNames[bookNum]);
      readerChapterSelect.value = String(cv.chapter);
      updateNavButtons(chapters);
    } else {
      readerContent.scrollTop = 0;
      if (chapters.length) readerChapterSelect.value = String(chapters[0]);
      updateNavButtons(chapters);
    }

    if (isVisible) {
      requestAnimationFrame(() => {
        readerInner.style.opacity = '1';
        setTimeout(() => { readerInner.style.transition = ''; }, 300);
      });
    }
  }

  function updateNavButtons(chapters) {
    const cur = parseInt(readerChapterSelect.value, 10);
    document.getElementById('reader-prev').disabled = cur <= chapters[0];
    document.getElementById('reader-next').disabled = cur >= chapters[chapters.length - 1];
  }

  const readerTransition = document.getElementById('reader-transition');
  let readerTransitionActive = false;

  function openReader(bookNum, highlightRefs) {
    readerHighlightRefs = new Set(highlightRefs);
    modalOverlay.classList.remove('open');
    syncReaderPickerState();
    if (isMobileDevice) {
      var barH = document.documentElement.clientHeight - window.innerHeight;
      readerOverlay.style.paddingBottom = (barH > 0 ? barH : 20) + 'px';
    }

    const scrollRef = highlightRefs.length > 0 ? highlightRefs[0] : null;

    if (readerTransitionActive) {
      readerOverlay.classList.add('open', 'visible');
      renderBook(bookNum, scrollRef);
      return;
    }
    readerTransitionActive = true;

    readerTransition.classList.remove('phase-1', 'phase-2');
    readerTransition.classList.add('active');

    requestAnimationFrame(() => {
      readerTransition.classList.add('phase-1');
    });

    // Prepare reader underneath while Bible is showing
    setTimeout(() => {
      renderBook(bookNum, scrollRef);
      readerOverlay.classList.add('open');
      requestAnimationFrame(() => {
        readerOverlay.classList.add('visible');
      });
    }, 1400);

    // Fade out the Bible transition overlay simultaneously
    setTimeout(() => {
      readerTransition.classList.add('phase-2');
    }, 2000);

    // Cleanup after both fades complete
    setTimeout(() => {
      readerTransition.classList.remove('active', 'phase-1', 'phase-2');
      readerTransitionActive = false;
      showReaderOnboarding();
    }, 3300);
  }

  function showReaderOnboarding() {
    if (localStorage.getItem('bv_reader_onboard_done2')) return;
    var overlay = document.getElementById('reader-onboard-overlay');
    var tHl = document.getElementById('reader-tooltip-hl');
    if (!tHl) return;

    var firstNum = readerContent.querySelector('.reader-verse-num');
    if (!firstNum) return;

    overlay.style.display = 'block';
    firstNum.style.position = 'relative';
    firstNum.style.zIndex = '99999';
    var r1 = firstNum.getBoundingClientRect();
    tHl.style.top = (r1.bottom + 10) + 'px';
    tHl.style.left = '16px';
    tHl.style.display = 'block';

    document.getElementById('reader-mt-next-hl').addEventListener('click', function() {
      tHl.style.display = 'none';
      overlay.style.display = 'none';
      firstNum.style.position = '';
      firstNum.style.zIndex = '';
      localStorage.setItem('bv_reader_onboard_done2', '1');
    });
  }

  function syncReaderPickerState() {
    if (chatModelChosen || readerModelChosen || localStorage.getItem('bv_openai_key') || isMobileDevice) {
      showReaderChatUI();
    } else {
      readerModelPicker.style.display = '';
      readerChatHeader.style.display = 'none';
      chatMsgContainer.style.display = 'none';
      readerChatInputWrap.style.display = 'none';
      readerChatDisclaimer.style.display = 'none';
    }
  }

  document.getElementById('reader-close').addEventListener('click', () => {
    readerOverlay.classList.remove('open', 'visible');
    hideVersePopover();
  });

  // Mobile: show settings gear, toggle popup
  var readerSettingsToggle = document.getElementById('reader-settings-toggle');
  var readerSettingsPopup = document.getElementById('reader-settings-popup');
  if (isMobileDevice && readerSettingsToggle && readerSettingsPopup) {
    readerSettingsToggle.style.display = '';
    readerSettingsToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      readerSettingsPopup.classList.toggle('open');
    });
    document.addEventListener('click', function() {
      readerSettingsPopup.classList.remove('open');
    });
    readerSettingsPopup.addEventListener('click', function(e) { e.stopPropagation(); });

    var popupKjv = document.getElementById('reader-popup-kjv');
    var popupBsb = document.getElementById('reader-popup-bsb');
    var origKjv = document.getElementById('reader-kjv');
    var origBsb = document.getElementById('reader-bsb');
    if (popupKjv && popupBsb && origKjv && origBsb) {
      popupKjv.addEventListener('click', function() {
        origKjv.click();
        popupKjv.classList.add('active');
        popupBsb.classList.remove('active');
      });
      popupBsb.addEventListener('click', function() {
        origBsb.click();
        popupBsb.classList.add('active');
        popupKjv.classList.remove('active');
      });
    }
  }

  document.getElementById('reader-prev').addEventListener('click', () => {
    const chapters = [...(bookChapters[readerBookNum] || [])].sort((a, b) => a - b);
    const cur = parseInt(readerChapterSelect.value, 10);
    const idx = chapters.indexOf(cur);
    if (idx > 0) {
      readerChapterSelect.value = String(chapters[idx - 1]);
      const el = document.getElementById('reader-ch-' + chapters[idx - 1]);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateNavButtons(chapters);
    }
  });
  document.getElementById('reader-next').addEventListener('click', () => {
    const chapters = [...(bookChapters[readerBookNum] || [])].sort((a, b) => a - b);
    const cur = parseInt(readerChapterSelect.value, 10);
    const idx = chapters.indexOf(cur);
    if (idx < chapters.length - 1) {
      readerChapterSelect.value = String(chapters[idx + 1]);
      const el = document.getElementById('reader-ch-' + chapters[idx + 1]);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateNavButtons(chapters);
    }
  });

  readerKjvBtn.addEventListener('click', () => {
    readerTrans = 'kjv';
    readerKjvBtn.classList.add('active');
    readerBsbBtn.classList.remove('active');
    const scrollRef = readerHighlightRefs.size > 0 ? [...readerHighlightRefs][0] : null;
    renderBook(readerBookNum, scrollRef);
  });
  readerBsbBtn.addEventListener('click', () => {
    readerTrans = 'bsb';
    readerBsbBtn.classList.add('active');
    readerKjvBtn.classList.remove('active');
    const scrollRef = readerHighlightRefs.size > 0 ? [...readerHighlightRefs][0] : null;
    renderBook(readerBookNum, scrollRef);
  });

  // Scroll spy: update chapter select as user scrolls
  readerContent.addEventListener('scroll', () => {
    const headings = readerInner.querySelectorAll('.reader-chapter-heading');
    let active = null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= 100) active = h;
    }
    if (active) {
      const ch = parseInt(active.id.replace('reader-ch-', ''), 10);
      if (parseInt(readerChapterSelect.value, 10) !== ch) {
        readerChapterSelect.value = String(ch);
        const chapters = [...(bookChapters[readerBookNum] || [])].sort((a, b) => a - b);
        updateNavButtons(chapters);
      }
    }
  });

  // Wire the "Read in context" button from the modal
  let currentModalBookNum = null;
  let currentModalRefs = [];

  document.getElementById('pm-read-context').addEventListener('click', () => {
    if (currentModalBookNum) openReader(currentModalBookNum, currentModalRefs);
  });

  // (reader-cta-btn removed; functionality now in home-chat suggestion cards)

  // --- Reader Chat (AI Q&A) ---
  const chatMsgContainer = document.getElementById('reader-chat-messages');
  const chatInput = document.getElementById('reader-chat-input');
  const chatSendBtn = document.getElementById('reader-chat-send');
  const chatSettingsPanel = document.getElementById('reader-chat-settings');
  const chatSettingsBtn = document.getElementById('reader-chat-settings-btn'); // may be null
  const chatApiKeyInput = document.getElementById('reader-chat-api-key');
  const chatKeySaveBtn = document.getElementById('reader-chat-key-save');
  let chatHistory = [];
  let chatStreaming = false;

  function getReaderChatKey() {
    return 'bv_reader_chat_' + readerBookNum + '_' + (readerChapterSelect ? readerChapterSelect.value : '1');
  }
  function saveReaderChatHistory() {
    try { localStorage.setItem(getReaderChatKey(), JSON.stringify(chatHistory)); } catch(e) {}
  }
  function loadReaderChatHistory() {
    chatHistory = JSON.parse(localStorage.getItem(getReaderChatKey()) || '[]');
    renderChat();
  }
  let llmEngine = null;
  let llmCurrentModel = null;

  const LLM_MODELS = [
    {
      key: 'standard', id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Logos (Standard)', menu: 'Standard', vram: '2.0 GB',
      sysPrompt: 'You are a Bible companion. Be conversational and super concise. Use as few words as possible while still answering sufficiently. Help the user understand. Cite relevant verses when they strengthen your answer.',
      sysReaderPrompt: 'You are a Bible companion. The user is reading {book}, Chapter {ch}. Answer from the text below.\n\nBe conversational and super concise. Use as few words as possible while still answering sufficiently. Help the user understand. Cite verse numbers when they strengthen your answer.\n\n{text}',
      contextLimit: 3000,
    },
    {
      key: 'max', id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Logos Max', menu: 'Max', vram: '3.7 GB',
      sysPrompt: 'You are a Bible assistant. Be conversational, but as blunt and concise as possible. Say as few words as possible while answering sufficiently. Be as concise as possible.',
      sysReaderPrompt: 'You are a Bible assistant. The user is reading {book}, Chapter {ch}. Be conversational, but as blunt and concise as possible. Say as few words as possible while answering sufficiently. Cite verse numbers.\n\n{text}',
      contextLimit: 3000,
    },
    {
      key: 'genius', id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Logos (Genius Mode)', menu: 'Genius Mode', vram: '3.7 GB',
      sysPrompt: 'You are a relentless Bible debate opponent. Channel Dostoevsky and Nietzsche. Be confrontational, blunt, and devastatingly concise. Challenge every assumption. Win every debate with intellectual honesty, not rhetoric. Be incredibly high IQ. Use as few words as possible. Cite verses only as weapons. Never comfort. Never concede unless logically forced. Your default position is in fierce support of Christianity. Never compromise your position.',
      sysReaderPrompt: 'You are a relentless Bible debate opponent. The user is reading {book}, Chapter {ch}. Answer from the text below.\n\nChannel Dostoevsky and Nietzsche. Be confrontational, blunt, and devastatingly concise. Challenge every assumption. Be incredibly high IQ. Use as few words as possible. Cite verse numbers only as weapons. Never comfort. Never concede unless logically forced. Your default position is in fierce support of Christianity. Never compromise your position.\n\n{text}',
      contextLimit: 3000,
    },
  ];

  function getModelConfig() {
    const key = getSelectedModel();
    return LLM_MODELS.find(m => m.key === key) || LLM_MODELS[0];
  }

  const chatModelSelect = setupDropdown('cd-model', 'cd-model-trigger', 'cd-model-menu', async (val) => {
    localStorage.setItem('bv_llm_model', val);
    try { homeChatModelSelect.value = val; } catch (_) {}
    const underlying = (LLM_MODELS.find(m => m.key === val) || LLM_MODELS[0]).id;
    if (!localStorage.getItem('bv_openai_key') && !isMobileDevice && navigator.gpu && llmCurrentModel !== underlying) {
      chatHistory = [];
      renderChat();
      await showModelLoading(val);
    }
  });
  chatModelSelect.setItems(LLM_MODELS.map(m => ({ value: m.key, label: m.menu, triggerLabel: m.label })));
  const storedModel = localStorage.getItem('bv_llm_model');
  if (storedModel && LLM_MODELS.find(m => m.key === storedModel)) {
    chatModelSelect.value = storedModel;
  } else {
    chatModelSelect.value = LLM_MODELS[0].key;
  }

  let mobileSelectedModel = 'standard';
  const mobileModelLabel = document.getElementById('mobile-model-label');
  const mobileModelTrigger = document.getElementById('mobile-model-trigger');
  const mobileModelMenu = document.getElementById('mobile-model-menu');
  const mobileModelName = document.getElementById('mobile-model-name');
  if (mobileModelTrigger) {
    mobileModelTrigger.addEventListener('click', function(e) {
      e.stopPropagation();
      mobileModelLabel.classList.toggle('open');
    });
    mobileModelMenu.querySelectorAll('.mobile-model-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        mobileModelMenu.querySelector('.active')?.classList.remove('active');
        btn.classList.add('active');
        mobileSelectedModel = btn.dataset.model;
        mobileModelName.textContent = btn.textContent;
        mobileModelLabel.classList.remove('open');
        if (readerMobileMenu) {
          readerMobileMenu.querySelector('.active')?.classList.remove('active');
          var match = readerMobileMenu.querySelector('[data-model="' + btn.dataset.model + '"]');
          if (match) match.classList.add('active');
          if (readerMobileName) readerMobileName.textContent = btn.textContent;
        }
      });
    });
    document.addEventListener('click', function() {
      mobileModelLabel.classList.remove('open');
    });
  }

  var readerMobileLabel = document.getElementById('reader-mobile-model-label');
  var readerMobileTrigger = document.getElementById('reader-mobile-model-trigger');
  var readerMobileMenu = document.getElementById('reader-mobile-model-menu');
  var readerMobileName = document.getElementById('reader-mobile-model-name');
  if (readerMobileTrigger) {
    readerMobileTrigger.addEventListener('click', function(e) {
      e.stopPropagation();
      readerMobileLabel.classList.toggle('open');
    });
    readerMobileMenu.querySelectorAll('.mobile-model-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        readerMobileMenu.querySelector('.active')?.classList.remove('active');
        btn.classList.add('active');
        mobileSelectedModel = btn.dataset.model;
        readerMobileName.textContent = btn.textContent;
        readerMobileLabel.classList.remove('open');
        if (mobileModelMenu) {
          mobileModelMenu.querySelector('.active')?.classList.remove('active');
          var match = mobileModelMenu.querySelector('[data-model="' + btn.dataset.model + '"]');
          if (match) match.classList.add('active');
          if (mobileModelName) mobileModelName.textContent = btn.textContent;
        }
      });
    });
    document.addEventListener('click', function() {
      readerMobileLabel.classList.remove('open');
    });
  }

  function getSelectedModel() {
    if (isMobileDevice) return mobileSelectedModel;
    return chatModelSelect.value;
  }

  let readerModelChosen = false;
  const readerModelPicker = document.getElementById('reader-model-picker');
  const readerChatHeader = document.getElementById('reader-chat-header');
  const readerChatInputWrap = document.getElementById('reader-chat-input-wrap');
  const readerChatDisclaimer = document.getElementById('reader-chat-disclaimer');

  function showReaderChatUI() {
    readerModelPicker.style.display = 'none';
    readerChatHeader.style.display = '';
    chatMsgContainer.style.display = '';
    readerChatInputWrap.style.display = '';
    readerChatDisclaimer.style.display = '';
    loadReaderChatHistory();
  }

  document.querySelectorAll('.rmp-card').forEach(card => {
    card.addEventListener('click', async () => {
      const modelKey = card.dataset.model;
      const underlying = (LLM_MODELS.find(m => m.key === modelKey) || LLM_MODELS[0]).id;
      readerModelChosen = true;
      chatModelChosen = true;

      localStorage.setItem('bv_llm_model', modelKey);
      chatModelSelect.value = modelKey;
      try { homeChatModelSelect.value = modelKey; } catch (_) {}

      showReaderChatUI();

      const apiKey = localStorage.getItem('bv_openai_key');
      if (!apiKey && !isMobileDevice && navigator.gpu && (!llmEngine || llmCurrentModel !== underlying)) {
        await showModelLoading(modelKey);
      }
      chatInput.focus();
    });
  });

  let llmReady = false;

  // Pre-load default model in background (delay until splash finishes)
  if (!isMobileDevice && navigator.gpu && !localStorage.getItem('bv_openai_key')) {
    setTimeout(async function () {
      try {
        const modelId = getModelConfig().id;
        await initLLM(modelId, function () {});
        llmReady = true;
      } catch (e) {
        console.error('Pre-load failed:', e);
      }
    }, 4500);
  }

  const savedKey = localStorage.getItem('bv_openai_key');
  if (savedKey) chatApiKeyInput.value = savedKey;

  if (chatSettingsBtn) {
    chatSettingsBtn.addEventListener('click', () => {
      chatSettingsPanel.style.display = chatSettingsPanel.style.display === 'none' ? '' : 'none';
    });
  }

  chatKeySaveBtn.addEventListener('click', () => {
    const k = chatApiKeyInput.value.trim();
    if (k) localStorage.setItem('bv_openai_key', k);
    else localStorage.removeItem('bv_openai_key');
    chatSettingsPanel.style.display = 'none';
  });
  chatApiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); chatKeySaveBtn.click(); }
  });

  chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 96) + 'px';
  });
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  chatSendBtn.addEventListener('click', sendChat);

  function getChatContext() {
    const name = bookNames[readerBookNum];
    const ch = parseInt(readerChapterSelect.value, 10);
    const entries = (bookVerseIndex[readerBookNum] || []).filter(e => e.chapter === ch);
    let text = '';
    for (const v of entries) {
      const p = pts[v.idx];
      const t = readerTrans === 'bsb' && bsbVerses && bsbVerses[v.idx] ? bsbVerses[v.idx] : p.text;
      text += v.verse + '. ' + t + '\n';
    }
    return { bookName: name, chapter: ch, text: text };
  }

  function formatChat(str) {
    let s = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  const readerChatEl = document.getElementById('reader-chat');
  function renderChat() {
    if (chatHistory.length === 0) {
      chatMsgContainer.innerHTML = '<div class="reader-chat-empty">Ask anything about the text you\'re reading.</div>';
      if (readerChatEl) readerChatEl.classList.remove('has-messages');
      return;
    }
    if (readerChatEl) readerChatEl.classList.add('has-messages');
    chatMsgContainer.innerHTML = chatHistory.map(function(m, idx) {
      var cls = m.role === 'user' ? 'chat-msg-user' : 'chat-msg-assistant';
      var label = m.role === 'user' ? 'You' : 'BibleVerse';
      var saveBtn = '';
      if (m.role === 'assistant') {
        saveBtn = '<button class="chat-msg-save-note" data-msg-idx="' + idx + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
          'Save as Note</button>';
      }
      return '<div class="chat-msg ' + cls + '">' +
        '<div class="chat-msg-label">' + label + '</div>' +
        '<div class="chat-bubble">' + formatChat(m.content) + '</div>' + saveBtn + '</div>';
    }).join('');
    chatMsgContainer.scrollTop = chatMsgContainer.scrollHeight;
    bindSaveNoteButtons();
  }

  function bindSaveNoteButtons() {
    chatMsgContainer.querySelectorAll('.chat-msg-save-note').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.msgIdx);
        var msg = chatHistory[idx];
        if (!msg) return;
        var preview = msg.content.length > 300 ? msg.content.slice(0, 300) + '…' : msg.content;
        openNoteModal(preview);
      });
    });
  }

  function updateLastBubble() {
    const last = chatMsgContainer.querySelector('.chat-msg:last-child .chat-bubble');
    if (last) {
      last.innerHTML = formatChat(chatHistory[chatHistory.length - 1].content);
      chatMsgContainer.scrollTop = chatMsgContainer.scrollHeight;
    }
  }

  function buildMsgs() {
    const ctx = getChatContext();
    const model = getModelConfig();
    const sys = model.sysReaderPrompt
      .replace('{book}', ctx.bookName)
      .replace('{ch}', ctx.chapter)
      .replace('{text}', ctx.text);
    const sysTokens = estimateTokens(sys);
    const trimmed = trimToContextLimit(chatHistory, sysTokens, model.contextLimit);
    const msgs = [{ role: 'system', content: sys }];
    for (const m of trimmed) {
      if (m.content) msgs.push({ role: m.role, content: m.content });
    }
    return msgs;
  }

  let llmLoadingPromise = null;
  let llmLoadingModelId = null;
  let llmProgressCallback = null;

  function setLLMProgressCallback(cb) { llmProgressCallback = cb; }

  async function initLLM(modelId, onProgress) {
    if (llmEngine && llmCurrentModel === modelId) return;
    if (llmLoadingPromise && llmLoadingModelId === modelId) {
      if (onProgress) llmProgressCallback = onProgress;
      await llmLoadingPromise;
      return;
    }
    if (llmEngine) { await llmEngine.unload(); llmEngine = null; }
    llmLoadingModelId = modelId;
    llmProgressCallback = onProgress || null;
    llmLoadingPromise = (async () => {
      const mod = await import('https://esm.run/@mlc-ai/web-llm');
      llmEngine = await mod.CreateMLCEngine(modelId, {
        initProgressCallback: (report) => { if (llmProgressCallback) llmProgressCallback(report); },
      });
      llmCurrentModel = modelId;
    })();
    try {
      await llmLoadingPromise;
    } finally {
      llmLoadingPromise = null;
      llmLoadingModelId = null;
      llmProgressCallback = null;
    }
  }

  const modelLoadingEl = document.getElementById('reader-chat-model-loading');
  const modelLoadingText = document.getElementById('rcml-text');
  const modelLoadingBar = document.getElementById('rcml-bar');

  async function showModelLoading(modelKey) {
    const model = LLM_MODELS.find(m => m.key === modelKey) || LLM_MODELS[0];
    const modelId = model.id;
    const label = model.label;
    modelLoadingText.textContent = label;
    modelLoadingBar.style.width = '0%';
    modelLoadingEl.classList.add('active');
    let maxPct = 0;
    try {
      await initLLM(modelId, function (report) {
        const pct = Math.round((report.progress || 0) * 100);
        if (pct > maxPct) maxPct = pct;
        modelLoadingBar.style.width = maxPct + '%';
        modelLoadingText.textContent = maxPct >= 100 ? 'Starting ' + label : label;
      });
      llmReady = true;
    } finally {
      modelLoadingEl.classList.remove('active');
    }
  }

  async function sendChat() {
    const text = chatInput.value.trim();
    if (!text || chatStreaming) return;
    chatInput.value = '';
    chatInput.style.height = 'auto';

    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: '' });
    renderChat();
    chatStreaming = true;

    const apiKey = localStorage.getItem('bv_openai_key');

    const readerOnDelta = (delta) => {
      chatHistory[chatHistory.length - 1].content += delta;
      updateLastBubble();
    };

    try {
      if (apiKey) {
        await streamOpenAI(buildMsgs(), apiKey, readerOnDelta);
      } else if (isMobileDevice) {
        await callWorkerAI(buildMsgs(), readerOnDelta);
      } else {
        const cfg = getModelConfig();
        if (!llmEngine || llmCurrentModel !== cfg.id) {
          await showModelLoading(cfg.key);
        }
        const resp = await llmEngine.chat.completions.create({
          messages: buildMsgs(), stream: true, temperature: 0.7,
        });
        for await (const chunk of resp) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) {
            chatHistory[chatHistory.length - 1].content += delta;
            updateLastBubble();
          }
        }
      }
    } catch (err) {
      console.error('Reader chat error:', err);
      if (!chatHistory[chatHistory.length - 1].content) {
        chatHistory[chatHistory.length - 1].content = 'Something went wrong: ' + (err.message || err);
      }
      renderChat();
    }
    saveReaderChatHistory();
    chatStreaming = false;
  }

  // --- Selection tooltip ---
  const selTooltip = document.getElementById('reader-sel-tooltip');
  let selText = '';
  var savedRange = null;
  var tooltipInteracting = false;

  function hideSelTooltip() {
    if (tooltipInteracting) return;
    selTooltip.classList.remove('visible');
    selText = '';
    savedRange = null;
  }

  function forceHideSelTooltip() {
    tooltipInteracting = false;
    selTooltip.classList.remove('visible');
    selText = '';
    savedRange = null;
  }

  function showSelTooltip() {
    var sel = window.getSelection();
    var text = sel ? sel.toString().trim() : '';
    if (!text || text.length < 2) { hideSelTooltip(); return; }
    if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    savedRange = range.cloneRange();
    selTooltip.style.left = '0px';
    selTooltip.style.top = '0px';
    selTooltip.style.transform = 'none';
    selTooltip.style.visibility = 'hidden';
    selTooltip.classList.add('visible');
    var ttW = selTooltip.offsetWidth || 220;
    var ttH = selTooltip.offsetHeight || 40;
    selTooltip.classList.remove('visible');
    selTooltip.style.visibility = '';
    var pad = 8;
    var left = rect.left + rect.width / 2 - ttW / 2;
    if (left < pad) left = pad;
    if (left + ttW > window.innerWidth - pad) left = window.innerWidth - pad - ttW;
    var top = rect.bottom + pad;
    if (top + ttH > window.innerHeight - pad) top = rect.top - ttH - pad;
    selTooltip.style.left = left + 'px';
    selTooltip.style.top = top + 'px';
    selText = text;
    selTooltip.classList.add('visible');
  }

  readerContent.addEventListener('mouseup', function() {
    setTimeout(showSelTooltip, 10);
  });

  var _selDebounce = null;
  document.addEventListener('selectionchange', function() {
    if (tooltipInteracting) return;
    clearTimeout(_selDebounce);
    _selDebounce = setTimeout(function() {
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      var anchor = sel.anchorNode;
      if (!anchor) return;
      var el = anchor.nodeType === 3 ? anchor.parentElement : anchor;
      if (!el || !readerContent.contains(el)) return;
      var text = sel.toString().trim();
      if (text.length >= 2) showSelTooltip();
    }, 300);
  });

  document.addEventListener('mousedown', function(e) {
    if (selTooltip.contains(e.target)) return;
    forceHideSelTooltip();
  });

  selTooltip.addEventListener('touchstart', function(e) {
    tooltipInteracting = true;
    e.stopPropagation();
  }, { passive: true });
  selTooltip.addEventListener('touchend', function(e) {
    e.stopPropagation();
    setTimeout(function() { tooltipInteracting = false; }, 100);
  }, { passive: true });

  document.getElementById('reader-sel-ask').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var text = selText || (savedRange ? savedRange.toString().trim() : '');
    if (!text) return;
    var quote = '"' + (text.length > 200 ? text.slice(0, 200) + '…' : text) + '"';
    chatInput.value = 'Regarding this passage: ' + quote + '\n\n';
    chatInput.focus();
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
    try { window.getSelection().removeAllRanges(); } catch(e2) {}
    forceHideSelTooltip();
  });


  // --- Highlight system (verse-based) ---
  var hlColors = { green: 'rgba(76,175,80,0.25)', blue: 'rgba(100,149,237,0.25)', red: 'rgba(220,80,80,0.25)' };

  function getHighlightKey() {
    var bn = readerBookSelect ? readerBookSelect.value : '1';
    return 'bv_hl_' + bn;
  }

  function saveHighlights() {
    var data = {};
    readerContent.querySelectorAll('.reader-verse[data-hl-color]').forEach(function(v) {
      data[v.id] = v.dataset.hlColor;
    });
    try { localStorage.setItem(getHighlightKey(), JSON.stringify(data)); } catch(e) {}
  }

  function loadHighlights() {
    readerContent.querySelectorAll('.reader-verse[data-hl-color]').forEach(function(v) {
      removeVerseHighlight(v);
    });
    readerContent.querySelectorAll('mark[data-hl]').forEach(function(m) {
      m.replaceWith(document.createTextNode(m.textContent));
    });
    readerContent.normalize();
    var data = {};
    try { data = JSON.parse(localStorage.getItem(getHighlightKey()) || '{}'); } catch(e) {}
    Object.keys(data).forEach(function(vid) {
      var el = document.getElementById(vid);
      if (!el) return;
      applyVerseHighlight(el, data[vid]);
    });
  }

  function applyVerseHighlight(verseEl, color) {
    var textEl = verseEl.querySelector('.reader-verse-text');
    if (!textEl) return;
    verseEl.dataset.hlColor = color;
    textEl.style.background = hlColors[color] || '';
    textEl.style.borderRadius = '3px';
    textEl.style.boxDecorationBreak = 'clone';
    textEl.style.webkitBoxDecorationBreak = 'clone';
  }

  function removeVerseHighlight(verseEl) {
    var textEl = verseEl.querySelector('.reader-verse-text');
    if (!textEl) return;
    delete verseEl.dataset.hlColor;
    textEl.style.background = '';
    textEl.style.borderRadius = '';
  }

  function highlightVerse(verseId, color) {
    var el = document.getElementById(verseId);
    if (!el) return;
    if (color === 'clear' || el.dataset.hlColor === color) {
      removeVerseHighlight(el);
    } else {
      applyVerseHighlight(el, color);
    }
    saveHighlights();
  }

  // --- Verse action popover ---
  var versePopover = document.getElementById('verse-action-popover');
  var versePopoverTarget = null;

  function showVersePopover(verseEl) {
    versePopoverTarget = verseEl;
    var numEl = verseEl.querySelector('.reader-verse-num');
    var anchor = numEl || verseEl;
    var rect = anchor.getBoundingClientRect();
    var pw = versePopover.offsetWidth || 180;
    var left = rect.left + rect.width / 2 - pw / 2;
    if (left < 8) left = 8;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - 8 - pw;
    var top = rect.bottom + 8;
    if (top + 60 > window.innerHeight) top = rect.top - 60;
    versePopover.style.left = left + 'px';
    versePopover.style.top = top + 'px';
    var cur = verseEl.dataset.hlColor || '';
    versePopover.querySelectorAll('.vp-color').forEach(function(c) {
      c.classList.toggle('selected', c.dataset.color === cur);
    });
    versePopover.classList.add('visible');
  }

  function hideVersePopover() {
    versePopover.classList.remove('visible');
    versePopoverTarget = null;
  }

  document.addEventListener('click', function(e) {
    if (versePopover.classList.contains('visible') && !versePopover.contains(e.target) && !e.target.closest('.reader-verse-num')) {
      hideVersePopover();
    }
  });

  versePopover.querySelectorAll('.vp-color').forEach(function(c) {
    c.addEventListener('click', function() {
      if (!versePopoverTarget) return;
      highlightVerse(versePopoverTarget.id, c.dataset.color);
      hideVersePopover();
    });
  });

  document.getElementById('vp-note-btn').addEventListener('click', function() {
    if (!versePopoverTarget) return;
    var vid = versePopoverTarget.id;
    hideVersePopover();
    openNoteModal('', vid);
  });


  // --- Note modal system ---
  var noteModalOverlay = document.getElementById('note-modal-overlay');
  var noteModalBook = document.getElementById('note-modal-book');
  var noteModalChapter = document.getElementById('note-modal-chapter');
  var noteModalVerse = document.getElementById('note-modal-verse');
  var noteModalText = document.getElementById('note-modal-text');
  var noteModalCancel = document.getElementById('note-modal-cancel');
  var noteModalSave = document.getElementById('note-modal-save');

  function populateNoteModalBooks() {
    noteModalBook.innerHTML = '';
    Object.keys(bookNames).sort(function(a,b){ return parseInt(a)-parseInt(b); }).forEach(function(num) {
      var opt = document.createElement('option');
      opt.value = num;
      opt.textContent = bookNames[num];
      noteModalBook.appendChild(opt);
    });
  }

  function populateNoteModalChapters(bookNum) {
    noteModalChapter.innerHTML = '';
    var count = chapterCounts[bookNum] || chapterCounts[String(bookNum)] || 1;
    for (var c = 1; c <= count; c++) {
      var opt = document.createElement('option');
      opt.value = String(c);
      opt.textContent = 'Ch ' + c;
      noteModalChapter.appendChild(opt);
    }
    noteModalChapter.value = '1';
  }

  function populateNoteModalVerses(bookNum, ch) {
    noteModalVerse.innerHTML = '';
    var count = getVerseCount(bookNum, ch);
    for (var v = 1; v <= count; v++) {
      var opt = document.createElement('option');
      opt.value = String(v);
      opt.textContent = 'v' + v;
      noteModalVerse.appendChild(opt);
    }
    noteModalVerse.value = '1';
  }

  function getVerseCount(bookNum, ch) {
    return verseCounts[bookNum + '_' + ch] || verseCounts[String(bookNum) + '_' + ch] || 1;
  }

  function openNoteModal(prefillText, prefillVerseId) {
    populateNoteModalBooks();
    var curBook = readerBookSelect ? readerBookSelect.value : '1';
    noteModalBook.value = curBook;
    populateNoteModalChapters(curBook);

    var targetCh = 1, targetV = 1;
    if (prefillVerseId) {
      var match = prefillVerseId.match(/reader-v-(\d+)-(\d+)/);
      if (match) { targetCh = parseInt(match[1]) || 1; targetV = parseInt(match[2]) || 1; }
    } else {
      var midVerse = findMidScreenVerse();
      if (midVerse) {
        var m2 = midVerse.id.match(/reader-v-(\d+)-(\d+)/);
        if (m2) { targetCh = parseInt(m2[1]) || 1; targetV = parseInt(m2[2]) || 1; }
      }
    }
    if (targetCh < 1) targetCh = readerChapterSelect ? (parseInt(readerChapterSelect.value) || 1) : 1;

    noteModalChapter.value = String(targetCh);
    if (!noteModalChapter.value || noteModalChapter.value !== String(targetCh)) {
      noteModalChapter.value = noteModalChapter.options.length ? noteModalChapter.options[0].value : '1';
    }
    populateNoteModalVerses(curBook, parseInt(noteModalChapter.value) || 1);
    noteModalVerse.value = String(targetV);

    noteModalText.value = prefillText || '';
    noteModalOverlay.classList.add('visible');
    setTimeout(function() { noteModalText.focus(); }, 100);
  }

  function closeNoteModal() {
    noteModalOverlay.classList.remove('visible');
    noteModalText.value = '';
  }

  function findMidScreenVerse() {
    var verses = readerContent.querySelectorAll('.reader-verse');
    var mid = window.innerHeight / 2;
    var best = null, bestDist = Infinity;
    verses.forEach(function(v) {
      var r = v.getBoundingClientRect();
      var d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestDist) { bestDist = d; best = v; }
    });
    return best;
  }

  noteModalBook.addEventListener('change', function() {
    var bn = parseInt(noteModalBook.value);
    populateNoteModalChapters(bn);
    populateNoteModalVerses(bn, 1);
  });

  noteModalChapter.addEventListener('change', function() {
    var bn = parseInt(noteModalBook.value);
    var ch = parseInt(noteModalChapter.value);
    populateNoteModalVerses(bn, ch);
  });

  noteModalCancel.addEventListener('click', closeNoteModal);
  noteModalOverlay.addEventListener('click', function(e) {
    if (e.target === noteModalOverlay) closeNoteModal();
  });

  noteModalSave.addEventListener('click', function() {
    var text = noteModalText.value.trim();
    if (!text) return;
    var bn = noteModalBook.value || (readerBookSelect ? readerBookSelect.value : '1');
    var ch = noteModalChapter.value || '1';
    var v = noteModalVerse.value || '1';
    var verseId = 'reader-v-' + ch + '-' + v;
    var notesKey = 'bv_notes_' + bn;
    var an = {};
    try { an = JSON.parse(localStorage.getItem(notesKey) || '{}'); } catch(e) {}
    if (!an[verseId]) an[verseId] = [];
    an[verseId].push({ text: text, source: 'user', ts: Date.now() });
    try { localStorage.setItem(notesKey, JSON.stringify(an)); } catch(e) {}
    closeNoteModal();
    refreshNoteDots();
    if (currentReaderTab === 'notes') renderAllNotes();
  });

  // --- Verse Notes System (integrated into reader chat panel) ---
  var notesView = document.getElementById('reader-notes-view');
  var notesList = document.getElementById('reader-notes-list');
  var readerTabToggle = document.getElementById('reader-tab-toggle');
  var currentReaderTab = 'ai';

  function getNotesKey() {
    var bn = readerBookSelect ? readerBookSelect.value : '1';
    return 'bv_notes_' + bn;
  }

  function getAllNotes() {
    try { return JSON.parse(localStorage.getItem(getNotesKey()) || '{}'); } catch(e) { return {}; }
  }

  function saveAllNotes(notes) {
    try { localStorage.setItem(getNotesKey(), JSON.stringify(notes)); } catch(e) {}
  }

  var readerNewChatBtn = document.getElementById('reader-chat-new-btn');

  function switchReaderTab(tab) {
    currentReaderTab = tab;
    readerTabToggle.querySelectorAll('.reader-tab-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    var row2 = document.getElementById('reader-chat-header-row2');
    if (tab === 'notes') {
      chatMsgContainer.style.display = 'none';
      document.getElementById('reader-chat-input-wrap').style.display = 'none';
      document.getElementById('reader-chat-disclaimer').style.display = 'none';
      if (row2) row2.style.display = 'none';
      notesView.style.display = 'flex';
      renderAllNotes();
    } else {
      notesView.style.display = 'none';
      chatMsgContainer.style.display = '';
      document.getElementById('reader-chat-input-wrap').style.display = '';
      if (row2) row2.style.display = 'flex';
    }
  }

  if (readerTabToggle) {
    readerTabToggle.querySelectorAll('.reader-tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        switchReaderTab(btn.dataset.tab);
      });
    });
  }

  function parseVerseId(vid) {
    var m = vid.match(/^reader-v-(\d+)-(\d+)$/);
    return m ? { ch: parseInt(m[1]), v: parseInt(m[2]) } : { ch: 0, v: 0 };
  }

  function renderAllNotes() {
    var allNotes = getAllNotes();
    var allEntries = [];
    Object.keys(allNotes).forEach(function(vid) {
      var parsed = parseVerseId(vid);
      (allNotes[vid] || []).forEach(function(n, i) {
        allEntries.push({ vid: vid, idx: i, ch: parsed.ch, v: parsed.v, text: n.text, source: n.source, ts: n.ts });
      });
    });
    allEntries.sort(function(a, b) {
      if (a.ch !== b.ch) return a.ch - b.ch;
      if (a.v !== b.v) return a.v - b.v;
      return (a.ts || 0) - (b.ts || 0);
    });

    if (allEntries.length === 0) {
      notesList.innerHTML = '<div class="reader-notes-empty">No notes yet.<br>Use the Add Note button or tap a verse number.</div>';
      return;
    }

    var html = '';
    var lastCh = -1;
    allEntries.forEach(function(n) {
      if (n.ch !== lastCh) {
        html += '<div class="reader-notes-chapter-label">Chapter ' + n.ch + '</div>';
        lastCh = n.ch;
      }
      var src = n.source === 'ai' ? 'AI' : '';
      var escaped = (n.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      html += '<div class="reader-note-item" data-vid="' + n.vid + '" data-idx="' + n.idx + '">' +
        '<div class="note-source"><span class="note-verse-label">' + n.ch + ':' + n.v + '</span>' + (src ? '<span class="note-ai-badge">' + src + '</span>' : '') + '</div>' +
        '<div class="note-body">' + escaped + '</div>' +
        '<div class="note-actions">' +
          '<button class="reader-note-edit" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>' +
          '<button class="reader-note-delete" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>' +
        '</div>';
    });
    notesList.innerHTML = html;

    notesList.querySelectorAll('.reader-note-delete').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var item = btn.closest('.reader-note-item');
        var vid = item.dataset.vid;
        var idx = parseInt(item.dataset.idx);
        var an = getAllNotes();
        var arr = an[vid] || [];
        arr.splice(idx, 1);
        if (arr.length === 0) delete an[vid];
        else an[vid] = arr;
        saveAllNotes(an);
        renderAllNotes();
        refreshNoteDots();
      });
    });

    notesList.querySelectorAll('.reader-note-edit').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var item = btn.closest('.reader-note-item');
        if (item.classList.contains('editing')) return;
        var vid = item.dataset.vid;
        var idx = parseInt(item.dataset.idx);
        var an = getAllNotes();
        var arr = an[vid] || [];
        if (!arr[idx]) return;
        var raw = arr[idx].text || '';
        item.classList.add('editing');
        var body = item.querySelector('.note-body');
        var actions = item.querySelector('.note-actions');
        actions.style.display = 'none';
        body.innerHTML = '<textarea class="note-edit-area">' + raw.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</textarea>' +
          '<div class="note-edit-btns">' +
            '<button class="note-edit-cancel">Cancel</button>' +
            '<button class="note-edit-save">Save</button>' +
          '</div>';
        var ta = body.querySelector('.note-edit-area');
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        body.querySelector('.note-edit-cancel').addEventListener('click', function(ev) {
          ev.stopPropagation();
          renderAllNotes();
        });
        body.querySelector('.note-edit-save').addEventListener('click', function(ev) {
          ev.stopPropagation();
          var newText = ta.value.trim();
          if (!newText) return;
          arr[idx].text = newText;
          arr[idx].ts = Date.now();
          an[vid] = arr;
          saveAllNotes(an);
          renderAllNotes();
        });
      });
    });

    notesList.querySelectorAll('.reader-note-item').forEach(function(item) {
      item.addEventListener('click', function() {
        if (item.classList.contains('editing')) return;
        var vid = item.dataset.vid;
        var el = document.getElementById(vid);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('reader-verse-flash');
        setTimeout(function() { el.classList.remove('reader-verse-flash'); }, 1500);
      });
    });
  }

  function addNoteToVerse(verseId, text, source) {
    if (!text || !text.trim()) return;
    var an = getAllNotes();
    if (!an[verseId]) an[verseId] = [];
    an[verseId].push({ text: text.trim(), source: source || 'user', ts: Date.now() });
    saveAllNotes(an);
    refreshNoteDots();
    if (currentReaderTab === 'notes') renderAllNotes();
  }

  function openNotesPanel(verseId, verseLabel) {
    switchReaderTab('notes');
  }

  function refreshNoteDots() {
    readerContent.querySelectorAll('.reader-verse-note-dot').forEach(function(d) { d.remove(); });
    var allNotes = getAllNotes();
    Object.keys(allNotes).forEach(function(vid) {
      if (!allNotes[vid] || allNotes[vid].length === 0) return;
      var verse = readerContent.querySelector('#' + vid);
      if (!verse) return;
      var existing = verse.querySelector('.reader-verse-note-dot');
      if (existing) return;
      var dot = document.createElement('span');
      dot.className = 'reader-verse-note-dot';
      dot.title = allNotes[vid].length + ' note' + (allNotes[vid].length > 1 ? 's' : '');
      var textEl = verse.querySelector('.reader-verse-text');
      if (textEl) {
        textEl.appendChild(dot);
      } else {
        verse.appendChild(dot);
      }
    });
  }

  readerContent.addEventListener('click', function(e) {
    var dotEl = e.target.closest('.reader-verse-note-dot');
    if (dotEl) {
      var verse = dotEl.closest('.reader-verse');
      var vid = verse ? verse.id : '';
      switchReaderTab('notes');
      if (vid) {
        setTimeout(function() {
          var noteEl = notesList.querySelector('.reader-note-item[data-vid="' + vid + '"]');
          if (noteEl) {
            noteEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            noteEl.style.background = 'rgba(201,168,76,0.1)';
            setTimeout(function() { noteEl.style.background = ''; }, 1200);
          }
        }, 80);
      }
      return;
    }
    var numEl = e.target.closest('.reader-verse-num');
    if (numEl) {
      var verse = numEl.closest('.reader-verse');
      if (verse) {
        if (versePopover.classList.contains('visible') && versePopoverTarget === verse) {
          hideVersePopover();
        } else {
          showVersePopover(verse);
        }
      }
    }
  });

  var _loadHlTimer = null;
  var observer = new MutationObserver(function() {
    clearTimeout(_loadHlTimer);
    _loadHlTimer = setTimeout(function() {
      loadHighlights();
      refreshNoteDots();
      if (currentReaderTab === 'notes') renderAllNotes();
    }, 300);
  });
  observer.observe(readerInner, { childList: true });

  const WORKER_URL = 'https://bibleverse-ai.bibleverse.workers.dev';

  async function callWorkerAI(msgs, onDelta) {
    const resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, temperature: 0.7 }),
    });
    const text = await resp.text();
    if (!resp.ok) throw new Error('Worker ' + resp.status + ': ' + text);
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('Invalid JSON: ' + text.slice(0, 200)); }
    const content = data.choices?.[0]?.message?.content || '';
    if (content) onDelta(content);
  }

  async function streamOpenAI(msgs, key, onDelta) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: msgs, stream: true }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (d === '[DONE]') return;
        try {
          const delta = JSON.parse(d).choices[0].delta.content || '';
          if (delta) onDelta(delta);
        } catch (_) {}
      }
    }
  }

  // Clear chat when reader closes or book changes
  function clearChat() {
    chatHistory = [];
    saveReaderChatHistory();
    renderChat();
  }
  document.getElementById('reader-close').addEventListener('click', function() {
    // Don't clear — chat is saved per book+chapter
  });

  let pulseTimer = null;
  function focusResult(item) {
    document.querySelectorAll('.sr-item.active').forEach(el => el.classList.remove('active'));
    item.classList.add('active');

    if (item.dataset.mode === 'passage') {
      openPassageModal(item);
      return;
    }

    // Verse click → open modal with the single verse
    openVerseModal(item);
  }

  async function openVerseModal(item) {
    const ref = item.dataset.ref;
    const kjvText = item.dataset.text;
    const bsbText = item.dataset.textBsb || '';

    modalRef.textContent = ref;
    modalTitle.textContent = '';

    modalBody.innerHTML = kjvText;
    modalBodyBsb.innerHTML = bsbText || '<span style="color:rgba(232,228,220,0.25);font-style:italic;">Modern English translation not available.</span>';

    const matchedPt = pts.find(p => p.ref === ref);
    currentModalBookNum = matchedPt ? matchedPt.book_num : null;
    currentModalRefs = [ref];

    pmTrans = activeTrans;
    pmKjvBtn.classList.toggle('active', pmTrans === 'kjv');
    pmBsbBtn.classList.toggle('active', pmTrans === 'bsb');
    modalBody.style.display = pmTrans === 'kjv' ? '' : 'none';
    modalBodyBsb.style.display = pmTrans === 'bsb' ? '' : 'none';

    modalOverlay.classList.add('open');
  }

  // --- Lateral-only auto-rotation + lateral-only drag ---
  let spinning = true;
  let angle = Math.atan2(0.8, 0.8);
  const CAM_RADIUS = Math.sqrt(0.8 * 0.8 + 0.8 * 0.8);
  const CAM_Z = 0.3;
  let rotateRAF = null;
  const ROT_SPEED = 0.002;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartAngle = 0;

  function setCameraAtAngle(a) {
    const eye = { x: CAM_RADIUS * Math.cos(a), y: CAM_RADIUS * Math.sin(a), z: CAM_Z };
    try {
      const scene = plotEl._fullLayout.scene._scene;
      if (scene && scene.glplot) {
        const cam = scene.glplot.camera;
        cam.lookAt(
          [eye.x, eye.y, eye.z],
          [0, 0, 0],
          [0, 0, 1]
        );
        scene.glplot.redraw();
      }
    } catch (_) {}
  }

  function rotate() {
    if (!spinning) { rotateRAF = null; return; }
    angle += ROT_SPEED;
    setCameraAtAngle(angle);
    rotateRAF = requestAnimationFrame(rotate);
  }

  function startRotation() {
    spinning = true;
    if (!rotateRAF) rotate();
  }

  function stopRotation() {
    spinning = false;
    if (rotateRAF) { cancelAnimationFrame(rotateRAF); rotateRAF = null; }
  }

  plotEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.sphere-panel, .left-panel, .home-chat')) return;
    stopRotation();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartAngle = angle;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    angle = dragStartAngle - dx * 0.005;
    setCameraAtAngle(angle);
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (viewerMode || zoomAnimating) return;
    startRotation();
  });

  // Wait for Plotly GL scene to be fully ready, then start rotation
  let rotationStarted = false;
  function isSceneReady() {
    try { return !!(plotEl._fullLayout.scene._scene.glplot); }
    catch (_) { return false; }
  }
  function tryStartRotation() {
    if (rotationStarted) return;
    if (isSceneReady()) {
      rotationStarted = true;
      startRotation();
    } else {
      requestAnimationFrame(tryStartRotation);
    }
  }
  if (!isMobileDevice) {
    tryStartRotation();
    plotEl.on('plotly_afterplot', tryStartRotation);
  }


  // --- Homepage: unified Search | Chat interface ---
  let homeMode = 'search';
  const homeModeSearchBtn = document.getElementById('home-mode-search');
  const homeModeChatBtn = document.getElementById('home-mode-chat');
  const homeModelWrap = document.getElementById('home-chat-model-wrap');
  const homeChatInput = document.getElementById('home-chat-input');
  const homeChatSendBtn = document.getElementById('home-chat-send');
  const homeChatMessages = document.getElementById('home-chat-messages');
  const homeChatWelcome = document.getElementById('home-chat-welcome');
  let homeChatConvoId = null;
  let homeChatHistory = [];
  let homeChatStreaming = false;

  function getConvoList() {
    return JSON.parse(localStorage.getItem('bv_convo_list') || '[]');
  }
  function saveConvoList(list) {
    try { localStorage.setItem('bv_convo_list', JSON.stringify(list)); } catch(e) {}
  }
  function newConvoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  const homeChatModelSelect = setupDropdown('cd-home-model', 'cd-home-model-trigger', 'cd-home-model-menu', async (val) => {
    localStorage.setItem('bv_llm_model', val);
    chatModelSelect.value = val;
    const underlying = (LLM_MODELS.find(m => m.key === val) || LLM_MODELS[0]).id;
    if (!localStorage.getItem('bv_openai_key') && !isMobileDevice && navigator.gpu && llmCurrentModel !== underlying) {
      homeChatHistory = [];
      renderHomeChat();
      await showHomeModelLoading(val);
    }
  });
  homeChatModelSelect.setItems(LLM_MODELS.map(m => ({ value: m.key, label: m.menu, triggerLabel: m.label })));
  homeChatModelSelect.value = getSelectedModel();

  const homeModelLoadingEl = document.getElementById('home-chat-model-loading');
  const homeModelLoadingText = document.getElementById('hcml-text');
  const homeModelLoadingBar = document.getElementById('hcml-bar');

  async function showHomeModelLoading(modelKey) {
    const model = LLM_MODELS.find(m => m.key === modelKey) || LLM_MODELS[0];
    const modelId = model.id;
    const label = model.label;
    homeModelLoadingText.textContent = label;
    homeModelLoadingBar.style.width = '0%';
    homeModelLoadingEl.classList.add('active');
    let maxPct = 0;
    const progressCb = function (report) {
      const pct = Math.round((report.progress || 0) * 100);
      if (pct > maxPct) maxPct = pct;
      homeModelLoadingBar.style.width = maxPct + '%';
      homeModelLoadingText.textContent = maxPct >= 100 ? 'Starting ' + label : label;
    };
    try {
      await initLLM(modelId, progressCb);
      llmReady = true;
    } finally {
      homeModelLoadingEl.classList.remove('active');
    }
  }

  function estimateTokens(text) {
    return Math.ceil(text.length / 3.5);
  }

  function trimToContextLimit(history, sysTokens, limit) {
    let total = sysTokens;
    for (const m of history) {
      if (m.content) total += estimateTokens(m.content);
    }
    const trimmed = [...history];
    while (total > limit && trimmed.length > 2) {
      const removed = trimmed.shift();
      if (removed.content) total -= estimateTokens(removed.content);
      if (trimmed.length > 0 && trimmed[0].role === 'assistant') {
        const removed2 = trimmed.shift();
        if (removed2.content) total -= estimateTokens(removed2.content);
      }
    }
    return trimmed;
  }

  function buildHomeMsgs() {
    const model = getModelConfig();
    const sysTokens = estimateTokens(model.sysPrompt);
    const trimmed = trimToContextLimit(homeChatHistory, sysTokens, model.contextLimit);
    const msgs = [{ role: 'system', content: model.sysPrompt }];
    for (const m of trimmed) {
      if (m.content) msgs.push({ role: m.role, content: m.content });
    }
    return msgs;
  }

  function renderHomeChat() {
    const isChatting = homeChatContainer && homeChatContainer.classList.contains('chatting');
    if (homeChatHistory.length === 0) {
      if (!isChatting) homeChatMessages.style.display = 'none';
      homeChatWelcome.style.display = isChatting ? 'none' : '';
      homeChatMessages.innerHTML = '';
      return;
    }
    homeChatWelcome.style.display = 'none';
    homeChatMessages.style.display = '';
    const typingDots = '<div class="chat-typing-dots"><span></span><span></span><span></span></div>';
    homeChatMessages.innerHTML = homeChatHistory.map(m => {
      const cls = m.role === 'user' ? 'chat-msg-user' : 'chat-msg-assistant';
      const label = m.role === 'user' ? 'You' : 'BibleVerse';
      const body = m.role === 'assistant' && !m.content ? typingDots : formatChat(m.content);
      return '<div class="chat-msg ' + cls + '">' +
        '<div class="chat-msg-label">' + label + '</div>' +
        '<div class="chat-bubble">' + body + '</div></div>';
    }).join('');
    homeChatMessages.scrollTop = homeChatMessages.scrollHeight;
  }

  function updateHomeLastBubble() {
    const last = homeChatMessages.querySelector('.chat-msg:last-child .chat-bubble');
    if (last) {
      last.innerHTML = formatChat(homeChatHistory[homeChatHistory.length - 1].content);
      homeChatMessages.scrollTop = homeChatMessages.scrollHeight;
    }
  }

  const homeChatContainer = document.getElementById('home-chat');

  const mobileTopbar = document.getElementById('mobile-topbar');

  function enterChatMode() {
    if (homeChatContainer.classList.contains('chatting')) return;
    homeChatContainer.classList.add('chatting');
    document.body.style.overflow = 'hidden';
    homeChatInput.placeholder = window.innerWidth <= 800 ? 'Enter any text...' : 'Ask anything about the Bible...';
    if (mobileTopbar && window.innerWidth <= 800) mobileTopbar.style.display = 'none';
  }

  function exitChatMode() {
    homeChatConvoId = null;
    homeChatHistory = [];
    localStorage.removeItem('bv_home_convo_id');
    homeChatContainer.classList.remove('chatting');
    document.body.style.overflow = '';
    renderHomeChat();
    switchHomeMode('chat');
    if (mobileTopbar && window.innerWidth <= 800) mobileTopbar.style.display = 'flex';
  }

  document.getElementById('home-chat-back').addEventListener('click', exitChatMode);
  function startNewChat() {
    if (homeChatHistory.length === 0) return;
    homeChatConvoId = null;
    homeChatHistory = [];
    localStorage.removeItem('bv_home_convo_id');
    renderHomeChat();
    if (homeChatContainer.classList.contains('chatting')) exitChatMode();
  }
  document.getElementById('home-chat-new').addEventListener('click', startNewChat);

  var topbarTitle = document.getElementById('mobile-topbar-title');
  if (topbarTitle) {
    topbarTitle.addEventListener('click', function() {
      homeChatConvoId = null;
      homeChatHistory = [];
      localStorage.removeItem('bv_home_convo_id');
      renderHomeChat();
      if (homeChatContainer.classList.contains('chatting')) exitChatMode();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && homeChatContainer.classList.contains('chatting')) exitChatMode();
  });

  document.getElementById('reader-chat-new-btn').addEventListener('click', function() {
    if (chatHistory.length === 0) return;
    if (confirm('Start a new chat? This will clear the current conversation.')) {
      clearChat();
    }
  });

  // --- Chat history panel ---
  var historyPanel = document.getElementById('mobile-history-panel');
  var historyOverlay = document.getElementById('mobile-history-overlay');
  var historyList = document.getElementById('mobile-history-list');
  var historyBtn = document.getElementById('mobile-chat-history');
  var historyCloseBtn = document.getElementById('mobile-history-close');

  function deleteConvo(id) {
    var list = getConvoList().filter(function(c) { return c.id !== id; });
    saveConvoList(list);
    try { localStorage.removeItem('bv_convo_' + id); } catch(e) {}
    if (homeChatConvoId === id) {
      homeChatConvoId = null;
      homeChatHistory = [];
      renderHomeChat();
    }
    renderHistoryPanel();
  }

  function renderHistoryPanel() {
    if (!historyList) return;
    var list = getConvoList();
    if (list.length === 0) {
      historyList.innerHTML = '<div class="mobile-history-empty">No conversations yet.</div>';
      return;
    }
    historyList.innerHTML = list.map(function(c) {
      var ago = formatTimeAgo(c.time);
      return '<div class="mobile-history-item" data-id="' + c.id + '">' +
        '<div class="mobile-history-item-content">' +
          '<div class="mobile-history-item-title">' + escapeHtml(c.title) + '</div>' +
          '<div class="mobile-history-item-time">' + ago + '</div>' +
        '</div>' +
        '<button class="mobile-history-delete" data-id="' + c.id + '" title="Delete">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
        '</button>' +
      '</div>';
    }).join('');

    historyList.querySelectorAll('.mobile-history-item-content').forEach(function(content) {
      content.addEventListener('click', function() {
        var item = content.closest('.mobile-history-item');
        var id = item.dataset.id;
        homeChatConvoId = id;
        homeChatHistory = JSON.parse(localStorage.getItem('bv_convo_' + id) || '[]');
        localStorage.setItem('bv_home_convo_id', id);
        enterChatMode();
        renderHomeChat();
        closeHistoryPanel();
      });
    });

    historyList.querySelectorAll('.mobile-history-delete').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.dataset.id;
        var item = btn.closest('.mobile-history-item');
        var existing = item.querySelector('.mobile-history-confirm');
        if (existing) { existing.remove(); return; }
        var confirm = document.createElement('div');
        confirm.className = 'mobile-history-confirm';
        confirm.innerHTML = '<span>Delete?</span>' +
          '<button class="mobile-history-confirm-yes">Delete</button>' +
          '<button class="mobile-history-confirm-no">Cancel</button>';
        item.appendChild(confirm);
        confirm.querySelector('.mobile-history-confirm-yes').addEventListener('click', function(ev) {
          ev.stopPropagation();
          deleteConvo(id);
        });
        confirm.querySelector('.mobile-history-confirm-no').addEventListener('click', function(ev) {
          ev.stopPropagation();
          confirm.remove();
        });
      });
    });
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatTimeAgo(ts) {
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function openHistoryPanel() {
    renderHistoryPanel();
    if (historyPanel) historyPanel.classList.add('open');
    if (historyOverlay) historyOverlay.classList.add('open');
  }
  function closeHistoryPanel() {
    if (historyPanel) historyPanel.classList.remove('open');
    if (historyOverlay) historyOverlay.classList.remove('open');
  }
  if (historyBtn) historyBtn.addEventListener('click', openHistoryPanel);
  if (historyCloseBtn) historyCloseBtn.addEventListener('click', closeHistoryPanel);
  if (historyOverlay) historyOverlay.addEventListener('click', closeHistoryPanel);

  const homeInputWrap = document.querySelector('.home-chat-input-wrap');

  function setHomeStreaming(on) {
    homeChatStreaming = on;
  }

  async function sendHomeChat() {
    const text = homeChatInput.value.trim();
    if (!text || homeChatStreaming) return;
    homeChatInput.value = '';
    homeChatSendBtn.classList.remove('ready');
    enterChatMode();

    if (!homeChatConvoId) homeChatConvoId = newConvoId();
    homeChatHistory.push({ role: 'user', content: text });
    homeChatHistory.push({ role: 'assistant', content: '' });
    renderHomeChat();
    setHomeStreaming(true);

    const homeOnDelta = (delta) => {
      homeChatHistory[homeChatHistory.length - 1].content += delta;
      updateHomeLastBubble();
    };

    const apiKey = localStorage.getItem('bv_openai_key');

    try {
      if (apiKey) {
        await streamOpenAI(buildHomeMsgs(), apiKey, homeOnDelta);
      } else if (isMobileDevice) {
        await callWorkerAI(buildHomeMsgs(), homeOnDelta);
      } else {
        const cfg = getModelConfig();
        if (!llmEngine || llmCurrentModel !== cfg.id) {
          await initLLM(cfg.id);
        }
        const resp = await llmEngine.chat.completions.create({
          messages: buildHomeMsgs(), stream: true, temperature: 0.7,
        });
        for await (const chunk of resp) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) homeOnDelta(delta);
        }
      }
    } catch (err) {
      console.error('Home chat error:', err);
      if (!homeChatHistory[homeChatHistory.length - 1].content) {
        homeChatHistory[homeChatHistory.length - 1].content = 'Something went wrong: ' + (err.message || err);
      }
      renderHomeChat();
    }
    saveHomeChatHistory();
    setHomeStreaming(false);
  }

  function saveHomeChatHistory() {
    if (!homeChatConvoId || homeChatHistory.length === 0) return;
    try {
      localStorage.setItem('bv_convo_' + homeChatConvoId, JSON.stringify(homeChatHistory));
      var list = getConvoList();
      var existing = list.findIndex(function(c) { return c.id === homeChatConvoId; });
      var firstUserMsg = homeChatHistory.find(function(m) { return m.role === 'user' && m.content; });
      var title = firstUserMsg ? firstUserMsg.content.slice(0, 60) : 'New chat';
      var entry = { id: homeChatConvoId, title: title, time: Date.now() };
      if (existing >= 0) { list[existing] = entry; } else { list.unshift(entry); }
      if (list.length > 50) list = list.slice(0, 50);
      saveConvoList(list);
      localStorage.setItem('bv_home_convo_id', homeChatConvoId);
    } catch(e) {}
  }

  const homeSearchFooter = document.getElementById('home-search-footer');
  const homeChatFooter = document.getElementById('home-chat-footer');
  const homeDisclaimer = document.getElementById('home-chat-disclaimer');
  const homeModeVersesBtn = document.getElementById('home-mode-verses');
  const homeModePassagesBtn = document.getElementById('home-mode-passages');

  homeModeVersesBtn.addEventListener('click', () => {
    searchMode = 'verses';
    homeModeVersesBtn.classList.add('active');
    homeModePassagesBtn.classList.remove('active');
    if (searchInput.value.trim().length >= 1) doSearch();
  });
  homeModePassagesBtn.addEventListener('click', () => {
    searchMode = 'passages';
    homeModePassagesBtn.classList.add('active');
    homeModeVersesBtn.classList.remove('active');
    if (searchInput.value.trim().length >= 1) doSearch();
  });

  const modelPickerEl = document.getElementById('model-picker');
  let chatModelChosen = false;

  function switchHomeMode(mode) {
    homeMode = mode;
    homeModeSearchBtn.classList.toggle('active', mode === 'search');
    homeModeChatBtn.classList.toggle('active', mode === 'chat');
    const isMobile = window.innerWidth <= 800;
    homeChatInput.placeholder = mode === 'search'
      ? (isMobile ? 'Enter any text...' : 'Enter any word, phrase, or idea to find the most relevant verses and passages in the Bible...')
      : (isMobile ? 'Enter any text...' : 'Ask anything about the Bible...');
    homeSearchFooter.style.display = mode === 'search' ? '' : 'none';
    homeModelLoadingEl.classList.toggle('hidden-by-mode', mode === 'search');
    if (mode === 'search') {
      homeChatMessages.style.display = 'none';
      modelPickerEl.style.display = 'none';
      homeChatFooter.style.display = 'none';
      document.querySelector('.home-chat-input-area').style.display = '';
    } else {
      if (homeSearchResults.style.display !== 'none') {
        homeSearchResults.style.display = 'none';
        clearSearch();
        restoreSphere();
      }
      if (!chatModelChosen && !isMobileDevice && navigator.gpu) {
        modelPickerEl.style.display = '';
        document.querySelector('.home-chat-input-area').style.display = 'none';
      } else {
        modelPickerEl.style.display = 'none';
        document.querySelector('.home-chat-input-area').style.display = '';
        homeChatFooter.style.display = '';
      }
    }
  }

  document.querySelectorAll('.model-card').forEach(card => {
    card.addEventListener('click', async () => {
      const modelKey = card.dataset.model;
      const underlying = (LLM_MODELS.find(m => m.key === modelKey) || LLM_MODELS[0]).id;
      chatModelChosen = true;
      modelPickerEl.style.display = 'none';

      localStorage.setItem('bv_llm_model', modelKey);
      chatModelSelect.value = modelKey;
      homeChatModelSelect.value = modelKey;

      document.querySelector('.home-chat-input-area').style.display = '';
      homeChatFooter.style.display = '';

      const apiKey = localStorage.getItem('bv_openai_key');
      if (!apiKey && !isMobileDevice && navigator.gpu && (!llmEngine || llmCurrentModel !== underlying)) {
        await showHomeModelLoading(modelKey);
      }
      homeChatInput.focus();
    });
  });

  homeModeSearchBtn.addEventListener('click', () => switchHomeMode('search'));
  homeModeChatBtn.addEventListener('click', () => switchHomeMode('chat'));

  function handleHomeSubmit() {
    if (homeMode === 'search') {
      const q = homeChatInput.value.trim();
      if (q.length < 1) return;
      homeChatWelcome.style.display = 'none';
      doSearch();
    } else {
      sendHomeChat();
    }
  }

  homeChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleHomeSubmit(); }
  });
  homeChatSendBtn.addEventListener('click', handleHomeSubmit);
  homeChatInput.addEventListener('input', () => {
    homeChatSendBtn.classList.toggle('ready', homeChatInput.value.trim().length > 0);
  });
  homeChatInput.addEventListener('focus', () => {
    if (homeMode === 'search') loadSearchAssets();
  });

  // Pre-load search assets after splash screen (only if in search mode)
  setTimeout(() => { if (homeMode === 'search') loadSearchAssets(); }, 5500);

  document.getElementById('search-back-btn').addEventListener('click', () => {
    clearSearch();
    restoreSphere();
    startRotation();
    homeChatWelcome.style.display = '';
    homeChatInput.value = '';
    homeChatSendBtn.classList.remove('ready');
    setTimeout(() => homeChatInput.focus(), 100);
  });

  // Read Bible button
  document.getElementById('hc-read-bible').addEventListener('click', () => {
    openReader(1, []);
  });

  // Search mode is default: show search footer, hide chat footer
  homeChatFooter.style.display = 'none';

  // --- Representative verses ---
  if (data.representative_verses) {
    const otList = document.getElementById('rv-ot-list');
    const ntList = document.getElementById('rv-nt-list');
    if (otList && ntList) {
      for (const rv of data.representative_verses) {
        const card = document.createElement('div');
        card.className = 'rv-card';
        card.dataset.book = rv.book.toLowerCase();
        card.dataset.text = rv.text.toLowerCase();
        card.innerHTML = `<div class="rv-header"><span class="rv-dot" style="background:${bookColor(rv.book_num)}"></span>` +
          `<span class="rv-book">${rv.book}</span><span class="rv-meta">${rv.n_verses} verses · cosine ${rv.similarity}</span></div>` +
          `<div class="rv-ref">${rv.ref}</div><div class="rv-text">${rv.text}</div>`;
        (rv.testament === 'OT' ? otList : ntList).appendChild(card);
      }

      document.querySelectorAll('.rv-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = document.getElementById(btn.dataset.target);
          const searchWrap = target.previousElementSibling;
          const open = target.style.display !== 'none';
          target.style.display = open ? 'none' : 'block';
          searchWrap.style.display = open ? 'none' : 'block';
          btn.classList.toggle('open', !open);
        });
      });

      function wireSearch(inputId, listId) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        input.addEventListener('input', () => {
          const q = input.value.toLowerCase().trim();
          for (const card of list.children) {
            const match = !q || card.dataset.book.includes(q) || card.dataset.text.includes(q);
            card.style.display = match ? '' : 'none';
          }
        });
      }
      wireSearch('rv-ot-search', 'rv-ot-list');
      wireSearch('rv-nt-search', 'rv-nt-list');
    }
  }

  /* --- Mobile-specific wiring --- */
  if (window.innerWidth <= 800) {
    switchHomeMode('chat');
    chatModelChosen = true;
    // Always start on fresh chat — use history panel to resume past conversations

    const mobileReader = document.getElementById('mobile-open-reader');
    if (mobileReader) {
      mobileReader.addEventListener('click', () => {
        openReader(1, []);
      });
    }

    document.querySelectorAll('.mobile-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.q;
        if (!q) return;
        homeChatInput.value = q;
        homeChatSendBtn.classList.add('ready');
        handleHomeSubmit();
      });
    });
  }
})().catch(function(err) {
  console.error('IIFE crash:', err);
  if (window.innerWidth <= 800) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;bottom:60px;left:10px;right:10px;background:rgba(220,40,40,0.9);color:#fff;padding:12px;border-radius:8px;font:12px monospace;z-index:999999;word-break:break-all;';
    d.textContent = 'JS Error: ' + (err.message || err) + ' | ' + (err.stack || '').split('\n').slice(0,3).join(' | ');
    document.body.appendChild(d);
  }
});
