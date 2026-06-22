/* ─────────────────────────────────────────────────────────────────
   OliveAnnotate — app.js
   Phase 7: Polygon Annotation Mode
───────────────────────────────────────────────────────────────── */

'use strict';

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

// ── Screen navigation ─────────────────────────────────────────
const screens = {
  home:     document.getElementById('screen-home'),
  camera:   document.getElementById('screen-camera'),
  annotate: document.getElementById('screen-annotate'),
  review:   document.getElementById('screen-review'),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  if (screens[name]) screens[name].classList.add('active');
}

// ── Toast ─────────────────────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg, durationMs = 2500) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), durationMs);
}

// ── Session (localStorage) ────────────────────────────────────
function getSession() {
  return {
    annotator: localStorage.getItem('oa_annotator') || '',
    sessionId: localStorage.getItem('oa_session')   || '',
    location:  localStorage.getItem('oa_location')  || '',
  };
}

function saveSession(annotator, sessionId, location) {
  localStorage.setItem('oa_annotator', annotator);
  localStorage.setItem('oa_session',   sessionId);
  localStorage.setItem('oa_location',  location || '');
}

// ── IndexedDB ─────────────────────────────────────────────────
const DB_NAME    = 'olive-annotate-db';
const DB_VERSION = 1;
let db = null;

async function openDB() {
  db = await idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('images')) {
        database.createObjectStore('images', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('blobs')) {
        database.createObjectStore('blobs', { keyPath: 'id' });
      }
    },
  });
}

async function getAllImagesForSession(sessionId) {
  const all = await db.getAll('images');
  return all.filter((r) => r.session === sessionId);
}

async function getImageRecord(id)       { return db.get('images', id); }
async function saveImageRecord(record)  { return db.put('images', record); }
async function saveBlobRecord(id, blob) { return db.put('blobs', { id, blob }); }
async function getBlobRecord(id) {
  const entry = await db.get('blobs', id);
  return entry ? entry.blob : null;
}
async function deleteImageAndBlob(id) {
  await db.delete('images', id);
  await db.delete('blobs', id);
}

// ── Setup modal ───────────────────────────────────────────────
const setupModal      = document.getElementById('setup-modal');
const inputAnnotator  = document.getElementById('input-annotator');
const inputSession    = document.getElementById('input-session');
const inputLocation   = document.getElementById('input-location');
const btnSetupConfirm = document.getElementById('btn-setup-confirm');

function openSetupModal() {
  const { annotator, sessionId, location } = getSession();
  const isFirstLaunch = !annotator && !sessionId;
  inputAnnotator.value = annotator;
  inputSession.value   = sessionId;
  inputLocation.value  = location;
  btnSetupConfirm.textContent = isFirstLaunch ? 'Start Session' : 'Update Session';
  setupModal.classList.remove('hidden');
  inputAnnotator.focus();
}

function closeSetupModal() { setupModal.classList.add('hidden'); }

btnSetupConfirm.addEventListener('click', async () => {
  const annotator = inputAnnotator.value.trim();
  const sessionId = inputSession.value.trim();
  const location  = inputLocation.value.trim();
  if (!annotator || !sessionId) { showToast('Please fill in Annotator and Session ID.'); return; }
  const isFirstLaunch = btnSetupConfirm.textContent === 'Start Session';
  saveSession(annotator, sessionId, location);
  closeSetupModal();
  await applySession();
  showToast(isFirstLaunch
    ? `Session "${sessionId}" started.`
    : `Session updated to "${sessionId}".`);
});

[inputAnnotator, inputSession, inputLocation].forEach((inp) => {
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnSetupConfirm.click(); });
});

document.getElementById('btn-settings').addEventListener('click', openSetupModal);

// ── Home screen ───────────────────────────────────────────────
const imageGrid    = document.getElementById('image-grid');
const emptyState   = document.getElementById('empty-state');
const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');
const thumbURLs    = new Map();

function updateProgress(annotated, total) {
  progressText.textContent = `${annotated} of ${total} annotated`;
  const pct = total > 0 ? Math.round((annotated / total) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  progressFill.parentElement.setAttribute('aria-valuenow', pct);
}

async function renderHomeGrid() {
  const { sessionId } = getSession();
  if (!sessionId || !db) return;

  const records = await getAllImagesForSession(sessionId);
  thumbURLs.forEach((url) => URL.revokeObjectURL(url));
  thumbURLs.clear();
  imageGrid.innerHTML = '';

  if (records.length === 0) {
    emptyState.style.display = 'flex';
    updateProgress(0, 0);
    return;
  }

  emptyState.style.display = 'none';
  records.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  const annotatedCount = records.filter((r) => r.status === 'annotated').length;
  updateProgress(annotatedCount, records.length);

  for (const record of records) {
    const blob = await getBlobRecord(record.image_blob_key);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    thumbURLs.set(record.id, url);

    const card = document.createElement('div');
    card.className = 'image-card';
    card.setAttribute('role', 'listitem');
    card.dataset.id = record.id;
    const annCount = record.annotations.length;
    card.innerHTML = `
      <img src="${url}" alt="Captured image" loading="lazy" />
      <div class="card-footer">
        <span class="badge badge-${record.status}">${record.status}</span>
        <span style="font-size:0.7rem;color:var(--color-panel-alt)">${annCount} ann.</span>
        <button class="card-delete-btn" aria-label="Delete image" title="Delete image">🗑</button>
      </div>
    `;
    card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteModal(record.id);
    });
    card.addEventListener('click', () => openAnnotateScreen(record.id));
    imageGrid.appendChild(card);
  }
}

