// ============================================================
// Rockford Historic Industrial Property Survey Map
// Studio GWA — app.js
// ============================================================

mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

let map;
let parcelsData = null;       // parcel polygons FeatureCollection
let centroidsData = null;     // parcel centroid points FeatureCollection
let parcelsById = {};         // id -> feature (polygon)
let selectedId = null;
let hoveredFeatureId = null;

const els = {
  splash: document.getElementById('splash'),
  splashProgress: document.getElementById('splash-progress'),
  splashStatus: document.getElementById('splash-status'),
  searchInput: document.getElementById('search-input'),
  searchBox: document.querySelector('.search-box'),
  searchClear: document.getElementById('search-clear'),
  searchResults: document.getElementById('search-results'),
  emptyState: document.getElementById('empty-state'),
  snapshot: document.getElementById('snapshot'),
  snapshotBack: document.getElementById('snapshot-back'),
  snapAddress: document.getElementById('snap-address'),
  snapBuildingName: document.getElementById('snap-buildingname'),
  snapCopy: document.getElementById('snap-copy'),
  snapShare: document.getElementById('snap-share'),
  snapToast: document.getElementById('snap-toast'),
  snapFacts: document.getElementById('snap-facts'),
  snapNotesWrap: document.getElementById('snap-notes-wrap'),
  snapNotes: document.getElementById('snap-notes'),
  snapNearby: document.getElementById('snap-nearby'),
  parcelCount: document.getElementById('parcel-count'),
};

// ---------------- Splash progress ----------------
function setSplashProgress(pct, label) {
  els.splashProgress.style.width = pct + '%';
  if (label) els.splashStatus.textContent = label;
}
function hideSplash() {
  setTimeout(() => {
    els.splash.classList.add('splash-hidden');
  }, 350);
}

// ---------------- Utility ----------------
function fmtNum(v) {
  if (v === null || v === undefined || v === '') return null;
  return v;
}

function haversineFt(a, b) {
  // a, b = [lon, lat]; returns distance in feet
  const R = 20902231; // ft
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function boundsOfGeometry(geometry) {
  const bounds = new mapboxgl.LngLatBounds();
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      bounds.extend(coords);
    } else {
      coords.forEach(walk);
    }
  };
  walk(geometry.coordinates);
  return bounds;
}

// ---------------- Map init ----------------
map = new mapboxgl.Map({
  container: 'map',
  style: CONFIG.MAPBOX_STYLE,
  center: CONFIG.INITIAL_CENTER,
  zoom: CONFIG.INITIAL_ZOOM,
  attributionControl: true,
});
map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'top-right');

map.on('load', init);

