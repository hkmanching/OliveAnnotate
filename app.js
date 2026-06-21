/* ─────────────────────────────────────────────────────────────────
   OliveAnnotate — app.js
   Phase 2: Camera Capture + IndexedDB
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
 * WHY TWO STORES?
 *   'images' holds annotation metadata (small JSON, ~1 KB each).
 *   'blobs'  holds raw JPEG binary data (several MB each).
 *
 *   Keeping them separate means getAllImagesForSession() scans only
 *   tiny JSON objects — not megabyte blobs — when building the home
 *   grid. It also lets us delete or inspect blob data independently
 *   of the annotation records without touching the metadata store.
 *
 * WHY UUIDs?
 *   Generated entirely on-device via crypto.randomUUID(), so no
 *   server is required for key assignment. They are globally unique,
 *   collision-resistant across multiple devices, and serve double duty
 *   as stable export filenames (IMG_<uuid>.jpg). Auto-increment
 *   integers would create ordering dependencies that complicate
 *   multi-device merges and produce ambiguous filenames.
 *
 * WHY image_blob_key === id?
 *   There is a strict 1-to-1 relationship between an image record and
 *   its blob. Reusing the same UUID avoids a second key-generation step
 *   and keeps lookups trivial. The spec lists them as separate fields to
 *   preserve the option of swapping or re-encoding blobs in future
 *   without changing the record id.
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

async function getImageRecord(id) {
  return db.get('images', id);
}

async function saveImageRecord(record) {
  return db.put('images', record);
}

async function saveBlobRecord(id, blob) {
  return db.put('blobs', { id, blob });
}

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

function closeSetupModal() {
  setupModal.classList.add('hidden');
}

btnSetupConfirm.addEventListener('click', async () => {
  const annotator = inputAnnotator.value.trim();
  const sessionId = inputSession.value.trim();
  if (!annotator || !sessionId) {
    showToast('Please fill in both fields.');
    return;
  }
  const isFirstLaunch = btnSetupConfirm.textContent === 'Start Session';
  saveSession(annotator, sessionId);
  closeSetupModal();
  await applySession();
  showToast(isFirstLaunch ? `Session "${sessionId}" started.` : `Session updated to "${sessionId}".`);
});

[inputAnnotator, inputSession].forEach((inp) => {
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSetupConfirm.click();
  });
});

document.getElementById('btn-settings').addEventListener('click', openSetupModal);

// ── Home screen ───────────────────────────────────────────────
const imageGrid    = document.getElementById('image-grid');
const emptyState   = document.getElementById('empty-state');
const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');

// Object URLs are created per render and revoked on the next render
// to prevent memory leaks from accumulating blob references.
const thumbURLs = new Map();

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
  // Request rear camera at the highest available resolution.
  // 'ideal' rather than 'exact' so the browser can fall back gracefully
  // if the device doesn't support the requested resolution.
  const constraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width:  { ideal: 4096 },
      height: { ideal: 3072 },
    },
    audio: false,
  };

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    // Desktop or single-camera devices: retry without facingMode
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
  if (!videoEl.videoWidth) {
    showToast('Camera not ready — try again.');
    return;
  }
  captureCanvas.width  = videoEl.videoWidth;
  captureCanvas.height = videoEl.videoHeight;
  captureCanvas.getContext('2d').drawImage(videoEl, 0, 0);
  showToast('Saving…', 1000);
  captureCanvas.toBlob(
    (blob) => {
      if (!blob) { showToast('Capture failed — try again.'); return; }
      storeNewImage(blob, captureCanvas.width, captureCanvas.height);
    },
    'image/jpeg',
    0.92,
  );
}

async function handleLibraryFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please select an image file.');
    return;
  }
  showToast('Loading…', 1000);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    showToast('Could not read this image format.');
    return;
  }
  captureCanvas.width  = bitmap.width;
  captureCanvas.height = bitmap.height;
  captureCanvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  captureCanvas.toBlob(
    (blob) => {
      if (!blob) { showToast('Image conversion failed.'); return; }
      storeNewImage(blob, captureCanvas.width, captureCanvas.height);
    },
    'image/jpeg',
    0.92,
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

// ── Annotation canvas (Phase 2: image display only) ───────────
const annotationCanvas = document.getElementById('annotation-canvas');
let currentImageBitmap = null;

async function openAnnotateScreen(imageId) {
  currentImageId = imageId;
  showScreen('annotate');

  const record = await getImageRecord(imageId);
  const blob   = await getBlobRecord(record.image_blob_key);

  if (currentImageBitmap) {
    currentImageBitmap.close();
    currentImageBitmap = null;
  }
  currentImageBitmap = await createImageBitmap(blob);
  resizeAndDrawCanvas();
}

function resizeAndDrawCanvas() {
  if (!currentImageBitmap) return;

  const container = document.querySelector('.annotate-body');
  const availW    = container.clientWidth;
  const availH    = container.clientHeight;
  const scale     = Math.min(
    availW / currentImageBitmap.width,
    availH / currentImageBitmap.height,
  );

  annotationCanvas.width  = Math.round(currentImageBitmap.width  * scale);
  annotationCanvas.height = Math.round(currentImageBitmap.height * scale);
  annotationCanvas.getContext('2d')
    .drawImage(currentImageBitmap, 0, 0, annotationCanvas.width, annotationCanvas.height);
}

window.addEventListener('resize', resizeAndDrawCanvas);

// ── Button wiring ─────────────────────────────────────────────

// S1
document.getElementById('btn-new-image').addEventListener('click', async () => {
  showScreen('camera');
  await startCamera();
});

document.getElementById('btn-export').addEventListener('click', () => {
  showToast('Export coming in Phase 6.');
});

// S2
document.getElementById('btn-capture').addEventListener('click', captureFrame);

document.getElementById('btn-camera-back').addEventListener('click', () => {
  stopCamera();
  showScreen('home');
});

document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';   // reset so same file can be re-selected
  if (file) {
    stopCamera();
    handleLibraryFile(file);
  }
});

// S3 toolbar stubs — tools added in Phase 3
document.getElementById('tool-done').addEventListener('click', async () => {
  showScreen('home');
  await renderHomeGrid();
});

document.getElementById('tool-undo').addEventListener('click', () => {
  showToast('Undo coming in Phase 3.');
});

document.getElementById('tool-bbox').addEventListener('click', () => {
  showToast('Bounding box drawing coming in Phase 3.');
});

document.getElementById('tool-poly').addEventListener('click', () => {
  showToast('Polygon drawing coming in Phase 3.');
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
