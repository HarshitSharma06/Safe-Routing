/**
 * SafeRoute AI – script.js
 * A* Pathfinding based Disaster Evacuation Route Optimisation
 * 
 * Architecture:
 *  1. CITY GRAPH  – fictional road network as adjacency list
 *  2. A* ENGINE   – pathfinding with danger-weighted costs
 *  3. MAP LAYER   – offline SVG rendering of nodes, edges, route
 *  4. UI CONTROL  – event handlers, simulation, demo mode
 *
 * Author: SafeRoute AI Team | B.Tech Disaster Management Project
 */

'use strict';

/* ============================================================
   SECTION 1 – CITY NODE DEFINITIONS
   Each node = intersection or named location on our fictional map.
   lat/lng are coordinates used to place nodes on the SVG map and
   to compute the A* heuristic, but the ROAD NETWORK and
   distances are entirely fictional / simulated.
   ============================================================ */

/**
 * NODE GUIDE
 * A  – Downtown Market        (starting zone)
 * B  – Riverside Colony       (flood-prone low ground)
 * C  – North Hills            (elevated, safer)
 * D  – East Junction          (major crossroads)
 * E  – West Suburb            (residential)
 * F  – Central Park Area      (open space)
 * I1 – Inner Intersection 1   (between A and F)
 * I2 – Inner Intersection 2   (between B and D)
 * I3 – Inner Intersection 3   (between C and S2)
 * I4 – Inner Intersection 4   (between E and S1)
 * S1 – City Emergency Shelter (southern safe zone)
 * S2 – North Relief Camp      (northern safe zone)
 * S3 – Hilltop Safe Zone      (elevated safe zone)
 */

const NODES = window.CITY_DATA.nodes;   // real Delhi places (see data.js)

/* ROAD EDGES – real road corridors. dist is a first estimate (1.3 x straight line);
   it is replaced by the real OSM road distance once loadRoadGeometry() finishes. */
const ROAD_EDGES = window.CITY_DATA.roads.map(r => ({
  ...r,
  dist: Math.round(straightLineKm(r.from, r.to) * 1.3 * 10) / 10,
}));

/* ============================================================
   SECTION 3 – DISASTER DANGER MULTIPLIERS
   When a disaster is active, certain road types become more
   dangerous. Multiplier applied to baseDanger score.
   ============================================================ */

const DISASTER_MULTIPLIERS = {
  flood: {
    flood:      3.5,  // flood roads become extremely dangerous
    fire:       1.0,
    earthquake: 1.2,
    all:        2.0,
    none:       1.0,
  },
  fire: {
    flood:      1.0,
    fire:       3.5,
    earthquake: 1.0,
    all:        2.0,
    none:       1.0,
  },
  earthquake: {
    flood:      1.0,
    fire:       1.0,
    earthquake: 3.5,
    all:        2.5,
    none:       1.0,
  },
};

/* ============================================================
   SECTION 4 – APPLICATION STATE
   Central state object (single source of truth)
   ============================================================ */

const STATE = {
  disasterType:    'flood',
  dangerLevel:     5,          // global multiplier slider (1-10)
  startNode:       'A',
  destNode:        'S1',
  blockedRoads:    new Set(),  // set of road IDs that are blocked
  currentRoute:    null,       // {path, edges, cost, dist, segments}
  routeActive:     false,      // true once the user has asked for a route (re-run on changes)
  graph:           {},         // adjacency list built from ROAD_EDGES
  map:             null,       // Leaflet map
  layers:          {},         // SVG <g> groups: roads, route, ring, nodes
  demoRunning:     false,      // guard against starting the demo twice
};

/* ============================================================
   SECTION 5 – GRAPH BUILDER
   Converts ROAD_EDGES into a bidirectional adjacency list.
   ============================================================ */

/**
 * Build (or rebuild) the road graph from ROAD_EDGES.
 * Each neighbour entry carries: {to, edgeId, dist, baseDanger, risk}
 */
function buildGraph() {
  STATE.graph = {};
  // initialise every node
  Object.keys(NODES).forEach(id => { STATE.graph[id] = []; });

  ROAD_EDGES.forEach(edge => {
    // Add both directions (undirected graph)
    STATE.graph[edge.from].push({
      to: edge.to, edgeId: edge.id,
      dist: edge.dist, baseDanger: edge.danger, risk: edge.risk,
    });
    STATE.graph[edge.to].push({
      to: edge.from, edgeId: edge.id,
      dist: edge.dist, baseDanger: edge.danger, risk: edge.risk,
    });
  });
}

