/* ─────────────────────────────────────────────────────────────────
   OliveAnnotate — app.js
   Phase 3: Bounding Box Annotation
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
  };
}

function saveSession(annotator, sessionId) {
  localStorage.setItem('oa_annotator', annotator);
  localStorage.setItem('oa_session',   sessionId);
}

// ── IndexedDB ─────────────────────────────────────────────────
/*
 * Two stores: 'images' (annotation metadata, ~1 KB each) and
 * 'blobs' (JPEG binary, several MB each). Keeping them separate
 * means session-wide metadata queries scan only tiny JSON objects.
 * UUIDs (crypto.randomUUID) are generated on-device, collision-
 * resistant, and double as stable export filenames.
 */
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

// ── Setup modal ───────────────────────────────────────────────
const setupModal      = document.getElementById('setup-modal');
const inputAnnotator  = document.getElementById('input-annotator');
const inputSession    = document.getElementById('input-session');
const btnSetupConfirm = document.getElementById('btn-setup-confirm');

function openSetupModal() {
  const { annotator, sessionId } = getSession();
  const isFirstLaunch = !annotator && !sessionId;
  inputAnnotator.value = annotator;
  inputSession.value   = sessionId;
  btnSetupConfirm.textContent = isFirstLaunch ? 'Start Session' : 'Update Session';
  setupModal.classList.remove('hidden');
  inputAnnotator.focus();
}

function closeSetupModal() { setupModal.classList.add('hidden'); }

btnSetupConfirm.addEventListener('click', async () => {
  const annotator = inputAnnotator.value.trim();
  const sessionId = inputSession.value.trim();
  if (!annotator || !sessionId) { showToast('Please fill in both fields.'); return; }
  const isFirstLaunch = btnSetupConfirm.textContent === 'Start Session';
  saveSession(annotator, sessionId);
  closeSetupModal();
  await applySession();
  showToast(isFirstLaunch
    ? `Session "${sessionId}" started.`
    : `Session updated to "${sessionId}".`);
});

[inputAnnotator, inputSession].forEach((inp) => {
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnSetupConfirm.click(); });
});

document.getElementById('btn-settings').addEventListener('click', openSetupModal);

// ── Home screen ───────────────────────────────────────────────
const imageGrid    = document.getElementById('image-grid');
const emptyState   = document.getElementById('empty-state');
const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');

