import {
  PoseLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import { AnatomyRenderer } from './renderer.js';
import { LAYER_META, confidence } from './anatomy.js';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';

// BASE_URL = "/" en local y "/<repo>/" cuando se publica en GitHub Pages.
const assetUrl = (file) => `${import.meta.env.BASE_URL}assets/${file}`;

const ASSET_MANIFEST = {
  muscles: assetUrl('muscles.png'),
  bones: assetUrl('bones.png'),
  ligaments: assetUrl('ligaments.png'),
  tendons: assetUrl('tendons.png'),
  all: assetUrl('hero.png'),
};

/* ─── DOM ──────────────────────────────────────────────────────── */
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const viewport = document.getElementById('viewport');
const idlePanel = document.getElementById('idle-panel');
const loadingPanel = document.getElementById('loading-panel');
const loadingText = document.getElementById('loading-text');
const btnStart = document.getElementById('btn-start');
const camStatus = document.getElementById('cam-status');
const poseStatus = document.getElementById('pose-status');
const fpsLabel = document.getElementById('fps-label');
const bodyReadout = document.getElementById('body-readout');
const confValue = document.getElementById('conf-value');
const layerValue = document.getElementById('layer-value');
const segValue = document.getElementById('seg-value');
const infoChip = document.querySelector('.info-chip');
const infoText = document.getElementById('info-text');
const opacitySlider = document.getElementById('opacity');
const glowSlider = document.getElementById('glow');
const showSkeleton = document.getElementById('show-skeleton');
const showLabels = document.getElementById('show-labels');
const btnFlip = document.getElementById('btn-flip');
const btnSnap = document.getElementById('btn-snap');

const renderer = new AnatomyRenderer(canvas);

let poseLandmarker = null;
let running = false;
let facingMode = 'user';
let stream = null;
let raf = 0;
let lastVideoTime = -1;
let fpsFrames = 0;
let fpsLast = performance.now();
let startTime = performance.now();

/* ─── UI wiring ────────────────────────────────────────────────── */
btnStart.addEventListener('click', () => start());
btnFlip.addEventListener('click', () => flipCamera());
btnSnap.addEventListener('click', () => snapshot());

document.querySelectorAll('.layer-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.layer-btn').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const layer = btn.dataset.layer;
    renderer.setLayer(layer);
    const meta = LAYER_META[layer];
    layerValue.textContent = meta.name;
    infoChip.textContent = meta.name;
    infoChip.style.setProperty('--c', meta.color);
    infoText.textContent = meta.description;
  });
});

opacitySlider.addEventListener('input', () => {
  renderer.opacity = Number(opacitySlider.value) / 100;
});
glowSlider.addEventListener('input', () => {
  renderer.glow = Number(glowSlider.value) / 100;
});
showSkeleton.addEventListener('change', () => {
  renderer.showSkeleton = showSkeleton.checked;
});
showLabels.addEventListener('change', () => {
  renderer.showLabels = showLabels.checked;
});

window.addEventListener('resize', () => fitCanvas());

/* ─── Bootstrap assets ─────────────────────────────────────────── */
renderer.loadTextures(ASSET_MANIFEST).catch(() => {});

/* ─── Core flow ────────────────────────────────────────────────── */
async function start() {
  idlePanel.classList.add('hidden');
  loadingPanel.classList.remove('hidden');
  loadingText.textContent = 'Solicitando cámara…';

  try {
    await initCamera();
    camStatus.classList.add('on');

    loadingText.textContent = 'Cargando modelo de pose (MediaPipe)…';
    await initPose();

    loadingText.textContent = 'Calibrando visión corporal…';
    await wait(280);

    loadingPanel.classList.add('hidden');
    bodyReadout.hidden = false;
    running = true;
    startTime = performance.now();
    loop();
  } catch (err) {
    console.error(err);
    loadingPanel.classList.add('hidden');
    idlePanel.classList.remove('hidden');
    alert(friendlyError(err));
  }
}

async function initCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });
  video.srcObject = stream;
  await video.play();
  fitCanvas();
}

async function initPose() {
  if (poseLandmarker) return;
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const base = {
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
  try {
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      ...base,
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    });
  } catch {
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      ...base,
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
    });
  }
}

function fitCanvas() {
  const rect = viewport.getBoundingClientRect();
  renderer.resize(rect.width, rect.height);
}

function loop() {
  if (!running) return;
  raf = requestAnimationFrame(loop);

  if (video.readyState < 2) return;

  const now = performance.now();
  if (video.currentTime === lastVideoTime) {
    // still draw last frame atmosphere? skip detection
    return;
  }
  lastVideoTime = video.currentTime;

  let result;
  try {
    result = poseLandmarker.detectForVideo(video, now);
  } catch (e) {
    console.warn(e);
    return;
  }

  const t = (now - startTime) / 1000;
  const lm = result?.landmarks?.[0];

  fitCanvas();
  renderer.setVideoSource(video);

  if (lm) {
    poseStatus.classList.add('on', 'tracking');
    const conf = confidence(lm);
    confValue.textContent = `${Math.round(conf * 100)}%`;
    const { segments } = renderer.draw(lm, t);
    segValue.textContent = String(segments);
  } else {
    poseStatus.classList.remove('tracking');
    poseStatus.classList.add('on');
    renderer.clear();
    confValue.textContent = '—';
    segValue.textContent = '0';
  }

  // FPS
  fpsFrames += 1;
  if (now - fpsLast >= 1000) {
    fpsLabel.textContent = `${fpsFrames} FPS`;
    fpsFrames = 0;
    fpsLast = now;
  }
}

async function flipCamera() {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  if (!stream) return;
  try {
    await initCamera();
  } catch (e) {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    alert('No se pudo cambiar de cámara en este dispositivo.');
  }
}

function snapshot() {
  if (!stream) return;
  const rect = viewport.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const out = document.createElement('canvas');
  out.width = Math.floor(rect.width * dpr);
  out.height = Math.floor(rect.height * dpr);
  const ctx = out.getContext('2d');

  // video is mirrored via CSS; mirror draw to match what user sees
  // Match object-fit: cover
  const vw = video.videoWidth || out.width;
  const vh = video.videoHeight || out.height;
  const scale = Math.max(out.width / vw, out.height / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const ox = (out.width - dw) / 2;
  const oy = (out.height - dh) / 2;

  ctx.save();
  ctx.translate(out.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, ox, oy, dw, dh);
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  ctx.restore();

  viewport.classList.add('flash');
  setTimeout(() => viewport.classList.remove('flash'), 400);

  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anatomia-xr-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function friendlyError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Permiso de cámara denegado. Actívalo en el navegador e inténtalo de nuevo.';
  }
  if (name === 'NotFoundError') {
    return 'No se encontró ninguna cámara en este dispositivo.';
  }
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return 'La cámara requiere HTTPS (o localhost). Abre la app en un origen seguro.';
  }
  return `No se pudo iniciar: ${err?.message || err}`;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Stop camera when tab hidden for a long time? keep running — user may switch back.
window.addEventListener('beforeunload', () => {
  running = false;
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
});