async function init() {
  setSplashProgress(15, 'Loading TIF, Opportunity Zone & RERZ boundaries…');

  const [tif, oz, rerz, parcels, centroids] = await Promise.all([
    fetch(CONFIG.DATA.tif).then((r) => r.json()),
    fetch(CONFIG.DATA.oz).then((r) => r.json()),
    fetch(CONFIG.DATA.rerz).then((r) => r.json()),
    fetch(CONFIG.DATA.parcels).then((r) => r.json()),
    fetch(CONFIG.DATA.centroids).then((r) => r.json()),
  ]);

  setSplashProgress(55, 'Indexing surveyed properties…');

  parcelsData = parcels;
  centroidsData = centroids;
  parcelsData.features.forEach((f) => (parcelsById[f.properties.id] = f));
  els.parcelCount.textContent = parcelsData.features.length;

  // ---- Sources ----
  map.addSource('tif', { type: 'geojson', data: tif });
  map.addSource('oz', { type: 'geojson', data: oz });
  map.addSource('rerz', { type: 'geojson', data: rerz });
  map.addSource('parcels-poly', {
    type: 'geojson',
    data: parcelsData,
    promoteId: 'id',
  });

  setSplashProgress(75, 'Styling map layers…');

  // Boundary layers start hidden — the legend checkboxes turn them on.
  // Colors are deliberately three distinct hues (not three shades of the
  // same green) so overlapping boundaries stay legible: mid green for TIF,
  // dark charcoal grey for Opportunity Zones, and a warm terracotta accent
  // for the RERZ — the terracotta isn't in the core swatch set but reads as
  // an earthy complement to the brand greens.

  // ---- RERZ (terracotta accent) ----
  map.addLayer({
    id: 'rerz-fill',
    type: 'fill',
    source: 'rerz',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#b5764a', 'fill-opacity': 0.2 },
  });
  map.addLayer({
    id: 'rerz-outline',
    type: 'line',
    source: 'rerz',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#b5764a', 'line-width': 2 },
  });

  // ---- OZ (dark grey) ----
  map.addLayer({
    id: 'oz-fill',
    type: 'fill',
    source: 'oz',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#454948', 'fill-opacity': 0.14 },
  });
  map.addLayer({
    id: 'oz-outline',
    type: 'line',
    source: 'oz',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#454948', 'line-width': 1.8, 'line-dasharray': [2, 1.4] },
  });

  // ---- TIF (mid green) ----
  map.addLayer({
    id: 'tif-fill',
    type: 'fill',
    source: 'tif',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#7ba457', 'fill-opacity': 0.2 },
  });
  map.addLayer({
    id: 'tif-outline',
    type: 'line',
    source: 'tif',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#7ba457', 'line-width': 1.6 },
  });

  // ---- Parcel polygons (always visible, primary click target) ----
  map.addLayer({
    id: 'parcels-fill',
    type: 'fill',
    source: 'parcels-poly',
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], '#7ba457',
        '#454948',
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 0.35,
        ['boolean', ['feature-state', 'hover'], false], 0.28,
        0.12,
      ],
    },
  });
  map.addLayer({
    id: 'parcels-outline',
    type: 'line',
    source: 'parcels-poly',
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], '#779354',
        '#454948',
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 3,
        1.4,
      ],
    },
  });

  setSplashProgress(100, 'Ready.');
  hideSplash();

  fitToParcels();
  bindMapInteractions();
  bindUI();
  bindLayerToggles();
  bindMobileLayersControl();
  initSheet();
  checkDeepLink();
}

// ---------------- Layer toggles ----------------
function bindLayerToggles() {
  document.querySelectorAll('.legend-list input[type="checkbox"]').forEach((input) => {
    const layer = input.dataset.layer;
    input.addEventListener('change', () => {
      const visibility = input.checked ? 'visible' : 'none';
      [`${layer}-fill`, `${layer}-outline`].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
      });
    });
  });
}