async function applySession() {
  const { sessionId } = getSession();
  document.getElementById('session-label').textContent =
    sessionId ? `Session: ${sessionId}` : '';
  await renderHomeGrid();
}

// ── Delete image ──────────────────────────────────────────────
const deleteModal = document.getElementById('delete-modal');
let pendingDeleteId = null;

function openDeleteModal(id) {
  pendingDeleteId = id;
  deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  deleteModal.classList.add('hidden');
}

document.getElementById('btn-delete-cancel').addEventListener('click', closeDeleteModal);

document.getElementById('btn-delete-confirm').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  closeDeleteModal();
  await deleteImageAndBlob(id);
  showToast('Image deleted.');
  await renderHomeGrid();
});

// ── Camera ────────────────────────────────────────────────────
const videoEl       = document.getElementById('camera-viewfinder');
const captureCanvas = document.getElementById('capture-canvas');
let cameraStream    = null;
let selectedCameraId = null;

async function startCamera(deviceId = null) {
  const videoConstraint = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 4096 }, height: { ideal: 3072 } }
    : { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } };
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false });
  } catch {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      showToast('Camera access denied. Use "Library" to choose an image.');
      return;
    }
  }
  videoEl.srcObject = cameraStream;
  if (!isIOSDevice()) await populateCameraSelect();
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
    videoEl.srcObject = null;
  }
}

async function populateCameraSelect() {
  const selectEl = document.getElementById('camera-select');
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((d) => d.kind === 'videoinput');

  // Sync selectedCameraId from the active stream track
  if (cameraStream) {
    const track = cameraStream.getVideoTracks()[0];
    if (track) selectedCameraId = track.getSettings().deviceId || selectedCameraId;
  }

  selectEl.innerHTML = '';
  videoInputs.forEach((device, i) => {
    const opt = document.createElement('option');
    opt.value = device.deviceId;
    opt.textContent = device.label || `Camera ${i + 1}`;
    opt.selected = device.deviceId === selectedCameraId;
    selectEl.appendChild(opt);
  });

  selectEl.style.display = videoInputs.length > 1 ? 'block' : 'none';
}

document.getElementById('camera-select').addEventListener('change', async (e) => {
  selectedCameraId = e.target.value;
  stopCamera();
  await startCamera(selectedCameraId);
});

if (!isIOSDevice()) {
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    if (cameraStream) await populateCameraSelect();
  });
}

function captureFrame() {
  if (!videoEl.videoWidth) { showToast('Camera not ready — try again.'); return; }
  captureCanvas.width  = videoEl.videoWidth;
  captureCanvas.height = videoEl.videoHeight;
  captureCanvas.getContext('2d').drawImage(videoEl, 0, 0);
  showToast('Saving…', 1000);
  captureCanvas.toBlob(
    (blob) => {
      if (!blob) { showToast('Capture failed — try again.'); return; }
      storeNewImage(blob, captureCanvas.width, captureCanvas.height);
    },
    'image/jpeg', 0.92,
  );
}

async function handleLibraryFile(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
  showToast('Loading…', 1000);
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { showToast('Could not read this image format.'); return; }
  captureCanvas.width  = bitmap.width;
  captureCanvas.height = bitmap.height;
  captureCanvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  captureCanvas.toBlob(
    (blob) => {
      if (!blob) { showToast('Image conversion failed.'); return; }
      storeNewImage(blob, captureCanvas.width, captureCanvas.height);
    },
    'image/jpeg', 0.92,
  );
}

// ── Image storage ─────────────────────────────────────────────
let currentImageId = null;

async function storeNewImage(blob, width, height) {
  const { annotator, sessionId } = getSession();
  const id = crypto.randomUUID();
  await saveBlobRecord(id, blob);
  const record = {
    id,
    session:        sessionId,
    captured_at:    new Date().toISOString(),
    image_blob_key: id,
    image_width:    width,
    image_height:   height,
    annotator,
    device_ua:      navigator.userAgent,
    disease:               null,
    cultivar:              null,
    cultivar_susceptibility: null,
    kluepfal_rating:       null,
    camera_height:         null,
    camera_distance:       null,
    camera_angle:          null,
    gall_distribution:     null,
    bark_texture:          null,
    image_lighting:        null,
    notes:                 null,
    annotations:           [],
    status:                'pending',
  };
  await saveImageRecord(record);
  stopCamera();
  currentImageId = id;
  await openAnnotateScreen(id);
}

