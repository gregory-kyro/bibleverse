/**
 * Entity Network — D3 force-directed graph with interactive filters.
 */

(async function () {
  const graphData = await loadJSON('graph.json');

  const TYPE_COLORS = {
    person: '#c9a84c',
    place: '#5b9bd5',
    group: '#e07a5f',
    concept: '#8b8b9e',
  };

  const container = document.getElementById('graph-container');
  const tooltip = document.getElementById('graph-tooltip');
  let width, height;
  let simulation, svg, g, linkGroup, nodeGroup, labelGroup;
  let currentNodes = [], currentLinks = [];

  function initSVG() {
    container.innerHTML = '';
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = Math.max(rect.height, 600);

    svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', '#0a0a12');

    g = svg.append('g');

    svg.call(d3.zoom()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => g.attr('transform', event.transform)));

    linkGroup = g.append('g').attr('class', 'links');
    nodeGroup = g.append('g').attr('class', 'nodes');
    labelGroup = g.append('g').attr('class', 'labels');
  }

  function getFilteredGraph() {
    const typeFilter = document.getElementById('type-filter').value;
    const minWeight = parseInt(document.getElementById('min-weight').value);
    const minCount = parseInt(document.getElementById('min-count').value);

    let nodes = graphData.nodes.filter(n => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      return n.count >= minCount;
    });

    const nodeIds = new Set(nodes.map(n => n.id));

    let links = graphData.edges.filter(e =>
      e.weight >= minWeight && nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    const linkedIds = new Set();
    links.forEach(e => { linkedIds.add(e.source); linkedIds.add(e.target); });
    nodes = nodes.filter(n => linkedIds.has(n.id));

    return { nodes: nodes.map(n => ({ ...n })), links: links.map(l => ({ ...l })) };
  }

  function render() {
    const { nodes, links } = getFilteredGraph();
    currentNodes = nodes;
    currentLinks = links;

    if (simulation) simulation.stop();

    const charge = parseInt(document.getElementById('charge-strength').value);

    const maxCount = d3.max(nodes, d => d.count) || 1;
    const radiusScale = d3.scaleSqrt().domain([1, maxCount]).range([4, 22]);
    const maxWeight = d3.max(links, d => d.weight) || 1;
    const widthScale = d3.scaleLinear().domain([1, maxWeight]).range([0.5, 4]);

    // Links
    const linkSel = linkGroup.selectAll('line').data(links, d => d.source + '-' + d.target);
    linkSel.exit().remove();
    const linkEnter = linkSel.enter().append('line');
    const allLinks = linkEnter.merge(linkSel)
      .attr('stroke', '#2a2a4a')
      .attr('stroke-width', d => widthScale(d.weight))
      .attr('stroke-opacity', 0.5);

    // Nodes
    const nodeSel = nodeGroup.selectAll('circle').data(nodes, d => d.id);
    nodeSel.exit().remove();
    const nodeEnter = nodeSel.enter().append('circle');
    const allNodes = nodeEnter.merge(nodeSel)
      .attr('r', d => radiusScale(d.count))
      .attr('fill', d => TYPE_COLORS[d.type] || '#666')
      .attr('stroke', '#0a0a12')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        tooltip.className = 'tooltip visible';
        tooltip.innerHTML = `<div class="tt-ref">${d.id}</div><div class="tt-text">${d.type} · ${d.count} mentions · ${d.books.length} books</div>`;
        tooltip.style.left = (event.pageX + 12) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
        highlightConnections(d);
      })
      .on('mousemove', (event) => {
        tooltip.style.left = (event.pageX + 12) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
      })
      .on('mouseout', () => {
        tooltip.className = 'tooltip';
        resetHighlight();
      })
      .on('click', (event, d) => showEntityDetail(d))
      .call(d3.drag()
        .on('start', dragStart)
        .on('drag', dragging)
        .on('end', dragEnd));

    // Labels (only for large nodes)
    const labelNodes = nodes.filter(d => d.count >= Math.max(maxCount * 0.15, 20));
    const labelSel = labelGroup.selectAll('text').data(labelNodes, d => d.id);
    labelSel.exit().remove();
    const labelEnter = labelSel.enter().append('text');
    const allLabels = labelEnter.merge(labelSel)
      .text(d => d.id)
      .attr('font-size', '10px')
      .attr('font-family', 'Inter, sans-serif')
      .attr('fill', '#e8e4dc')
      .attr('text-anchor', 'middle')
      .attr('dy', d => -radiusScale(d.count) - 4)
      .attr('pointer-events', 'none');

    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(charge))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => radiusScale(d.count) + 2))
      .on('tick', () => {
        allLinks
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        allNodes
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);
        allLabels
          .attr('x', d => d.x)
          .attr('y', d => d.y);
      });
  }

  function highlightConnections(d) {
    const connectedIds = new Set();
    currentLinks.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      if (src === d.id) connectedIds.add(tgt);
      if (tgt === d.id) connectedIds.add(src);
    });
    connectedIds.add(d.id);

    nodeGroup.selectAll('circle')
      .attr('opacity', n => connectedIds.has(n.id) ? 1 : 0.15);
    linkGroup.selectAll('line')
      .attr('stroke-opacity', l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        return (src === d.id || tgt === d.id) ? 0.8 : 0.05;
      });
    labelGroup.selectAll('text')
      .attr('opacity', n => connectedIds.has(n.id) ? 1 : 0.1);
  }

  function resetHighlight() {
    nodeGroup.selectAll('circle').attr('opacity', 1);
    linkGroup.selectAll('line').attr('stroke-opacity', 0.5);
    labelGroup.selectAll('text').attr('opacity', 1);
  }

  function showEntityDetail(d) {
    document.getElementById('panel-hint').style.display = 'none';
    const detail = document.getElementById('entity-detail');

    const connections = [];
    currentLinks.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      if (src === d.id) connections.push({ entity: tgt, weight: l.weight });
      if (tgt === d.id) connections.push({ entity: src, weight: l.weight });
    });
    connections.sort((a, b) => b.weight - a.weight);

    detail.innerHTML = `
      <div style="margin-bottom:1rem;">
        <span class="gold" style="font-size:1.1rem; font-weight:600;">${d.id}</span>
        <span class="dim small" style="margin-left:0.5rem;">${d.type}</span>
      </div>
      <div class="small dim" style="margin-bottom:0.75rem;">
        <span class="mono">${d.count}</span> mentions across
        <span class="mono">${d.books.length}</span> books
      </div>
      <div class="small dim" style="margin-bottom:1rem;">
        Books: ${d.books.slice(0, 12).join(', ')}${d.books.length > 12 ? '…' : ''}
      </div>
      <h3 style="margin-top:1rem;">Connections (${connections.length})</h3>
      ${connections.slice(0, 20).map(c => `
        <div class="neighbor-item">
          <span class="neighbor-ref">${c.entity}</span>
          <span class="neighbor-score">${c.weight} ch.</span>
        </div>
      `).join('')}
    `;
  }

  function dragStart(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragging(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragEnd(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // Controls
  const minWeightSlider = document.getElementById('min-weight');
  const minCountSlider = document.getElementById('min-count');
  minWeightSlider.addEventListener('input', () => {
    document.getElementById('min-weight-val').textContent = minWeightSlider.value;
    render();
  });
  minCountSlider.addEventListener('input', () => {
    document.getElementById('min-count-val').textContent = minCountSlider.value;
    render();
  });
  document.getElementById('type-filter').addEventListener('change', render);
  document.getElementById('charge-strength').addEventListener('input', render);

  initSVG();
  render();

  window.addEventListener('resize', () => {
    initSVG();
    render();
  });
})();