function bindMobileLayersControl() {
  const toggle = document.getElementById('mobile-layers-toggle');
  const panel = document.getElementById('mobile-layers-panel');
  const wrap = document.getElementById('mobile-layers');
  if (!toggle || !panel || !wrap) return;

  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('hidden') === false;
    toggle.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      panel.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function fitToParcels() {
  const bounds = new mapboxgl.LngLatBounds();
  centroidsData.features.forEach((f) => bounds.extend(f.geometry.coordinates));
  map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
}

// ---------------- Mobile bottom sheet (Option A) ----------------
// Only affects layout under the 860px breakpoint defined in style.css.
// Three snap positions so the map is never fully hidden unless the
// viewer deliberately drags all the way up:
//   collapsed — handle + search bar only
//   half      — panel covers ~48% of the screen, map still visible above
//   full      — panel covers nearly the whole screen
const SHEET_PEEK_PX = 108;
const SHEET_HALF_RATIO = 0.48; // fraction of sheet height visible in "half"
const SHEET_FULL_MARGIN_PX = 56; // gap left at the top in "full", so the map peeks through

let sheetExpandFn = null;
let sheetCollapseFn = null;

function initSheet() {
  const sidebar = document.getElementById('sidebar');
  const handle = document.getElementById('sheet-handle');
  if (!sidebar || !handle) return;

  const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

  // translateY in px for each state, computed against the sheet's current height
  const snapPoints = () => {
    const h = sidebar.offsetHeight || window.innerHeight;
    return {
      collapsed: Math.max(0, h - SHEET_PEEK_PX),
      half: Math.max(0, h * (1 - SHEET_HALF_RATIO)),
      full: Math.max(0, SHEET_FULL_MARGIN_PX),
    };
  };

  let state = 'collapsed';
  let currentY = snapPoints().collapsed;

  function applyY(y, animate) {
    currentY = y;
    sidebar.classList.toggle('sheet-dragging', !animate);
    sidebar.style.setProperty('--sheet-y', `${y}px`);
  }

  function goTo(nextState) {
    state = nextState;
    applyY(snapPoints()[nextState], true);
  }

  function nearestState(y) {
    const pts = snapPoints();
    let best = 'collapsed';
    let bestDist = Infinity;
    for (const key of Object.keys(pts)) {
      const d = Math.abs(pts[key] - y);
      if (d < bestDist) {
        bestDist = d;
        best = key;
      }
    }
    return best;
  }

  const cycle = { collapsed: 'half', half: 'full', full: 'collapsed' };

  sheetExpandFn = () => { if (isMobile()) goTo('half'); };
  sheetCollapseFn = () => { if (isMobile()) goTo('collapsed'); };

  // Keep the sheet aligned to a valid snap point on resize/orientation change.
  window.addEventListener('resize', () => {
    if (!isMobile()) return;
    applyY(snapPoints()[state], true);
  });

  // ---- Drag handling ----
  // Listeners are attached to the window (not just the handle) once a drag
  // starts, so fast or slightly-off-target finger movement doesn't drop
  // the gesture partway through.
  let dragging = false;
  let moved = false;
  let startY = 0;
  let startTranslate = 0;

  function onPointerDown(e) {
    if (!isMobile()) return;
    dragging = true;
    moved = false;
    startY = e.clientY;
    startTranslate = currentY;
    applyY(currentY, false);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 4) moved = true;
    const pts = snapPoints();
    const next = Math.max(pts.full, Math.min(pts.collapsed, startTranslate + dy));
    applyY(next, false);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    if (!moved) {
      goTo(cycle[state]);
    } else {
      goTo(nearestState(currentY));
    }
  }

  handle.addEventListener('pointerdown', onPointerDown);

  // Initialize to the collapsed position once layout has settled.
  requestAnimationFrame(() => goTo('collapsed'));
}

// ---------------- Map interactions ----------------
function bindMapInteractions() {
  map.on('click', 'parcels-fill', (e) => {
    const id = e.features[0].properties.id;
    selectParcel(id, true);
  });

  map.on('mouseenter', 'parcels-fill', () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', 'parcels-fill', () => (map.getCanvas().style.cursor = ''));

  // hover highlight on parcel polygons
  map.on('mousemove', 'parcels-fill', (e) => {
    if (!e.features.length) return;
    if (hoveredFeatureId !== null) {
      map.setFeatureState({ source: 'parcels-poly', id: hoveredFeatureId }, { hover: false });
    }
    hoveredFeatureId = e.features[0].id;
    map.setFeatureState({ source: 'parcels-poly', id: hoveredFeatureId }, { hover: true });
  });
  map.on('mouseleave', 'parcels-fill', () => {
    if (hoveredFeatureId !== null) {
      map.setFeatureState({ source: 'parcels-poly', id: hoveredFeatureId }, { hover: false });
    }
    hoveredFeatureId = null;
  });
}

// ---------------- Search ----------------
function bindUI() {
  els.searchInput.addEventListener('input', onSearchInput);
  els.searchClear.addEventListener('click', () => {
    els.searchInput.value = '';
    els.searchBox.classList.remove('has-value');
    els.searchResults.innerHTML = '';
  });
  els.snapshotBack.addEventListener('click', deselectParcel);
  els.snapCopy.addEventListener('click', copyShareLink);
  els.snapShare.addEventListener('click', shareParcel);
}

function onSearchInput() {
  const q = els.searchInput.value.trim().toLowerCase();
  els.searchBox.classList.toggle('has-value', q.length > 0);
  if (q) sheetExpandFn?.(); // on mobile, reveal the sheet so results are visible
  if (!q) {
    els.searchResults.innerHTML = '';
    return;
  }
  const matches = parcelsData.features
    .filter((f) => {
      const p = f.properties;
      return (
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.building_name && p.building_name.toLowerCase().includes(q)) ||
        (p.current_owner && p.current_owner.toLowerCase().includes(q)) ||
        (p.original_industry && p.original_industry.toLowerCase().includes(q))
      );
    })
    .slice(0, 12);

  if (!matches.length) {
    els.searchResults.innerHTML = '<div class="search-no-results">No surveyed properties match that search.</div>';
    return;
  }

  els.searchResults.innerHTML = matches
    .map((f) => {
      const p = f.properties;
      const flags = [];
      if (p.tif === 'Y') flags.push('<span class="sr-flag on-tif">TIF</span>');
      if (p.oz === 'Y') flags.push('<span class="sr-flag on-oz">OZ</span>');
      if (p.rerz === 'Y') flags.push('<span class="sr-flag on-rerz">RERZ</span>');
      return `<div class="search-result-item" data-id="${p.id}">
        <div class="sr-title">${p.address || 'Unknown address'}</div>
        <div class="sr-sub">${p.building_name || ''}</div>
        ${flags.length ? `<div class="sr-flags">${flags.join('')}</div>` : ''}
      </div>`;
    })
    .join('');

  els.searchResults.querySelectorAll('.search-result-item').forEach((el) => {
    el.addEventListener('click', () => selectParcel(el.dataset.id, true));
  });
}