const thumbURLs = new Map(); // imageId → ObjectURL, revoked on each render

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
      </div>
    `;
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

// ── Camera ────────────────────────────────────────────────────
const videoEl       = document.getElementById('camera-viewfinder');
const captureCanvas = document.getElementById('capture-canvas');
let cameraStream    = null;

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } },
      audio: false,
    });
  } catch {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      showToast('Camera access denied. Use "Library" to choose an image.');
      return;
    }
  }
  videoEl.srcObject = cameraStream;
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
    videoEl.srcObject = null;
  }
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
    image_rating:   null,
    notes:          '',
    annotations:    [],
    status:         'pending',
  };
  await saveImageRecord(record);
  stopCamera();
  currentImageId = id;
  await openAnnotateScreen(id);
}

// ── Annotation state ──────────────────────────────────────────
/*
 * COORDINATE SPACES
 *
 *   displayScale = Math.min(availW / imgW, availH / imgH)
 *
 *   The image is drawn with ctx.drawImage(bitmap, 0, 0, canvasW, canvasH)
 *   where canvasW = round(imgW * displayScale), canvasH = round(imgH * displayScale).
 *   Every image pixel (xi, yi) therefore maps to canvas position (xi·s, yi·s).
 *
 *   DISPLAY → IMAGE  (used when storing a drawn annotation):
 *     x_img = round(x_canvas / displayScale)
 *     y_img = round(y_canvas / displayScale)
 *
 *   IMAGE → DISPLAY  (used when rendering stored annotations):
 *     x_canvas = x_img * displayScale
 *     y_canvas = y_img * displayScale
 *
 *   Rounding is required because image pixels are discrete integers, while
 *   canvas coordinates are floating-point CSS pixels. Math.round() selects
 *   the nearest integer pixel, keeping stored coords losslessly round-trippable.
 *
 * STATE SEPARATION
 *
 *   confirmedAnnotations — fully saved annotations for the current image.
 *     Stored in IMAGE pixel space. Written to IndexedDB on Done / Confirm.
 *
 *   currentAnnotation — a single annotation that has been drawn but not yet
 *     classified. Exists while the classification panel is open. Contains
 *     image-space coords with null classification fields. Discarded on Reject
 *     or Undo, moved to confirmedAnnotations on Save.
 *
 *   isDrawing / drawStart / currentDragPos — transient drag state used only
 *     during an active pointer gesture. Discarded on pointerup/cancel.
 */
let confirmedAnnotations = [];
let currentAnnotation    = null;
let isDrawing            = false;
let drawStart            = null;
let currentDragPos       = null;
let displayScale         = 1;
let currentImgWidth      = 0;
let currentImgHeight     = 0;

// ── Canvas rendering ──────────────────────────────────────────
const annotationCanvas     = document.getElementById('annotation-canvas');
const classificationPanel  = document.getElementById('classification-panel');
let currentImageBitmap     = null;

function openClassificationPanel()  { classificationPanel.classList.add('open'); }
function closeClassificationPanel() { classificationPanel.classList.remove('open'); }

/*
 * drawBbox — renders a bounding box in CANVAS coordinate space.
 * The numbered badge sits inside the top-left corner of the box
 * so it is never clipped when the box touches the canvas edge.
 */
function drawBbox(ctx, x, y, w, h, color, label) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2.5;
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);  // +0.5 aligns to physical pixel grid

  if (label !== undefined) {
    const pad = 4;
    const fs  = 13;
    ctx.font  = `bold ${fs}px system-ui, sans-serif`;
    const tw  = ctx.measureText(String(label)).width;
    const bw  = Math.ceil(tw) + pad * 2;
    const bh  = fs + pad * 2;
    ctx.fillStyle = color;
    ctx.fillRect(rx, ry, bw, bh);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(label), rx + pad, ry + fs + pad - 1);
  }
  ctx.restore();
}

function redrawCanvas() {
  if (!currentImageBitmap) return;
  const ctx = annotationCanvas.getContext('2d');
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  ctx.drawImage(currentImageBitmap, 0, 0, annotationCanvas.width, annotationCanvas.height);

  // Confirmed annotations — green with numbered badges
  confirmedAnnotations.forEach((ann, i) => {
    if (ann.type === 'bbox') {
      drawBbox(
        ctx,
        ann.coords.x * displayScale,
        ann.coords.y * displayScale,
        ann.coords.w * displayScale,
        ann.coords.h * displayScale,
        '#4A7C59',
        i + 1,
      );
    }
  });

  // Active drag — orange preview, no badge
  if (isDrawing && drawStart && currentDragPos) {
    drawBbox(
      ctx,
      Math.min(drawStart.x, currentDragPos.x),
      Math.min(drawStart.y, currentDragPos.y),
      Math.abs(currentDragPos.x - drawStart.x),
      Math.abs(currentDragPos.y - drawStart.y),
      '#D4780A',
    );
  }

  // Pending classification — orange, no badge yet
  if (currentAnnotation && currentAnnotation.type === 'bbox') {
    drawBbox(
      ctx,
      currentAnnotation.coords.x * displayScale,
      currentAnnotation.coords.y * displayScale,
      currentAnnotation.coords.w * displayScale,
      currentAnnotation.coords.h * displayScale,
      '#D4780A',
    );
  }
}

function resizeAndDrawCanvas() {
  if (!currentImageBitmap) return;
  const container = document.querySelector('.annotate-body');
  const availW    = container.clientWidth;
  const availH    = container.clientHeight;

  displayScale     = Math.min(availW / currentImageBitmap.width, availH / currentImageBitmap.height);
  currentImgWidth  = currentImageBitmap.width;
  currentImgHeight = currentImageBitmap.height;

  annotationCanvas.width  = Math.round(currentImageBitmap.width  * displayScale);
  annotationCanvas.height = Math.round(currentImageBitmap.height * displayScale);

  redrawCanvas();
}

window.addEventListener('resize', resizeAndDrawCanvas);

// ── Pointer Events (bbox drawing) ─────────────────────────────
/*
 * We use setPointerCapture so pointermove/pointerup fire even when
 * the pointer exits the canvas during a fast drag.
 * touch-action: none on the canvas (CSS) prevents browser
 * scroll/zoom from interfering.
 */
function getCanvasPos(e) {
  const rect = annotationCanvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

annotationCanvas.addEventListener('pointerdown', (e) => {
  if (currentAnnotation) return;          // must Save or Reject first
  if (currentTool !== 'bbox') return;
  if (e.button !== 0 && e.pointerType === 'mouse') return;  // left button only
  e.preventDefault();
  annotationCanvas.setPointerCapture(e.pointerId);
  drawStart      = getCanvasPos(e);
  currentDragPos = drawStart;
  isDrawing      = true;
});

annotationCanvas.addEventListener('pointermove', (e) => {
  if (!isDrawing) return;
  e.preventDefault();
  currentDragPos = getCanvasPos(e);
  redrawCanvas();
});

annotationCanvas.addEventListener('pointerup', (e) => {
  if (!isDrawing) return;
  e.preventDefault();
  isDrawing = false;
  finalizeBbox(drawStart, getCanvasPos(e));
  drawStart = null;
  currentDragPos = null;
});

annotationCanvas.addEventListener('pointercancel', () => {
  isDrawing      = false;
  drawStart      = null;
  currentDragPos = null;
  redrawCanvas();
});

/*
 * finalizeBbox — converts drag endpoints from canvas coords to image
 * pixel coords, clamps to image bounds, and sets currentAnnotation.
 *
 * Formula (display → image):
 *   imgX = max(0, round(min(x0, x1) / scale))
 *   imgY = max(0, round(min(y0, y1) / scale))
 *   imgW = round(|x1 - x0| / scale)  clamped to (imgWidth  - imgX)
 *   imgH = round(|y1 - y0| / scale)  clamped to (imgHeight - imgY)
 *
 * This is correct because ctx.drawImage maps image pixel (xi,yi) to
 * canvas position (xi·scale, yi·scale), so the inverse is /scale.
 */
function finalizeBbox(start, end) {
  const MIN_PX = 10;
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  if (dx < MIN_PX || dy < MIN_PX) {
    redrawCanvas();  // discard accidental tap
    return;
  }

  const imgX = Math.max(0, Math.round(Math.min(start.x, end.x) / displayScale));
  const imgY = Math.max(0, Math.round(Math.min(start.y, end.y) / displayScale));
  const imgW = Math.round(dx / displayScale);
  const imgH = Math.round(dy / displayScale);

  currentAnnotation = {
    id:         crypto.randomUUID(),
    type:       'bbox',
    coords: {
      x: imgX,
      y: imgY,
      w: Math.min(imgW, currentImgWidth  - imgX),
      h: Math.min(imgH, currentImgHeight - imgY),
    },
    severity:   null,
    gall_age:   null,
    location:   null,
    confidence: null,
  };

  openClassificationPanel();
  redrawCanvas();
}

// ── Classification panel actions ──────────────────────────────
document.getElementById('btn-save-annotation').addEventListener('click', () => {
  if (!currentAnnotation) return;
  confirmedAnnotations.push({ ...currentAnnotation });
  currentAnnotation = null;
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
  currentTool = tool;
  document.getElementById('tool-bbox').classList.toggle('active', tool === 'bbox');
  document.getElementById('tool-poly').classList.toggle('active', tool === 'polygon');
  document.getElementById('tool-bbox').setAttribute('aria-pressed', tool === 'bbox');
  document.getElementById('tool-poly').setAttribute('aria-pressed', tool === 'polygon');
}

document.getElementById('tool-bbox').addEventListener('click', () => setTool('bbox'));
document.getElementById('tool-poly').addEventListener('click', () => {
  showToast('Polygon mode coming in Phase 7.');
});

document.getElementById('tool-undo').addEventListener('click', () => {
  if (currentAnnotation) {
    // Discard pending (unclassified) annotation
    currentAnnotation = null;
    closeClassificationPanel();
  } else if (confirmedAnnotations.length > 0) {
    confirmedAnnotations.pop();
  }
  redrawCanvas();
});

/*
 * Done — saves confirmed annotations to IndexedDB and returns to S1.
 * Any pending (unclassified) annotation is silently discarded.
 * Phase 5 will intercept this to navigate to the Review screen first.
 */
document.getElementById('tool-done').addEventListener('click', async () => {
  if (currentAnnotation) {
    currentAnnotation = null;
    closeClassificationPanel();
  }

  if (currentImageId) {
    const record = await getImageRecord(currentImageId);
    record.annotations = [...confirmedAnnotations];
    if (confirmedAnnotations.length > 0) record.status = 'annotated';
    await saveImageRecord(record);
  }

  confirmedAnnotations = [];
  currentAnnotation    = null;
  if (currentImageBitmap) { currentImageBitmap.close(); currentImageBitmap = null; }

  showScreen('home');
  await renderHomeGrid();
});

// ── Open annotation screen ────────────────────────────────────
async function openAnnotateScreen(imageId) {
  currentImageId = imageId;

  // Reset transient draw state
  confirmedAnnotations = [];
  currentAnnotation    = null;
  isDrawing            = false;
  drawStart            = null;
  currentDragPos       = null;
  closeClassificationPanel();
  setTool('bbox');

  const record = await getImageRecord(imageId);
  const blob   = await getBlobRecord(record.image_blob_key);

  // Restore any previously saved annotations for this image
  confirmedAnnotations = [...record.annotations];

  if (currentImageBitmap) { currentImageBitmap.close(); currentImageBitmap = null; }
  currentImageBitmap = await createImageBitmap(blob);

  showScreen('annotate');
  resizeAndDrawCanvas();
}

// ── S1 / S2 button wiring ─────────────────────────────────────
document.getElementById('btn-new-image').addEventListener('click', async () => {
  showScreen('camera');
  await startCamera();
});

document.getElementById('btn-export').addEventListener('click', () => {
  showToast('Export coming in Phase 6.');
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
  const { annotator, sessionId } = getSession();
  showScreen('home');
  if (!annotator || !sessionId) {
    openSetupModal();
  } else {
    await applySession();
  }
}

init();