// ── Classification schema ─────────────────────────────────────
const CLASSIFICATION_SCHEMA = [
  {
    field: 'annotation_type', label: 'Type', required: true,
    options: [
      { value: 'gall',           label: 'Gall' },
      { value: 'shadow',         label: 'Shadow' },
      { value: 'scar',           label: 'Scar' },
      { value: 'pruning_callus', label: 'Pruning Callus' },
      { value: 'bark',           label: 'Bark' },
      { value: 'other',          label: 'Other' },
    ],
  },
  {
    field: 'gall_stage', label: 'Gall Stage', required: false,
    options: [
      { value: 'fresh', label: 'Fresh' },
      { value: 'aged',  label: 'Aged' },
      { value: 'old',   label: 'Old' },
    ],
  },
  {
    field: 'gall_texture', label: 'Gall Texture', required: false, multiSelect: true,
    options: [
      { value: 'cracking', label: 'Cracking' },
      { value: 'rugose',   label: 'Rugose' },
      { value: 'smooth',   label: 'Smooth' },
    ],
  },
  {
    field: 'location_on_tree', label: 'Location on Tree', required: false,
    options: [
      { value: 'trunk',        label: 'Trunk' },
      { value: 'branch_union', label: 'Branch Union' },
      { value: 'branch_base',  label: 'Branch Base' },
      { value: 'scaffold',     label: 'Scaffold' },
      { value: 'shoot',        label: 'Shoot' },
    ],
  },
  {
    field: 'lighting', label: 'Lighting', required: false,
    options: [
      { value: 'sun_exposed', label: 'Sun-Exposed' },
      { value: 'shaded',      label: 'Shaded' },
    ],
  },
];

let currentClassification = {};
CLASSIFICATION_SCHEMA.forEach(({ field, multiSelect }) => {
  currentClassification[field] = multiSelect ? [] : null;
});

function updateSaveButtonState() {
  const allFilled = CLASSIFICATION_SCHEMA
    .filter((g) => g.required)
    .every((g) => {
      const v = currentClassification[g.field];
      return g.multiSelect ? v.length > 0 : v !== null;
    });
  document.getElementById('btn-save-annotation').style.opacity = allFilled ? '1' : '0.45';
}

function resetClassificationPanel() {
  CLASSIFICATION_SCHEMA.forEach(({ field, multiSelect }) => {
    currentClassification[field] = multiSelect ? [] : null;
  });
  document.querySelectorAll('#classification-fields .chip').forEach((c) => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  updateSaveButtonState();
}

function buildClassificationPanel() {
  const container = document.getElementById('classification-fields');
  container.innerHTML = '';
  CLASSIFICATION_SCHEMA.forEach((group) => {
    const section = document.createElement('div');
    section.className = 'panel-section';
    const labelEl = document.createElement('p');
    labelEl.className = 'panel-label';
    labelEl.textContent = group.label + (group.required ? ' *' : '') +
      (group.multiSelect ? ' (select all that apply)' : '');
    section.appendChild(labelEl);
    const chipRow = document.createElement('div');
    chipRow.className = 'chip-row';
    chipRow.setAttribute('role', 'group');
    chipRow.setAttribute('aria-label', group.label);
    group.options.forEach((opt) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = opt.label;
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => {
        if (group.multiSelect) {
          const arr = currentClassification[group.field];
          const idx = arr.indexOf(opt.value);
          if (idx === -1) {
            arr.push(opt.value);
            chip.classList.add('selected');
            chip.setAttribute('aria-pressed', 'true');
          } else {
            arr.splice(idx, 1);
            chip.classList.remove('selected');
            chip.setAttribute('aria-pressed', 'false');
          }
        } else {
          chipRow.querySelectorAll('.chip').forEach((c) => {
            c.classList.remove('selected');
            c.setAttribute('aria-pressed', 'false');
          });
          chip.classList.add('selected');
          chip.setAttribute('aria-pressed', 'true');
          currentClassification[group.field] = opt.value;
        }
        updateSaveButtonState();
      });
      chipRow.appendChild(chip);
    });
    section.appendChild(chipRow);
    container.appendChild(section);
  });
  updateSaveButtonState();
}

// ── Annotation state ──────────────────────────────────────────
let confirmedAnnotations = [];
let currentAnnotation    = null;

// Bbox draw state
let isDrawing    = false;
let drawStart    = null;
let currentDragPos = null;

// Polygon draw state
const SNAP_RADIUS  = 22;   // canvas px — tap within this distance of first vertex to close
let polygonPoints  = [];   // {x, y} in canvas coords, accumulated during placement
let polygonLivePos = null; // current pointer position for the live-preview line
let polyTapStart   = null; // pointerdown position, used to distinguish tap from drag

// Scale / image dimensions
let displayScale   = 1;
let currentImgWidth  = 0;
let currentImgHeight = 0;

// ── Canvas setup ──────────────────────────────────────────────
const annotationCanvas    = document.getElementById('annotation-canvas');
const classificationPanel = document.getElementById('classification-panel');
let currentImageBitmap    = null;

function openClassificationPanel() {
  resetClassificationPanel();
  classificationPanel.classList.add('open');
}

function closeClassificationPanel() {
  classificationPanel.classList.remove('open');
}

// ── Drawing helpers ───────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/*
 * drawAnnotationLabel — shared by bbox and polygon.
 * Draws a filled rectangle badge with white index number inside.
 * Position is the top-left corner of the badge.
 */
function drawAnnotationLabel(ctx, x, y, label, color) {
  const pad = 4, fs = 13;
  ctx.font = `bold ${fs}px system-ui, sans-serif`;
  const bw = Math.ceil(ctx.measureText(String(label)).width) + pad * 2;
  const bh = fs + pad * 2;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), bw, bh);
  ctx.fillStyle = '#fff';
  ctx.fillText(String(label), Math.round(x) + pad, Math.round(y) + fs + pad - 1);
}

function drawBbox(ctx, x, y, w, h, color, label) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2.5;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
  if (label !== undefined) drawAnnotationLabel(ctx, x, y, label, color);
  ctx.restore();
}