/* ============================================================
   SECTION 6 – A* PATHFINDING ALGORITHM
   ============================================================ */

/**
 * Compute the effective danger score for a road edge,
 * given the active disaster type, danger level, and blocked status.
 *
 * Returns Infinity if road is blocked.
 * Otherwise returns: baseDanger × disaster_multiplier × (dangerLevel/5)
 */
function edgeDangerCost(edge) {
  if (STATE.blockedRoads.has(edge.edgeId)) return Infinity;

  const multiplier = DISASTER_MULTIPLIERS[STATE.disasterType][edge.risk] ?? 1.0;
  const levelFactor = STATE.dangerLevel / 5;  // normalise slider 1-10 around 1.0

  return edge.baseDanger * multiplier * levelFactor;
}

/**
 * Total edge cost = travel distance + danger penalty
 * (danger penalty = danger cost × 2.0 weight factor so the
 *  algorithm really avoids dangerous roads)
 */
function edgeTotalCost(edge) {
  const danger = edgeDangerCost(edge);
  if (!isFinite(danger)) return Infinity;
  return edge.dist + danger * 2.0;
}

/**
 * Heuristic for A*: straight-line (Euclidean) distance
 * between two lat/lng points, scaled to kilometres.
 * (1 degree lat ≈ 111 km; 1 degree lng ≈ 111·cos(lat) km)
 */