// ---------------- Select / deselect parcel ----------------
function selectParcel(id, flyTo) {
  const feature = parcelsById[id];
  if (!feature) return;

  if (selectedId !== null) {
    map.setFeatureState({ source: 'parcels-poly', id: selectedId }, { selected: false });
  }
  selectedId = id;
  map.setFeatureState({ source: 'parcels-poly', id }, { selected: true });

  els.emptyState.classList.add('hidden');
  els.snapshot.classList.remove('hidden');
  els.searchResults.innerHTML = '';

  renderSnapshot(feature);
  sheetExpandFn?.(); // on mobile, reveal the sheet so the snapshot is visible

  if (flyTo) {
    const bounds = boundsOfGeometry(feature.geometry);
    map.fitBounds(bounds, { padding: framingPadding(), maxZoom: 17, duration: 900 });
  }

  // update URL for shareability without reloading
  const url = new URL(window.location.href);
  url.searchParams.set('p', id);
  window.history.replaceState({}, '', url);
}

// Padding for fitBounds that keeps the framed feature clear of whatever's
// currently covering the map — the 400px sidebar on desktop, or the
// half-open bottom sheet on mobile (see initSheet's SHEET_HALF_RATIO).
function framingPadding() {
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  if (!isMobile) return 140;
  const headerH = 72;
  const sheetHalfPx = Math.round((window.innerHeight - headerH) * 0.48);
  return { top: 50, bottom: sheetHalfPx + 40, left: 40, right: 40 };
}

function deselectParcel() {
  if (selectedId !== null) {
    map.setFeatureState({ source: 'parcels-poly', id: selectedId }, { selected: false });
  }
  selectedId = null;
  els.snapshot.classList.add('hidden');
  els.emptyState.classList.remove('hidden');
  sheetCollapseFn?.(); // on mobile, tuck the sheet back to a peek

  // reset the map to the full survey extent
  if (centroidsData) {
    const bounds = new mapboxgl.LngLatBounds();
    centroidsData.features.forEach((f) => bounds.extend(f.geometry.coordinates));
    map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 900 });
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('p');
  window.history.replaceState({}, '', url);
}

// ---------------- Snapshot rendering ----------------
function statusRow(rowId, isYes, valueText) {
  const row = document.getElementById(rowId);
  row.classList.toggle('is-yes', isYes);
  row.classList.toggle('is-no', !isYes);
  document.getElementById(rowId + '-value').textContent = valueText;
}

