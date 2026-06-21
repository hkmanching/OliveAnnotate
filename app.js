/* ─────────────────────────────────────────────────────────────────
   OliveAnnotate — app.js  (Phase 1 stub)
   Registers the Service Worker and wires up the first-launch setup
   modal. No annotation logic yet.
───────────────────────────────────────────────────────────────── */

'use strict';

// ── Service Worker registration ───────────────────────────────
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

// ── Toast helper ──────────────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg, durationMs = 2500) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), durationMs);
}

// ── Session persistence (localStorage) ───────────────────────
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

// ── First-launch setup modal ──────────────────────────────────
const setupModal    = document.getElementById('setup-modal');
const inputAnnotator = document.getElementById('input-annotator');
const inputSession   = document.getElementById('input-session');
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

function applySession() {
  const { annotator, sessionId } = getSession();
  document.getElementById('session-label').textContent =
    sessionId ? `Session: ${sessionId}` : '';
  // Placeholder: full S1 render will happen in Phase 2+
  updateHomeUI();
}

btnSetupConfirm.addEventListener('click', () => {
  const annotator = inputAnnotator.value.trim();
  const sessionId = inputSession.value.trim();
  if (!annotator || !sessionId) {
    showToast('Please fill in both fields.');
    return;
  }
  const isFirstLaunch = btnSetupConfirm.textContent === 'Start Session';
  saveSession(annotator, sessionId);
  closeSetupModal();
  applySession();
  showToast(isFirstLaunch ? `Session "${sessionId}" started.` : `Session updated to "${sessionId}".`);
});

// Allow Enter key to submit the form
[inputAnnotator, inputSession].forEach((inp) => {
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSetupConfirm.click();
  });
});

// Settings button reopens the modal
document.getElementById('btn-settings').addEventListener('click', openSetupModal);

// ── Home screen placeholder ───────────────────────────────────
function updateHomeUI() {
  const emptyState = document.getElementById('empty-state');
  const imageGrid  = document.getElementById('image-grid');
  // Phase 1: no images yet, always show empty state
  imageGrid.innerHTML = '';
  emptyState.style.display = 'flex';
  document.getElementById('progress-text').textContent = '0 of 0 annotated';
  document.getElementById('progress-fill').style.width = '0%';
}

// Placeholder nav buttons — will gain real behaviour in Phase 2+
document.getElementById('btn-new-image').addEventListener('click', () => {
  showToast('Camera coming in Phase 2.');
});
document.getElementById('btn-export').addEventListener('click', () => {
  showToast('Export coming in Phase 6.');
});

// ── Initialise on load ────────────────────────────────────────
function init() {
  const { annotator, sessionId } = getSession();
  showScreen('home');
  if (!annotator || !sessionId) {
    openSetupModal();
  } else {
    applySession();
  }
}

init();