function straightLineKm(fromId, toId) {
  const a = NODES[fromId];
  const b = NODES[toId];
  const dlat = (a.lat - b.lat) * 111;
  const dlng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

/**
 * The road distances in this prototype are fictional, so on a few roads
 * the straight-line distance is slightly LONGER than the stated road
 * distance. An over-estimating heuristic can make A* return a
 * non-optimal route, so we scale the heuristic down by the worst-case
 * ratio. This keeps h(n) admissible (never over-estimates).
 */
const HEURISTIC_SCALE = Math.min(
  1,
  ...ROAD_EDGES.map(e => e.dist / straightLineKm(e.from, e.to))
);

function heuristic(fromId, toId) {
  return straightLineKm(fromId, toId) * HEURISTIC_SCALE;
}

/**
 * A* Search
 * Returns null if no path exists, otherwise:
 * { path: ['A','I1',...,'S1'], edges, cost, dist, segments }
 *
 * Steps:
 * 1. Put start node in the Open Set with f=0
 * 2. Each iteration: pick node with lowest f from Open Set
 * 3. If it's the goal → reconstruct path and return
 * 4. Otherwise expand neighbours, compute g+h, update Open Set
 */
function aStarSearch(startId, goalId) {
  // g[n] = cheapest known cost from start to n
  const g = {};
  // f[n] = g[n] + h(n)
  const f = {};
  // came_from[n] = {nodeId, edgeId} used to reconstruct path
  const cameFrom = {};
  // cumulativeDist[n] = real distance walked to reach n (km)
  const distMap = {};

  Object.keys(NODES).forEach(id => {
    g[id] = Infinity;
    f[id] = Infinity;
  });

  g[startId] = 0;
  f[startId] = heuristic(startId, goalId);
  distMap[startId] = 0;

  // Open set as a simple array (adequate for small graphs)
  // In production you'd use a priority queue (min-heap)
  const openSet = new Set([startId]);
  const closedSet = new Set();

  while (openSet.size > 0) {
    // Pick node with minimum f value
    let current = null;
    let minF = Infinity;
    openSet.forEach(id => {
      if (f[id] < minF) { minF = f[id]; current = id; }
    });

    if (current === goalId) {
      // Reconstruct path
      return reconstructPath(cameFrom, startId, goalId, g[goalId], distMap[goalId]);
    }

    openSet.delete(current);
    closedSet.add(current);

    // Explore neighbours
    const neighbours = STATE.graph[current] || [];
    for (const edge of neighbours) {
      if (closedSet.has(edge.to)) continue;

      const edgeCost = edgeTotalCost(edge);
      if (!isFinite(edgeCost)) continue;  // skip blocked / impassable

      const tentativeG = g[current] + edgeCost;

      if (tentativeG < g[edge.to]) {
        cameFrom[edge.to]  = { from: current, edgeId: edge.edgeId };
        g[edge.to]         = tentativeG;
        f[edge.to]         = tentativeG + heuristic(edge.to, goalId);
        distMap[edge.to]   = distMap[current] + edge.dist;
        openSet.add(edge.to);
      }
    }
  }

  return null;  // No path found
}

/**
 * Walk backwards through cameFrom to build the path array.
 */
function reconstructPath(cameFrom, startId, goalId, totalCost, totalDist) {
  const path = [];
  const edges = [];
  let current = goalId;

  while (current !== startId) {
    path.unshift(current);
    const cf = cameFrom[current];
    edges.unshift(cf.edgeId);
    current = cf.from;
  }
  path.unshift(startId);

  return {
    path,
    edges,
    cost:     Math.round(totalCost * 10) / 10,
    dist:     Math.round(totalDist * 10) / 10,
    segments: path.length - 1,
  };
}

/**
 * Count how many DISTINCT alternative routes exist by blocking each
 * road of the main route one at a time and re-running A*.
 * (Called once from findRoute(), never from inside aStarSearch(),
 *  so there is no recursion.)
 */
function countAlternativeRoutes(startId, goalId, mainResult) {
  const seen = new Set([mainResult.path.join('>')]);
  mainResult.edges.forEach(edgeId => {
    const wasBlocked = STATE.blockedRoads.has(edgeId);
    STATE.blockedRoads.add(edgeId);
    const alt = aStarSearch(startId, goalId);
    if (!wasBlocked) STATE.blockedRoads.delete(edgeId);
    if (alt) seen.add(alt.path.join('>'));
  });
  return seen.size - 1;
}

/* ============================================================
   SECTION 7 – REAL MAP (Leaflet + OpenStreetMap tiles)
   ============================================================ */

STATE.geom = {};   // edgeId -> [[lat,lng],...] real road shape (from OSRM)

function initMap() {
  if (!window.L) { document.getElementById('cityMap').textContent = 'Map library failed to load – check your internet connection.'; return; }
  const m = STATE.map = L.map('cityMap').setView(window.CITY_DATA.meta.center, window.CITY_DATA.meta.zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(m);
  ['roads', 'route', 'ring', 'nodes'].forEach(n => { STATE.layers[n] = L.layerGroup().addTo(m); });
  m.fitBounds(L.latLngBounds(Object.values(NODES).map(n => [n.lat, n.lng])), { padding: [50, 50] });
  drawRoads();
  drawNodes();
  loadRoadGeometry();
}

function closePopup() { if (STATE.map) STATE.map.closePopup(); }

/** Real road shape for an edge (falls back to a straight line). */
function roadPts(edge) {
  return STATE.geom[edge.id] || [[NODES[edge.from].lat, NODES[edge.from].lng], [NODES[edge.to].lat, NODES[edge.to].lng]];
}

/** Fetch real road geometry + distance from OSM routing (OSRM), cached in the browser. */
async function loadRoadGeometry() {
  const KEY = 'saferoute_osrm_delhi_v1';
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  let changed = false;
  for (const e of ROAD_EDGES) {
    if (!cache[e.id]) {
      const a = NODES[e.from], b = NODES[e.to];
      try {
        const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
        const rt = (await r.json()).routes?.[0];
        if (!rt) continue;
        cache[e.id] = { km: Math.round(rt.distance / 100) / 10, pts: rt.geometry.coordinates.map(([x, y]) => [y, x]) };
        changed = true;
      } catch (err) { console.warn('Road geometry unavailable (offline?) – using straight lines.', err); break; }
    }
    STATE.geom[e.id] = cache[e.id].pts;
    e.dist = Math.max(cache[e.id].km, 0.1);
  }
  try { if (changed) localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {}
  buildGraph();
  drawRoads();
  if (STATE.routeActive) findRoute();
}

/* ============================================================
   SECTION 8 – MAP DRAWING FUNCTIONS
   ============================================================ */

/** Draw all road edges as coloured lines (colour = danger level). */
function drawRoads() {
  const layer = STATE.layers.roads;
  if (!layer) return;
  layer.clearLayers();
  ROAD_EDGES.forEach(edge => {
    const blocked = STATE.blockedRoads.has(edge.id);
    L.polyline(roadPts(edge), {
      color: getRoadColor(edge, blocked), weight: blocked ? 6 : 5, opacity: 0.85,
      dashArray: blocked ? '8 8' : null, lineCap: 'round',
    }).bindTooltip(`${edge.label} (${edge.id})${blocked ? ' 🚧 blocked' : ''}`, { sticky: true })
      .bindPopup(roadPopupHtml(edge)).addTo(layer);
  });
  updateBlockedCount();
}

function roadPopupHtml(edge) {
  const isBlocked = STATE.blockedRoads.has(edge.id);
  const statusText = isBlocked
    ? '<span style="color:#ef4444">🚧 BLOCKED</span>'
    : '<span style="color:#22c55e">✅ Open</span>';
  const btnClass = isBlocked ? 'popup-road-btn unblock' : 'popup-road-btn';
  const btnText  = isBlocked ? '✅ Unblock Road' : '🚧 Block This Road';
  return `
    <div class="popup-title">🛣️ ${edge.label}</div>
    <div><strong>Road ID:</strong> ${edge.id}</div>
    <div><strong>Route:</strong> ${edge.from} → ${edge.to}</div>
    <div><strong>Distance:</strong> ${edge.dist} km</div>
    <div><strong>Base Danger:</strong> ${edge.danger}/10</div>
    <div><strong>Risk Type:</strong> ${edge.risk}</div>
    <div><strong>Status:</strong> ${statusText}</div>
    <button class="${btnClass}" onclick="window.toggleRoadFromPopup('${edge.id}')">${btnText}</button>
  `;
}

/** Return the correct colour for a road based on its danger level. */
function getRoadColor(edge, isBlocked) {
  if (isBlocked) return '#ef4444';  // red = blocked

  const effectiveDanger = edgeDangerCost({ ...edge, edgeId: edge.id, baseDanger: edge.danger });
  if (effectiveDanger > 12) return '#ef4444';  // red   – high danger
  if (effectiveDanger > 6)  return '#f59e0b';  // amber – moderate
  return '#22c55e';                            // green – safe
}

/** Draw node markers (junctions, starting zones and shelters). */
function drawNodes() {
  const layer = STATE.layers.nodes;
  if (!layer) return;
  layer.clearLayers();
  const style = {
    shelter:  { radius: 11, fillColor: '#10b981' },
    start:    { radius: 8,  fillColor: '#FF6B2B' },
    junction: { radius: 5,  fillColor: '#1e3a8a' },
  };
  Object.values(NODES).forEach(node => {
    const mk = L.circleMarker([node.lat, node.lng], { ...style[node.type], color: '#fff', weight: 2, fillOpacity: 1 })
      .bindPopup(nodePopupHtml(node)).addTo(layer);
    mk.bindTooltip(node.name, node.type === 'junction'
      ? { direction: 'top' }
      : { permanent: true, direction: 'top', offset: [0, -8], className: 'node-tip' });
  });
}

function nodePopupHtml(node) {
  const icon = node.type === 'shelter' ? '🏥' : node.type === 'junction' ? '🔵' : '📍';
  const typeName = node.type === 'shelter' ? 'Safe Shelter' : node.type === 'start' ? 'Starting Zone' : 'Road Junction';
  return `
    <div class="popup-title">${icon} ${node.name}</div>
    <div><strong>Node ID:</strong> ${node.id}</div>
    <div><strong>Type:</strong> ${typeName}</div>
    <div><strong>Coordinates:</strong> ${node.lat.toFixed(4)}°N, ${node.lng.toFixed(4)}°E</div>
  `;
}

/** Highlight the selected starting location with a ring. */
function highlightStartNode(nodeId) {
  const layer = STATE.layers.ring;
  if (!layer) return;
  layer.clearLayers();
  const n = NODES[nodeId];
  if (n) L.circleMarker([n.lat, n.lng], { radius: 17, color: '#FF6B2B', weight: 3, fill: false, className: 'start-ring' }).addTo(layer);
}

/** Draw the recommended evacuation route along the real road geometry. */
function drawRoute(pathResult) {
  const layer = STATE.layers.route;
  if (!layer) return;
  layer.clearLayers();
  if (!pathResult) return;
  let pts = [];
  pathResult.edges.forEach((id, i) => {
    const e = ROAD_EDGES.find(r => r.id === id);
    const seg = roadPts(e).slice();
    if (e.from !== pathResult.path[i]) seg.reverse();
    pts = pts.concat(seg);
  });
  L.polyline(pts, { color: '#3b82f6', weight: 9, opacity: 0.9, lineJoin: 'round' }).addTo(layer);
  L.polyline(pts, { color: '#fff', weight: 3, opacity: 0.9, dashArray: '2 14', className: 'route-flow-line' }).addTo(layer);
}

/* ============================================================
   SECTION 9 – ROUTE FINDING & UI UPDATE
   ============================================================ */

/** Main function: run A*, render results, update UI. */
function findRoute() {
  const startId = STATE.startNode;
  const goalId  = STATE.destNode;

  if (startId === goalId) {
    showNotification('Start and destination cannot be the same!');
    return;
  }

  // Shelters cannot be used as starting nodes (sanity check)
  if (NODES[startId].type === 'shelter') {
    showNotification('Please select a non-shelter location as start.');
    return;
  }

  STATE.routeActive = true;
  const result = aStarSearch(startId, goalId);
  if (result) result.altCount = countAlternativeRoutes(startId, goalId, result);

  STATE.currentRoute = result;

  // Re-draw roads to reset colours
  drawRoads();

  if (result) {
    drawRoute(result);
    highlightStartNode(startId);
    renderRouteSuccess(result, startId, goalId);
    showNotification(`✅ Route found: ${result.path.join(' → ')}`);
  } else {
    drawRoute(null);
    highlightStartNode(startId);
    renderRouteFailure();
    showNotification('🚨 No safe route found! Try another shelter.');
  }
}

/** Update the right-panel with a successful route result. */
function renderRouteSuccess(result, startId, goalId) {
  const startName = NODES[startId].name;
  const goalName  = NODES[goalId].name;

  // Determine route quality message
  const avgDanger = (result.cost - result.dist) / (result.segments * 2);
  let qualityMsg;
  if (avgDanger < 3) {
    qualityMsg = 'This is a LOW DANGER route. Roads are mostly clear and safe for evacuation.';
  } else if (avgDanger < 7) {
    qualityMsg = 'This is a MODERATE DANGER route. Some roads have elevated risk due to the disaster. Proceed with caution.';
  } else {
    qualityMsg = 'This is a HIGH DANGER route. Most safe routes are blocked. Move quickly and stay alert.';
  }

  // Show route panel, hide placeholders
  document.getElementById('noRouteMsg').classList.add('hidden');
  document.getElementById('noRouteWarning').classList.add('hidden');
  document.getElementById('routeDetails').classList.remove('hidden');

  // Set status badge
  const statusEl = document.getElementById('routeStatus');
  statusEl.className = 'route-status ' + (avgDanger < 7 ? 'success' : 'warning');
  document.getElementById('routeStatusText').textContent = avgDanger < 7 ? 'Safe Route Found' : 'Route Found (Elevated Risk)';
  statusEl.querySelector('.route-status-icon').textContent = avgDanger < 7 ? '✅' : '⚠️';

  document.getElementById('resultFrom').textContent     = startName;
  document.getElementById('resultTo').textContent       = goalName;
  document.getElementById('resultPath').textContent     = result.path.join(' → ');
  document.getElementById('resultDist').textContent     = `${result.dist} km (road distance)`;
  document.getElementById('resultCost').textContent     = `${result.cost} units`;
  document.getElementById('resultSegments').textContent = `${result.segments} segments`;
  document.getElementById('resultAlt').textContent      = `${result.altCount} alternative${result.altCount !== 1 ? 's' : ''}`;
  document.getElementById('reasonText').textContent     = qualityMsg;
}

/** Show the no-route-warning state. */
function renderRouteFailure() {
  document.getElementById('noRouteMsg').classList.add('hidden');
  document.getElementById('routeDetails').classList.add('hidden');
  document.getElementById('noRouteWarning').classList.remove('hidden');
}

/* ============================================================
   SECTION 10 – ROAD BLOCK SIMULATION
   ============================================================ */

/** Block a random open road (for the "Simulate Road Blockage" button). */
function blockRandomRoad() {
  const openRoads = ROAD_EDGES.filter(e => !STATE.blockedRoads.has(e.id));
  if (!openRoads.length) {
    showNotification('All roads are already blocked!');
    return;
  }

  // If a route is shown, block a road ON that route so the effect is visible;
  // otherwise prefer high-danger roads.
  let pool;
  if (STATE.currentRoute) {
    pool = openRoads.filter(e => STATE.currentRoute.edges.includes(e.id));
  }
  if (!pool || !pool.length) {
    pool = [...openRoads].sort((a, b) => b.danger - a.danger).slice(0, 4);
  }
  const target = pool[Math.floor(Math.random() * pool.length)];

  STATE.blockedRoads.add(target.id);
  closePopup();
  drawRoads();
  showNotification(`🚧 Road blocked: ${target.label} (${target.id})`);

  // If a route was previously requested, recalculate
  if (STATE.routeActive) findRoute();
}

/** Toggle road blocked/unblocked – called from the map popup button. */
window.toggleRoadFromPopup = function (edgeId) {
  closePopup();

  if (STATE.blockedRoads.has(edgeId)) {
    STATE.blockedRoads.delete(edgeId);
    showNotification(`✅ Road ${edgeId} unblocked.`);
  } else {
    STATE.blockedRoads.add(edgeId);
    showNotification(`🚧 Road ${edgeId} blocked.`);
  }

  drawRoads();

  if (STATE.routeActive) findRoute();
};

/* ============================================================
   SECTION 11 – RESET
   ============================================================ */

function resetSimulation() {
  STATE.blockedRoads.clear();
  STATE.currentRoute = null;
  STATE.routeActive  = false;
  closePopup();
  drawRoute(null);
  drawRoads();

  // Reset UI
  document.getElementById('noRouteMsg').classList.remove('hidden');
  document.getElementById('routeDetails').classList.add('hidden');
  document.getElementById('noRouteWarning').classList.add('hidden');

  showNotification('🔄 Simulation reset. All roads cleared.');
}

/* ============================================================
   SECTION 12 – DEMO SCENARIO
   A flood is simulated, roads are blocked one by one, and the
   route visibly changes after every blockage.
   Riverside Colony (B) → City Emergency Shelter (S1)
   ============================================================ */

async function runDemo() {
  const panel    = document.getElementById('demoPanel');
  const stepText = document.getElementById('demoStep');
  const progress = document.getElementById('demoProgressBar');
  panel.classList.remove('hidden');

  const blockAndRecalc = (roadId) => {
    STATE.blockedRoads.add(roadId);
    drawRoads();
    findRoute();
  };

  const steps = [
    { msg: '🌊 Simulating FLOOD disaster – danger level 8…', pct: 12, action: () => {
      document.getElementById('disasterType').value = 'flood';
      STATE.disasterType = 'flood';
      setDangerLevel(8);
      updateDisasterUI();
    }},
    { msg: '🔧 Start: Riverside Colony → City Emergency Shelter…', pct: 25, action: () => {
      document.getElementById('startLocation').value = 'B';
      document.getElementById('destination').value   = 'S1';
      STATE.startNode = 'B';
      STATE.destNode  = 'S1';
      highlightStartNode('B');
    }},
    { msg: '📡 Calculating initial safe route…', pct: 40, action: () => findRoute() },
    { msg: '🚧 Low Bridge Road (R4) is flooded – blocking it…', pct: 55, action: () => blockAndRecalc('R4') },
    { msg: '🚧 Shelter Route 1 (R14) is submerged – blocking it…', pct: 70, action: () => blockAndRecalc('R14') },
    { msg: '🚧 Central Cross (R19) is cut off – blocking it…', pct: 85, action: () => blockAndRecalc('R19') },
    { msg: '✅ Demo complete! The route was recalculated after every blockage.', pct: 100, action: () => {} },
  ];

  for (const step of steps) {
    stepText.textContent = step.msg;
    progress.style.width = step.pct + '%';
    step.action();
    await delay(1400);
  }

  // Auto-close the panel after 2s so the user can inspect the final map
  await delay(2000);
  panel.classList.add('hidden');
  progress.style.width = '0%';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ============================================================
   SECTION 13 – UI HELPERS & EVENT LISTENERS
   ============================================================ */

/** Show a floating notification on the map */
function showNotification(msg) {
  const el = document.getElementById('mapNotification');
  document.getElementById('mapNotifText').textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

/** Update blocked road count in the stats bar */
function updateBlockedCount() {
  document.getElementById('statBlockedRoads').textContent = STATE.blockedRoads.size;
  document.getElementById('statDanger').textContent       = STATE.dangerLevel;
}

/** Set the danger level everywhere (state, slider, labels, badge colour). */
function setDangerLevel(level) {
  STATE.dangerLevel = level;
  document.getElementById('dangerLevel').value       = String(level);
  document.getElementById('dangerValue').textContent = level;
  document.getElementById('statDanger').textContent  = level;

  const badge = document.getElementById('dangerValue');
  if (level <= 3)      badge.style.background = '#22c55e';
  else if (level <= 6) badge.style.background = '#f59e0b';
  else                 badge.style.background = '#ef4444';
}

/** Update disaster effects panel highlighting */
function updateDisasterUI() {
  const type = STATE.disasterType;

  // Update header badge
  const badge = document.getElementById('disasterBadge');
  badge.className = 'disaster-indicator active-' + type;
  const labels = { flood: '🌊 Flood Active', fire: '🔥 Fire Active', earthquake: '🏚️ Earthquake Active' };
  document.getElementById('disasterLabel').textContent = labels[type] || 'No Active Disaster';

  // Highlight correct effect card
  ['flood', 'fire', 'earthquake'].forEach(d => {
    document.getElementById('effect' + d.charAt(0).toUpperCase() + d.slice(1))
      .classList.toggle('active', d === type);
  });

  // Redraw roads with new danger colours
  drawRoads();

  // If a route exists, recalculate
  if (STATE.routeActive) findRoute();
}

/* ── WIRE UP ALL EVENT LISTENERS ────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  const fill = (id, test, icon) => {
    document.getElementById(id).innerHTML = Object.values(NODES).filter(test)
      .map(n => `<option value="${n.id}">${icon} ${n.name}</option>`).join('');
  };
  fill('startLocation', n => n.type === 'start', '📍');
  fill('destination', n => n.type === 'shelter', '🏥');

  buildGraph();
  initMap();

  // ── Disaster type dropdown ──
  document.getElementById('disasterType').addEventListener('change', e => {
    STATE.disasterType = e.target.value;
    updateDisasterUI();
  });

  // ── Danger level slider ──
  document.getElementById('dangerLevel').addEventListener('input', e => {
    setDangerLevel(parseInt(e.target.value, 10));
    drawRoads();
    if (STATE.routeActive) findRoute();
  });

  // ── Start location dropdown ──
  document.getElementById('startLocation').addEventListener('change', e => {
    STATE.startNode = e.target.value;
    highlightStartNode(STATE.startNode);
  });

  // ── Destination dropdown ──
  document.getElementById('destination').addEventListener('change', e => {
    STATE.destNode = e.target.value;
  });

  // ── Find Route button ──
  document.getElementById('findRoute').addEventListener('click', findRoute);

  // ── Block Road button ──
  document.getElementById('blockRoad').addEventListener('click', blockRandomRoad);

  // ── Demo button ──
  document.getElementById('runDemo').addEventListener('click', async () => {
    if (STATE.demoRunning) return;
    STATE.demoRunning = true;
    try {
      resetSimulation();
      await runDemo();
    } catch (err) {
      console.error('Demo error:', err);
      showNotification('❌ Demo error: ' + err.message);
      document.getElementById('demoPanel').classList.add('hidden');
    } finally {
      STATE.demoRunning = false;
    }
  });

  // ── Reset button ──
  document.getElementById('resetSim').addEventListener('click', () => {
    resetSimulation();
    document.getElementById('disasterType').value  = 'flood';
    document.getElementById('startLocation').value = 'A';
    document.getElementById('destination').value   = 'S1';
    STATE.disasterType = 'flood';
    STATE.startNode    = 'A';
    STATE.destNode     = 'S1';
    setDangerLevel(5);
    highlightStartNode('A');
    updateDisasterUI();
  });

  // ── Initial state ──
  updateDisasterUI();
  highlightStartNode('A');

  setTimeout(() => {
    showNotification('👋 Welcome to SafeRoute AI! Click "Find Safest Route" or "Run Demo Scenario" to begin.');
  }, 800);
});