function renderSnapshot(feature) {
  const p = feature.properties;

  els.snapAddress.textContent = p.address || 'Address unavailable';
  els.snapBuildingName.textContent = p.building_name || '';
  els.snapBuildingName.style.display = p.building_name ? '' : 'none';

  // Status rows
  statusRow('status-tif', p.tif === 'Y', p.tif === 'Y' ? (p.tif_district || 'Yes — district name not on file') : 'Not in a TIF district');
  statusRow('status-oz', p.oz === 'Y', p.oz === 'Y' ? 'Yes — Qualified Opportunity Zone' : 'Not in an Opportunity Zone');
  statusRow('status-rerz', p.rerz === 'Y', p.rerz === 'Y' ? 'Yes — River Edge Redevelopment Zone' : 'Not in the RERZ');

  // Facts
  const facts = [
    ['Original Industry', p.original_industry],
    ['Later Industries', p.later_industries],
    ['Year Built', p.year_built],
    ['Additions', p.year_built_additions],
    ['Architect', p.architect],
    ['Contractor', p.contractor],
    ['Building Sq Ft', p.building_sqft],
    ['Land Sq Ft', p.land_sqft],
    ['Stories', p.stories],
    ['Structural System', p.structural_system],
    ['Style / Detail', p.style],
    ['Survey Status', p.resource_status],
    ['Significance Criteria', p.historic_criteria],
    ['Geographic Quadrant', p.quadrant],
    ['Current Owner', p.current_owner],
    ['Current Tenant(s)', p.current_tenants],
    ['Parcel PIN', p.pin],
  ];

  els.snapFacts.innerHTML = facts
    .filter(([, v]) => fmtNum(v))
    .map(
      ([label, v]) => `<div class="snap-fact"><dt>${label}</dt><dd>${v}</dd></div>`
    )
    .join('');

  if (p.notes) {
    els.snapNotesWrap.classList.remove('hidden');
    els.snapNotes.textContent = p.notes;
  } else {
    els.snapNotesWrap.classList.add('hidden');
  }

  renderNearby(feature);
}

function renderNearby(feature) {
  const centroidFeat = centroidsData.features.find((f) => f.properties.id === feature.properties.id);
  if (!centroidFeat) {
    els.snapNearby.innerHTML = '<li class="snap-nearby-empty">No nearby properties found.</li>';
    return;
  }
  const origin = centroidFeat.geometry.coordinates;

  const distances = centroidsData.features
    .filter((f) => f.properties.id !== feature.properties.id)
    .map((f) => ({
      id: f.properties.id,
      address: f.properties.address,
      distFt: haversineFt(origin, f.geometry.coordinates),
    }))
    .sort((a, b) => a.distFt - b.distFt)
    .slice(0, 5);

  if (!distances.length) {
    els.snapNearby.innerHTML = '<li class="snap-nearby-empty">No nearby properties found.</li>';
    return;
  }

  els.snapNearby.innerHTML = distances
    .map((d) => {
      const distLabel = d.distFt > 2800 ? `${(d.distFt / 5280).toFixed(2)} mi` : `${Math.round(d.distFt)} ft`;
      return `<li class="snap-nearby-item" data-id="${d.id}">
        <span>${d.address || 'Unknown address'}</span>
        <span class="snap-nearby-dist">${distLabel}</span>
      </li>`;
    })
    .join('');

  els.snapNearby.querySelectorAll('.snap-nearby-item').forEach((el) => {
    el.addEventListener('click', () => selectParcel(el.dataset.id, true));
  });
}

// ---------------- Share / copy ----------------
function currentShareUrl() {
  const url = new URL(CONFIG.SHARE_BASE_URL);
  url.searchParams.set('p', selectedId);
  return url.toString();
}

function showToast() {
  els.snapToast.classList.add('show');
  setTimeout(() => els.snapToast.classList.remove('show'), 1800);
}

function copyShareLink() {
  if (!selectedId) return;
  const url = currentShareUrl();
  navigator.clipboard?.writeText(url).then(showToast).catch(() => {
    const tmp = document.createElement('input');
    document.body.appendChild(tmp);
    tmp.value = url;
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    showToast();
  });
}

function shareParcel() {
  if (!selectedId) return;
  const feature = parcelsById[selectedId];
  const url = currentShareUrl();
  const title = `${feature.properties.address} — Rockford Historic Industrial Property Survey`;
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    copyShareLink();
  }
}

// ---------------- Deep linking ----------------
function checkDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('p');
  if (id && parcelsById[id]) {
    selectParcel(id, true);
  }
}