/*
 * drawVertexDot — filled circle with white border at each polygon vertex.
 * When showSnapRing is true (first vertex with 3+ points placed), a dashed
 * ring shows the tap target radius to hint that the polygon can be closed.
 */
function drawVertexDot(ctx, x, y, color, showSnapRing = false) {
  ctx.save();
  if (showSnapRing) {
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(Math.round(x), Math.round(y), SNAP_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle   = color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(Math.round(x), Math.round(y), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/*
 * drawPolygon — renders a polygon in canvas coordinates.
 * points:  [{x, y}, …]
 * closed:  if true, path is closed and filled at 18% opacity
 * label:   optional index number, drawn at the visual centroid
 */
function drawPolygon(ctx, points, color, closed, label) {
  if (points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';

  ctx.beginPath();
  ctx.moveTo(Math.round(points[0].x), Math.round(points[0].y));
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(Math.round(points[i].x), Math.round(points[i].y));
  }
  if (closed && points.length >= 3) ctx.closePath();
  if (points.length >= 2 || closed) ctx.stroke();

  // Semi-transparent fill — spec calls for #D4780A at 20% opacity
  if (closed && points.length >= 3) {
    ctx.fillStyle = hexToRgba(color, 0.18);
    ctx.fill('evenodd');  // handles self-intersecting polygons gracefully
  }

  // Vertex dots — snap ring on first vertex when polygon can be closed
  points.forEach((p, i) => {
    const showSnap = !closed && i === 0 && points.length >= 3;
    drawVertexDot(ctx, p.x, p.y, color, showSnap);
  });

  // Numbered badge at visual centroid for confirmed polygons
  if (label !== undefined && closed && points.length >= 3) {
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    drawAnnotationLabel(ctx, cx - 11, cy - 11, label, color); // centre the badge
  }

  ctx.restore();
}

// ── Canvas redraw ─────────────────────────────────────────────
function redrawCanvas() {
  if (!currentImageBitmap) return;
  const ctx = annotationCanvas.getContext('2d');
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  ctx.drawImage(currentImageBitmap, 0, 0, annotationCanvas.width, annotationCanvas.height);

  // ── Confirmed annotations (green) ─────────────────
  confirmedAnnotations.forEach((ann, i) => {
    if (ann.type === 'bbox') {
      drawBbox(ctx,
        ann.coords.x * displayScale, ann.coords.y * displayScale,
        ann.coords.w * displayScale, ann.coords.h * displayScale,
        '#4A7C59', i + 1);
    } else if (ann.type === 'polygon') {
      const pts = ann.points.map(([x, y]) => ({ x: x * displayScale, y: y * displayScale }));
      drawPolygon(ctx, pts, '#4A7C59', true, i + 1);
    }
  });

  // ── Bbox in-progress drag (orange, no badge) ──────
  if (isDrawing && drawStart && currentDragPos) {
    drawBbox(ctx,
      Math.min(drawStart.x, currentDragPos.x),
      Math.min(drawStart.y, currentDragPos.y),
      Math.abs(currentDragPos.x - drawStart.x),
      Math.abs(currentDragPos.y - drawStart.y),
      '#D4780A');
  }

  // ── Bbox awaiting classification (orange, no badge) ─
  if (currentAnnotation?.type === 'bbox') {
    drawBbox(ctx,
      currentAnnotation.coords.x * displayScale,
      currentAnnotation.coords.y * displayScale,
      currentAnnotation.coords.w * displayScale,
      currentAnnotation.coords.h * displayScale,
      '#D4780A');
  }

  // ── Polygon in-progress (open, orange) ────────────
  if (polygonPoints.length > 0) {
    drawPolygon(ctx, polygonPoints, '#D4780A', false);

    // Dashed preview line from last vertex to current pointer
    if (polygonLivePos) {
      const last = polygonPoints[polygonPoints.length - 1];
      ctx.save();
      ctx.strokeStyle = '#D4780A';
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(Math.round(last.x), Math.round(last.y));
      ctx.lineTo(Math.round(polygonLivePos.x), Math.round(polygonLivePos.y));
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Polygon awaiting classification (closed, orange) ─
  if (currentAnnotation?.type === 'polygon') {
    const pts = currentAnnotation.points.map(([x, y]) => ({
      x: x * displayScale,
      y: y * displayScale,
    }));
    drawPolygon(ctx, pts, '#D4780A', true);
  }
}

function resizeAndDrawCanvas() {
  if (!currentImageBitmap) return;
  const container = document.querySelector('.annotate-body');
  displayScale     = Math.min(
    container.clientWidth  / currentImageBitmap.width,
    container.clientHeight / currentImageBitmap.height,
  );
  currentImgWidth  = currentImageBitmap.width;
  currentImgHeight = currentImageBitmap.height;
  annotationCanvas.width  = Math.round(currentImageBitmap.width  * displayScale);
  annotationCanvas.height = Math.round(currentImageBitmap.height * displayScale);
  redrawCanvas();
}

window.addEventListener('resize', resizeAndDrawCanvas);

// ── Pointer Events ────────────────────────────────────────────
function getCanvasPos(e) {
  const rect = annotationCanvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

annotationCanvas.addEventListener('pointerdown', (e) => {
  if (currentAnnotation) return;
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  e.preventDefault();
  annotationCanvas.setPointerCapture(e.pointerId);

  if (currentTool === 'bbox') {
    drawStart = currentDragPos = getCanvasPos(e);
    isDrawing = true;
  } else if (currentTool === 'polygon') {
    polyTapStart = getCanvasPos(e);
  }
});

annotationCanvas.addEventListener('pointermove', (e) => {
  if (currentTool === 'bbox' && isDrawing) {
    e.preventDefault();
    currentDragPos = getCanvasPos(e);
    redrawCanvas();
  } else if (currentTool === 'polygon' && polygonPoints.length > 0 && !currentAnnotation) {
    polygonLivePos = getCanvasPos(e);
    redrawCanvas();
  }
});

annotationCanvas.addEventListener('pointerup', (e) => {
  e.preventDefault();

  if (currentTool === 'bbox' && isDrawing) {
    isDrawing = false;
    finalizeBbox(drawStart, getCanvasPos(e));
    drawStart = currentDragPos = null;
    return;
  }

  if (currentTool === 'polygon' && polyTapStart) {
    const pos  = getCanvasPos(e);
    const dist = Math.hypot(pos.x - polyTapStart.x, pos.y - polyTapStart.y);
    polyTapStart = null;
    // Treat as a tap only if pointer didn't drift more than 10 canvas px
    if (dist < 10) handlePolygonTap(pos);
  }
});

annotationCanvas.addEventListener('pointercancel', () => {
  isDrawing    = false;
  drawStart    = currentDragPos = null;
  polyTapStart = null;
  redrawCanvas();
});

annotationCanvas.addEventListener('pointerleave', () => {
  if (polygonLivePos) { polygonLivePos = null; redrawCanvas(); }
});

// ── Bbox finalization ─────────────────────────────────────────
/*
 * DISPLAY → IMAGE coordinate formula (same as Phase 3):
 *   imgX = round(canvasX / displayScale), clamped to [0, imgWidth-1]
 *   imgW = round(dx / displayScale),      clamped to [0, imgWidth-imgX]
 */
function finalizeBbox(start, end) {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (dx < 10 || dy < 10) { redrawCanvas(); return; }

  const imgX = Math.max(0, Math.round(Math.min(start.x, end.x) / displayScale));
  const imgY = Math.max(0, Math.round(Math.min(start.y, end.y) / displayScale));
  const imgW = Math.round(dx / displayScale);
  const imgH = Math.round(dy / displayScale);

  currentAnnotation = {
    id: crypto.randomUUID(), type: 'bbox',
    coords: {
      x: imgX, y: imgY,
      w: Math.min(imgW, currentImgWidth  - imgX),
      h: Math.min(imgH, currentImgHeight - imgY),
    },
    annotation_type: null, gall_stage: null, gall_texture: [],
    location_on_tree: null, lighting: null,
  };
  openClassificationPanel();
  redrawCanvas();
}

// ── Polygon vertex placement ──────────────────────────────────
function handlePolygonTap(pos) {
  // If 3+ vertices are already placed, check for snap-to-close on the first vertex
  if (polygonPoints.length >= 3) {
    const first = polygonPoints[0];
    if (Math.hypot(pos.x - first.x, pos.y - first.y) <= SNAP_RADIUS) {
      finalizePolygon();
      return;
    }
  }
  polygonPoints.push(pos);
  redrawCanvas();
}

/*
 * finalizePolygon — converts all canvas-coord vertices to image pixel
 * coords (same /displayScale transform as bbox), clamps to image bounds,
 * clears transient draw state, and opens the classification panel.
 */
function finalizePolygon() {
  if (polygonPoints.length < 3) return;

  const imagePoints = polygonPoints.map((p) => [
    Math.max(0, Math.min(Math.round(p.x / displayScale), currentImgWidth  - 1)),
    Math.max(0, Math.min(Math.round(p.y / displayScale), currentImgHeight - 1)),
  ]);

  currentAnnotation = {
    id: crypto.randomUUID(), type: 'polygon',
    points: imagePoints,
    annotation_type: null, gall_stage: null, gall_texture: [],
    location_on_tree: null, lighting: null,
  };

  polygonPoints  = [];
  polygonLivePos = null;

  openClassificationPanel();
  redrawCanvas();
}

// ── Classification panel actions ──────────────────────────────
document.getElementById('btn-save-annotation').addEventListener('click', async () => {
  if (!currentAnnotation) return;
  const missing = CLASSIFICATION_SCHEMA
    .filter((g) => {
      if (!g.required) return false;
      const v = currentClassification[g.field];
      return g.multiSelect ? v.length === 0 : v === null;
    })
    .map((g) => g.label);
  if (missing.length > 0) { showToast(`Select: ${missing.join(', ')}`); return; }

  const classified = { ...currentAnnotation };
  CLASSIFICATION_SCHEMA.forEach(({ field }) => { classified[field] = currentClassification[field]; });
  confirmedAnnotations.push(classified);
  currentAnnotation = null;

  // Crash-recovery write — Confirm in S3b is the authoritative final write
  const record = await getImageRecord(currentImageId);
  record.annotations = [...confirmedAnnotations];
  record.status = 'annotated';
  await saveImageRecord(record);

  closeClassificationPanel();
  redrawCanvas();
});

document.getElementById('btn-reject-annotation').addEventListener('click', () => {
  currentAnnotation = null;
  closeClassificationPanel();
  redrawCanvas();
});

// ── Toolbar ───────────────────────────────────────────────────
let currentTool = 'bbox';

function setTool(tool) {
  // Clear any in-progress polygon when switching tools
  if (tool !== 'polygon') {
    polygonPoints  = [];
    polygonLivePos = null;
    polyTapStart   = null;
  }
  currentTool = tool;
  document.getElementById('tool-bbox').classList.toggle('active', tool === 'bbox');
  document.getElementById('tool-poly').classList.toggle('active', tool === 'polygon');
  document.getElementById('tool-bbox').setAttribute('aria-pressed', tool === 'bbox');
  document.getElementById('tool-poly').setAttribute('aria-pressed', tool === 'polygon');
  // Show Close button only in polygon mode
  document.getElementById('tool-close-poly').style.display =
    tool === 'polygon' ? 'inline-flex' : 'none';
  redrawCanvas();
}

document.getElementById('tool-bbox').addEventListener('click', () => setTool('bbox'));
document.getElementById('tool-poly').addEventListener('click', () => setTool('polygon'));

document.getElementById('tool-close-poly').addEventListener('click', () => {
  if (currentAnnotation) {
    showToast('Save or reject the current annotation first.');
    return;
  }
  if (polygonPoints.length >= 3) {
    finalizePolygon();
  } else {
    const need = 3 - polygonPoints.length;
    showToast(`Need ${need} more point${need !== 1 ? 's' : ''} to close.`);
  }
});

document.getElementById('tool-undo').addEventListener('click', () => {
  if (currentAnnotation) {
    // Discard pending unclassified annotation (works for both bbox and polygon)
    currentAnnotation = null;
    closeClassificationPanel();
  } else if (polygonPoints.length > 0) {
    // Remove last placed polygon vertex
    polygonPoints.pop();
  } else if (confirmedAnnotations.length > 0) {
    confirmedAnnotations.pop();
  }
  redrawCanvas();
});

document.getElementById('tool-done').addEventListener('click', async () => {
  if (currentAnnotation) {
    currentAnnotation = null;
    closeClassificationPanel();
  }
  // Discard any partially-drawn polygon
  polygonPoints  = [];
  polygonLivePos = null;
  await openReviewScreen();
});

// ── Open annotation screen ────────────────────────────────────
async function openAnnotateScreen(imageId) {
  currentImageId       = imageId;
  confirmedAnnotations = [];
  currentAnnotation    = null;
  isDrawing            = false;
  drawStart            = currentDragPos = null;
  polygonPoints        = [];
  polygonLivePos       = null;
  polyTapStart         = null;
  reviewMetaState      = {};
  closeClassificationPanel();
  resetClassificationPanel();
  setTool('bbox');

  const record = await getImageRecord(imageId);
  const blob   = await getBlobRecord(record.image_blob_key);
  confirmedAnnotations = [...record.annotations];

  if (currentImageBitmap) { currentImageBitmap.close(); currentImageBitmap = null; }
  currentImageBitmap = await createImageBitmap(blob);

  showScreen('annotate');
  resizeAndDrawCanvas();
}

// ── Review state ──────────────────────────────────────────────
let reviewMetaState = {};

// ── Image metadata schema ─────────────────────────────────────
const IMAGE_METADATA_SCHEMA = [
  {
    field: 'disease', label: 'Disease', required: true, inputType: 'chips',
    options: [
      { value: 'present', label: 'Present' },
      { value: 'absent',  label: 'Absent' },
    ],
  },
  {
    field: 'cultivar', label: 'Cultivar', required: false, inputType: 'text',
    placeholder: 'e.g. Manzanilla',
  },
  {
    field: 'cultivar_susceptibility', label: 'Cultivar Susceptibility', required: false, inputType: 'chips',
    options: [
      { value: 'high',     label: 'High' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'low',      label: 'Low' },
    ],
  },
  {
    field: 'kluepfal_rating', label: 'Kluepfal Rating', required: false, inputType: 'chips',
    options: [0,1,2,3,4,5,6,7,8,9].map((n) => ({ value: n, label: String(n) })),
  },
  {
    field: 'camera_height', label: 'Camera Height', required: true, inputType: 'text',
    placeholder: 'e.g. 1.5 m',
  },
  {
    field: 'camera_distance', label: 'Camera Distance', required: true, inputType: 'text',
    placeholder: 'e.g. 0.5 m',
  },
  {
    field: 'camera_angle', label: 'Camera Angle', required: false, inputType: 'text',
    placeholder: 'e.g. 45°',
  },
  {
    field: 'gall_distribution', label: 'Gall Distribution', required: false, inputType: 'chips',
    options: [
      { value: 'lt_75cm',  label: '<75 cm' },
      { value: '75_175cm', label: '75–175 cm' },
      { value: 'gt_175cm', label: '>175 cm' },
    ],
  },
  {
    field: 'bark_texture', label: 'Bark Texture', required: false, inputType: 'chips',
    options: [
      { value: 'smooth', label: 'Smooth' },
      { value: 'rough',  label: 'Rough' },
      { value: 'other',  label: 'Other' },
    ],
  },
  {
    field: 'image_lighting', label: 'Lighting', required: false, inputType: 'chips',
    options: [
      { value: 'overcast',     label: 'Overcast' },
      { value: 'sunny',        label: 'Sunny' },
      { value: 'intermittent', label: 'Intermittent' },
    ],
  },
  {
    field: 'notes', label: 'Notes', required: false, inputType: 'textarea',
    placeholder: 'Additional notes…',
  },
];

function updateConfirmButtonState() {
  const missingRequired = IMAGE_METADATA_SCHEMA
    .filter((f) => f.required)
    .some((f) => {
      const v = reviewMetaState[f.field];
      return f.inputType === 'text' ? !v?.trim() : v === null;
    });
  const btn = document.getElementById('btn-review-confirm');
  btn.style.opacity = missingRequired ? '0.45' : '1';
  btn.dataset.ready  = missingRequired ? 'false' : 'true';
}

function buildReviewMetaForm(record) {
  const container = document.getElementById('review-meta');
  container.innerHTML = '';

  reviewMetaState = {};
  IMAGE_METADATA_SCHEMA.forEach(({ field }) => {
    reviewMetaState[field] = record[field] ?? null;
  });

  IMAGE_METADATA_SCHEMA.forEach((fieldDef) => {
    const group = document.createElement('div');
    group.className = 'field-group';

    const labelEl = document.createElement('label');
    labelEl.textContent = fieldDef.label + (fieldDef.required ? ' *' : '');
    group.appendChild(labelEl);

    if (fieldDef.inputType === 'chips') {
      const chipRow = document.createElement('div');
      chipRow.className = 'chip-row';
      chipRow.setAttribute('role', 'group');
      chipRow.setAttribute('aria-label', fieldDef.label);
      fieldDef.options.forEach((opt) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = opt.label;
        const isSel = reviewMetaState[fieldDef.field] === opt.value;
        chip.classList.toggle('selected', isSel);
        chip.setAttribute('aria-pressed', String(isSel));
        chip.addEventListener('click', () => {
          chipRow.querySelectorAll('.chip').forEach((c) => {
            c.classList.remove('selected');
            c.setAttribute('aria-pressed', 'false');
          });
          chip.classList.add('selected');
          chip.setAttribute('aria-pressed', 'true');
          reviewMetaState[fieldDef.field] = opt.value;
          updateConfirmButtonState();
        });
        chipRow.appendChild(chip);
      });
      group.appendChild(chipRow);

    } else if (fieldDef.inputType === 'text') {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = fieldDef.placeholder || '';
      input.value = reviewMetaState[fieldDef.field] || '';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('spellcheck', 'false');
      input.addEventListener('input', () => {
        reviewMetaState[fieldDef.field] = input.value;
        updateConfirmButtonState();
      });
      group.appendChild(input);

    } else if (fieldDef.inputType === 'textarea') {
      const ta = document.createElement('textarea');
      ta.className = 'notes-field';
      ta.placeholder = fieldDef.placeholder || '';
      ta.value = reviewMetaState[fieldDef.field] || '';
      ta.addEventListener('input', () => {
        reviewMetaState[fieldDef.field] = ta.value;
      });
      group.appendChild(ta);
    }

    container.appendChild(group);
  });

  updateConfirmButtonState();
}

async function generateAllCropThumbnails(annotations, blob) {
  if (!annotations.length || !blob) return annotations.map(() => null);
  let src;
  try { src = await createImageBitmap(blob); }
  catch { return annotations.map(() => null); }

  const THUMB = 72;
  const results = annotations.map((ann) => {
    try {
      let cx, cy, cw, ch;
      if (ann.type === 'bbox') {
        ({ x: cx, y: cy, w: cw, h: ch } = ann.coords);
      } else if (ann.type === 'polygon' && ann.points?.length >= 3) {
        const xs = ann.points.map(([x]) => x);
        const ys = ann.points.map(([, y]) => y);
        cx = Math.min(...xs); cy = Math.min(...ys);
        cw = Math.max(...xs) - cx; ch = Math.max(...ys) - cy;
      } else { return null; }
      if (cw < 1 || ch < 1) return null;
      const scale = Math.min(THUMB / cw, THUMB / ch);
      const tc = document.createElement('canvas');
      tc.width  = Math.max(1, Math.round(cw * scale));
      tc.height = Math.max(1, Math.round(ch * scale));
      tc.getContext('2d').drawImage(src, cx, cy, cw, ch, 0, 0, tc.width, tc.height);
      return tc.toDataURL('image/jpeg', 0.80);
    } catch { return null; }
  });

  src.close();
  return results;
}

function formatAnnotationLabels(ann) {
  const parts = [];
  if (ann.annotation_type)      parts.push(ann.annotation_type.replace('_', ' '));
  if (ann.gall_stage)           parts.push(ann.gall_stage);
  if (ann.gall_texture?.length) parts.push(ann.gall_texture.join(', '));
  if (ann.location_on_tree)     parts.push(ann.location_on_tree.replace('_', ' '));
  if (ann.lighting)             parts.push(ann.lighting.replace('_', ' '));
  return parts.length ? parts.join(' · ') : 'Unclassified';
}

async function renderReviewInstanceList() {
  const list = document.getElementById('review-instance-list');
  list.innerHTML = '';

  if (!confirmedAnnotations.length) {
    const msg = document.createElement('p');
    msg.className = 'review-empty';
    msg.textContent = 'No annotations for this image.';
    list.appendChild(msg);
    return;
  }

  const record = await getImageRecord(currentImageId);
  const blob   = await getBlobRecord(record.image_blob_key);
  const thumbs = await generateAllCropThumbnails(confirmedAnnotations, blob);

  confirmedAnnotations.forEach((ann, i) => {
    const src    = thumbs[i];
    const labels = formatAnnotationLabels(ann);
    const card   = document.createElement('div');
    card.className = 'instance-card';
    card.setAttribute('role', 'listitem');

    const thumbEl = src
      ? `<img class="instance-thumb" src="${src}" alt="Crop of annotation ${i + 1}" />`
      : `<div class="instance-thumb instance-thumb-empty" aria-hidden="true"></div>`;

    card.innerHTML = `
      ${thumbEl}
      <div class="instance-info">
        <div class="instance-index">#${i + 1} &middot; ${ann.type.toUpperCase()}</div>
        <div class="instance-labels">${labels}</div>
      </div>
      <div class="instance-actions">
        <button type="button" class="btn-delete-ann" data-idx="${i}"
                aria-label="Delete annotation ${i + 1}">✕</button>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.btn-delete-ann').forEach((btn) => {
    btn.addEventListener('click', async () => {
      confirmedAnnotations.splice(parseInt(btn.dataset.idx, 10), 1);
      await renderReviewInstanceList();
      redrawCanvas();
    });
  });
}

async function openReviewScreen() {
  const record = await getImageRecord(currentImageId);
  buildReviewMetaForm(record);
  showScreen('review');
  await renderReviewInstanceList();
}

function handleReviewBack() {
  showScreen('annotate');
  resizeAndDrawCanvas();
}

document.getElementById('btn-review-back').addEventListener('click', handleReviewBack);
document.getElementById('btn-review-back-2').addEventListener('click', handleReviewBack);

document.getElementById('btn-review-confirm').addEventListener('click', async () => {
  if (!currentImageId) return;
  if (document.getElementById('btn-review-confirm').dataset.ready === 'false') {
    const missing = IMAGE_METADATA_SCHEMA
      .filter((f) => f.required)
      .filter((f) => {
        const v = reviewMetaState[f.field];
        return f.inputType === 'text' ? !v?.trim() : v === null;
      })
      .map((f) => f.label);
    showToast(`Required: ${missing.join(', ')}`);
    return;
  }

  const record       = await getImageRecord(currentImageId);
  record.annotations = [...confirmedAnnotations];
  record.status      = confirmedAnnotations.length > 0 ? 'annotated' : 'pending';
  IMAGE_METADATA_SCHEMA.forEach(({ field, inputType }) => {
    const v = reviewMetaState[field];
    record[field] = (inputType === 'text' || inputType === 'textarea')
      ? (v?.trim() || null)
      : v;
  });
  await saveImageRecord(record);

  confirmedAnnotations = [];
  currentAnnotation    = null;
  reviewMetaState      = {};
  if (currentImageBitmap) { currentImageBitmap.close(); currentImageBitmap = null; }

  showScreen('home');
  await renderHomeGrid();
  showToast('Image confirmed.');
});

// ── Export ────────────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', async () => {
  const { sessionId, annotator } = getSession();
  if (!sessionId) { showToast('No active session to export.'); return; }
  showToast('Building export…', 8000);
  try {
    const zipBlob = await buildExportZip(sessionId, annotator);
    await deliverExport(zipBlob, `${sessionId}_annotations.zip`);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Export failed:', err);
      showToast('Export failed — see console.');
    }
  }
});

async function buildExportZip(sessionId, annotator) {
  const zip      = new JSZip();
  const records  = await getAllImagesForSession(sessionId);
  const { location } = getSession();
  const annotatedCount = records.filter((r) => r.status === 'annotated').length;

  const sessionMeta = {
    session: sessionId, annotator,
    exported_at: new Date().toISOString(),
    image_count: records.length,
    annotated_count: annotatedCount,
  };
  if (location) sessionMeta.location = location;
  zip.file('session_metadata.json', JSON.stringify(sessionMeta, null, 2));

  for (const record of records) {
    const blob = await getBlobRecord(record.image_blob_key);
    if (blob) zip.file(`IMG_${record.id}.jpg`, blob, { compression: 'STORE' });
    zip.file(`IMG_${record.id}_annotations.json`,
      JSON.stringify(record, null, 2),
      { compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  return zip.generateAsync({ type: 'blob' });
}

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

async function deliverExport(zipBlob, fileName) {
  if (isIOSDevice() && typeof navigator.share === 'function') {
    const file = new File([zipBlob], fileName, { type: 'application/zip' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'OliveAnnotate Export' });
      return;
    }
  }
  const url = URL.createObjectURL(zipBlob);
  const a   = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  showToast('Export downloaded.');
}

// ── S1 / S2 button wiring ─────────────────────────────────────
document.getElementById('btn-new-image').addEventListener('click', async () => {
  showScreen('camera');
  await startCamera();
});

document.getElementById('btn-capture').addEventListener('click', captureFrame);

document.getElementById('btn-camera-back').addEventListener('click', () => {
  stopCamera();
  showScreen('home');
});

document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) { stopCamera(); handleLibraryFile(file); }
});

// ── Init ──────────────────────────────────────────────────────
async function init() {
  await openDB();
  buildClassificationPanel();
  const { annotator, sessionId } = getSession();
  showScreen('home');
  if (!annotator || !sessionId) {
    openSetupModal();
  } else {
    await applySession();
  }
}

init();
