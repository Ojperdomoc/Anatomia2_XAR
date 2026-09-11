import {
  STRUCTURES,
  SKELETON,
  LAYER_META,
  LM,
  visible,
} from './anatomy.js';

const JOINT_RADIUS = {
  [LM.L_SHOULDER]: 1.1,
  [LM.R_SHOULDER]: 1.1,
  [LM.L_ELBOW]: 0.85,
  [LM.R_ELBOW]: 0.85,
  [LM.L_WRIST]: 0.65,
  [LM.R_WRIST]: 0.65,
  [LM.L_HIP]: 1.2,
  [LM.R_HIP]: 1.2,
  [LM.L_KNEE]: 0.95,
  [LM.R_KNEE]: 0.95,
  [LM.L_ANKLE]: 0.75,
  [LM.R_ANKLE]: 0.75,
  [LM.NOSE]: 0.7,
};

/**
 * Procedural anatomy overlay renderer.
 * Textures from Higgsfield (public/assets/*.png) are optionally blended as detail maps.
 */
export class AnatomyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.layer = 'muscles';
    this.opacity = 0.85;
    this.glow = 0.7;
    this.showSkeleton = true;
    this.showLabels = true;
    this.textures = {};
    this._time = 0;
    this._labels = [];
  }

  async loadTextures(manifest) {
    const entries = Object.entries(manifest || {});
    await Promise.all(
      entries.map(async ([key, src]) => {
        try {
          const img = await loadImage(src);
          this.textures[key] = img;
        } catch {
          // optional — procedural fallback is always available
        }
      }),
    );
  }

  setLayer(layer) {
    this.layer = layer;
  }

  resize(cssW, cssH, dpr = window.devicePixelRatio || 1) {
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.dpr = dpr;
    this.cssW = cssW;
    this.cssH = cssH;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._labels = [];
  }

  /**
   * Map MediaPipe normalized landmark → canvas pixels accounting for object-fit: cover.
   * @param {{videoWidth:number, videoHeight:number}|null} videoEl
   */
  setVideoSource(videoEl) {
    this.videoW = videoEl?.videoWidth || 0;
    this.videoH = videoEl?.videoHeight || 0;
  }

  /**
   * @param {Array} landmarks MediaPipe normalized landmarks
   * @param {number} t seconds
   */
  draw(landmarks, t = 0) {
    this._time = t;
    this.clear();
    if (!landmarks?.length) return { labels: [], segments: 0 };

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const mapper = coverMapper(this.videoW, this.videoH, w, h);
    const scale = bodyScaleMapped(landmarks, mapper);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    const px = (lm) => mapper(lm);

    ctx.save();
    ctx.globalAlpha = this.opacity;

    if (this.showSkeleton) {
      this._drawSkeleton(landmarks, px, scale);
    }

    const layers =
      this.layer === 'all'
        ? ['bones', 'muscles', 'ligaments', 'tendons']
        : [this.layer];

    let segments = 0;
    for (const layer of layers) {
      const list = STRUCTURES[layer] || [];
      const meta = LAYER_META[layer];
      const alphaMul = this.layer === 'all' ? layerAlpha(layer) : 1;

      for (const s of list) {
        if (!visible(landmarks, s.a) || !visible(landmarks, s.b)) continue;
        const pa = px(landmarks[s.a]);
        const pb = px(landmarks[s.b]);
        const width = s.w * scale;

        ctx.save();
        ctx.globalAlpha = this.opacity * alphaMul;

        if (layer === 'muscles') {
          this._drawMuscle(pa, pb, width, s, meta, pulse);
        } else if (layer === 'bones') {
          this._drawBone(pa, pb, width, s, meta);
        } else if (layer === 'ligaments') {
          this._drawLigament(pa, pb, width, s, meta, landmarks, px, scale);
        } else if (layer === 'tendons') {
          this._drawTendon(pa, pb, width, s, meta);
        }

        ctx.restore();
        segments += 1;

        if (this.showLabels && s.label) {
          const mid = {
            x: (pa.x + pb.x) / 2,
            y: (pa.y + pb.y) / 2,
          };
          this._labels.push({
            x: mid.x / (this.dpr || 1),
            y: mid.y / (this.dpr || 1),
            text: s.label,
            color: meta.color,
            layer,
          });
        }
      }

      // Joint markers for bones / ligaments
      if (layer === 'bones' || layer === 'ligaments') {
        this._drawJoints(landmarks, px, scale, meta, layer);
      }
    }

    // Optional texture plate (Higgsfield asset) as atmospheric vignette on body bbox
    this._drawTexturePlate(landmarks, px, w, h);

    if (this.showLabels) {
      this._drawLabels(w, h);
    }

    ctx.restore();
    return { labels: this._labels, segments };
  }

  _drawSkeleton(lm, px, scale) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.22)';
    ctx.lineWidth = Math.max(1, scale * 0.04);
    ctx.lineCap = 'round';
    for (const [a, b] of SKELETON) {
      if (!visible(lm, a, 0.4) || !visible(lm, b, 0.4)) continue;
      const pa = px(lm[a]);
      const pb = px(lm[b]);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    // joints
    ctx.fillStyle = 'rgba(94, 234, 212, 0.45)';
    for (const i of Object.keys(JOINT_RADIUS).map(Number)) {
      if (!visible(lm, i, 0.4)) continue;
      const p = px(lm[i]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, scale * 0.06 * (JOINT_RADIUS[i] || 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawMuscle(pa, pb, width, s, meta, pulse) {
    const ctx = this.ctx;
    const bulge = (s.bulge ?? 0.5) * (0.92 + 0.08 * pulse);
    const pts = musclePolygon(pa, pb, width, bulge);

    // Outer glow
    if (this.glow > 0.05) {
      ctx.save();
      ctx.shadowColor = meta.glow;
      ctx.shadowBlur = 18 * this.glow * (this.dpr || 1);
      ctx.fillStyle = hexAlpha(meta.color, 0.25);
      pathFrom(ctx, pts);
      ctx.fill();
      ctx.restore();
    }

    // Body gradient along segment
    const grad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
    grad.addColorStop(0, hexAlpha(meta.color, 0.35));
    grad.addColorStop(0.5, hexAlpha('#ff9f9f', 0.75));
    grad.addColorStop(1, hexAlpha(meta.color, 0.4));

    pathFrom(ctx, pts);
    ctx.fillStyle = grad;
    ctx.fill();

    // Fiber striations
    ctx.save();
    ctx.clip();
    drawFibers(ctx, pa, pb, width * (1 + bulge), meta.color, 7);
    ctx.restore();

    // Rim
    ctx.strokeStyle = hexAlpha('#fff', 0.18);
    ctx.lineWidth = Math.max(1, width * 0.06);
    pathFrom(ctx, pts);
    ctx.stroke();
  }

  _drawBone(pa, pb, width, s, meta) {
    const ctx = this.ctx;
    const pts = bonePolygon(pa, pb, width);

    if (this.glow > 0.05) {
      ctx.save();
      ctx.shadowColor = meta.glow;
      ctx.shadowBlur = 12 * this.glow * (this.dpr || 1);
      ctx.fillStyle = hexAlpha(meta.color, 0.35);
      pathFrom(ctx, pts);
      ctx.fill();
      ctx.restore();
    }

    const grad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.5, '#cbd5e1');
    grad.addColorStop(1, '#e2e8f0');
    pathFrom(ctx, pts);
    ctx.fillStyle = grad;
    ctx.fill();

    // marrow line
    ctx.strokeStyle = hexAlpha('#64748b', 0.35);
    ctx.lineWidth = Math.max(1, width * 0.15);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();

    // cortical rim
    ctx.strokeStyle = hexAlpha('#94a3b8', 0.7);
    ctx.lineWidth = Math.max(1, width * 0.08);
    pathFrom(ctx, pts);
    ctx.stroke();
  }

  _drawLigament(pa, pb, width, s, meta, lm, px, scale) {
    const ctx = this.ctx;

    // Cross-bands near joint
    const jointIdx = s.joint;
    let center = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    if (jointIdx != null && visible(lm, jointIdx, 0.4)) {
      center = px(lm[jointIdx]);
    }

    const dir = norm(sub(pb, pa));
    const n = { x: -dir.y, y: dir.x };

    ctx.save();
    if (this.glow > 0.05) {
      ctx.shadowColor = meta.glow;
      ctx.shadowBlur = 10 * this.glow * (this.dpr || 1);
    }

    // Primary band along bone
    strokeRibbon(ctx, pa, pb, width * 0.55, meta.color, 0.85);

    // X-cross at joint
    const arm = scale * 0.22;
    const c1a = add(center, mul(add(dir, n), arm * 0.7));
    const c1b = add(center, mul(add(mul(dir, -1), mul(n, -1)), arm * 0.7));
    const c2a = add(center, mul(add(dir, mul(n, -1)), arm * 0.7));
    const c2b = add(center, mul(add(mul(dir, -1), n), arm * 0.7));
    strokeRibbon(ctx, c1a, c1b, width * 0.4, meta.color, 0.9);
    strokeRibbon(ctx, c2a, c2b, width * 0.4, meta.color, 0.9);

    // Joint ring
    ctx.beginPath();
    ctx.arc(center.x, center.y, scale * 0.12, 0, Math.PI * 2);
    ctx.strokeStyle = hexAlpha(meta.color, 0.7);
    ctx.lineWidth = Math.max(1.5, width * 0.35);
    ctx.stroke();

    ctx.restore();
  }

  _drawTendon(pa, pb, width, s, meta) {
    const ctx = this.ctx;
    const offset = s.offset ?? 0;
    const dir = norm(sub(pb, pa));
    const n = { x: -dir.y, y: dir.x };
    const o = mul(n, width * 3 * offset);

    const a = add(pa, o);
    const b = add(pb, o);

    // Parallel twin cords
    const shift = mul(n, width * 0.9);
    drawCord(ctx, add(a, shift), add(b, shift), width, meta, this.glow, this.dpr);
    drawCord(ctx, sub(a, shift), sub(b, shift), width * 0.85, meta, this.glow, this.dpr);
  }

  _drawJoints(lm, px, scale, meta, layer) {
    const ctx = this.ctx;
    const keys = Object.keys(JOINT_RADIUS).map(Number);
    for (const i of keys) {
      if (!visible(lm, i, 0.5)) continue;
      const p = px(lm[i]);
      const r = scale * 0.1 * (JOINT_RADIUS[i] || 1);

      if (layer === 'bones') {
        const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.55, '#e2e8f0');
        g.addColorStop(1, '#94a3b8');
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = hexAlpha('#64748b', 0.6);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(meta.color, 0.35);
        ctx.fill();
      }
    }
  }

  _drawTexturePlate(lm, px, w, h) {
    const tex =
      this.textures[this.layer] ||
      this.textures.all ||
      this.textures.muscles;
    if (!tex) return;

    const ls = lm[LM.L_SHOULDER];
    const rs = lm[LM.R_SHOULDER];
    const lh = lm[LM.L_HIP];
    const rh = lm[LM.R_HIP];
    const la = lm[LM.L_ANKLE];
    const ra = lm[LM.R_ANKLE];
    if (!ls || !rs) return;

    const pts = [ls, rs, lh, rh, la, ra].filter(Boolean).map(px);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const padX = (maxX - minX) * 0.15;
    const padY = (maxY - minY) * 0.12;
    const x = minX - padX;
    const y = minY - padY;
    const bw = maxX - minX + padX * 2;
    const bh = maxY - minY + padY * 2;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.14 * this.opacity;
    ctx.globalCompositeOperation = 'screen';
    // Soft clip ellipse over torso
    ctx.beginPath();
    ctx.ellipse(x + bw / 2, y + bh / 2, bw * 0.42, bh * 0.48, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(tex, x, y, bw, bh);
    ctx.restore();
  }

  _drawLabels(w, h) {
    const ctx = this.ctx;
    // Deduplicate by label text, keep first
    const seen = new Set();
    const dpr = this.dpr || 1;

    for (const lab of this._labels) {
      if (seen.has(lab.text)) continue;
      seen.add(lab.text);
      // Only show a subset to avoid clutter — prefer major labels
      if (seen.size > 8) break;

      const x = lab.x * dpr;
      const y = lab.y * dpr;
      const text = lab.text;
      ctx.font = `600 ${Math.max(11, 11 * dpr)}px "Space Grotesk", system-ui, sans-serif`;
      const tw = ctx.measureText(text).width;
      const padX = 8 * dpr;
      const padY = 5 * dpr;
      const bh = 16 * dpr;

      ctx.fillStyle = 'rgba(5, 10, 20, 0.72)';
      roundRect(ctx, x - tw / 2 - padX, y - bh - 6 * dpr, tw + padX * 2, bh + padY, 6 * dpr);
      ctx.fill();

      ctx.strokeStyle = hexAlpha(lab.color, 0.5);
      ctx.lineWidth = 1 * dpr;
      roundRect(ctx, x - tw / 2 - padX, y - bh - 6 * dpr, tw + padX * 2, bh + padY, 6 * dpr);
      ctx.stroke();

      ctx.fillStyle = lab.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y - bh / 2 - 3 * dpr);
    }
  }
}

/* ─── geometry helpers ─────────────────────────────────────────── */

/**
 * object-fit: cover mapping from normalized video coords → canvas pixels.
 */
function coverMapper(videoW, videoH, canvasW, canvasH) {
  if (!videoW || !videoH) {
    return (lm) => ({ x: lm.x * canvasW, y: lm.y * canvasH, z: lm.z ?? 0 });
  }
  const scale = Math.max(canvasW / videoW, canvasH / videoH);
  const drawW = videoW * scale;
  const drawH = videoH * scale;
  const offX = (canvasW - drawW) / 2;
  const offY = (canvasH - drawH) / 2;
  return (lm) => ({
    x: lm.x * drawW + offX,
    y: lm.y * drawH + offY,
    z: lm.z ?? 0,
  });
}

function bodyScaleMapped(landmarks, mapper) {
  if (!landmarks) return 40;
  const ls = landmarks[LM.L_SHOULDER];
  const rs = landmarks[LM.R_SHOULDER];
  const lh = landmarks[LM.L_HIP];
  const rh = landmarks[LM.R_HIP];
  if (!ls || !rs) return 40;
  const a = mapper(ls);
  const b = mapper(rs);
  const shoulder = Math.hypot(a.x - b.x, a.y - b.y);
  let torso = shoulder;
  if (lh && rh) {
    const midS = mapper({ x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2, z: 0 });
    const midH = mapper({ x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2, z: 0 });
    torso = Math.hypot(midS.x - midH.x, midS.y - midH.y);
  }
  return Math.max(shoulder * 0.35, torso * 0.18, 12);
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}
function mul(a, s) {
  return { x: a.x * s, y: a.y * s };
}
function norm(v) {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}
function perp(v) {
  return { x: -v.y, y: v.x };
}

function musclePolygon(a, b, width, bulge) {
  const d = sub(b, a);
  const n = perp(norm(d));
  const len = Math.hypot(d.x, d.y);
  const steps = 10;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // capsule profile: thin at ends, thick mid
    const profile = Math.sin(Math.PI * t);
    const r = width * (0.45 + bulge * profile);
    const p = { x: a.x + d.x * t, y: a.y + d.y * t };
    // slight S-curve for organic feel
    const curve = Math.sin(t * Math.PI) * width * 0.15;
    const cn = mul(n, curve);
    left.push(add(add(p, mul(n, r)), cn));
    right.push(add(add(p, mul(n, -r)), cn));
  }
  return [...left, ...right.reverse()];
}

function bonePolygon(a, b, width) {
  const d = sub(b, a);
  const n = perp(norm(d));
  const len = Math.hypot(d.x, d.y) || 1;
  // flared ends (epiphysis)
  const midW = width * 0.7;
  const endW = width * 1.15;
  const points = [];
  const samples = [
    [0, endW],
    [0.08, endW * 0.95],
    [0.2, midW],
    [0.5, midW * 0.95],
    [0.8, midW],
    [0.92, endW * 0.95],
    [1, endW],
  ];
  const left = [];
  const right = [];
  for (const [t, r] of samples) {
    const p = { x: a.x + d.x * t, y: a.y + d.y * t };
    left.push(add(p, mul(n, r)));
    right.push(add(p, mul(n, -r)));
  }
  return [...left, ...right.reverse()];
}

function pathFrom(ctx, pts) {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function drawFibers(ctx, a, b, width, color, count) {
  const d = sub(b, a);
  const n = perp(norm(d));
  ctx.lineWidth = Math.max(1, width * 0.04);
  ctx.strokeStyle = hexAlpha('#fff', 0.12);
  for (let i = 0; i < count; i++) {
    const o = ((i / (count - 1)) - 0.5) * width * 0.85;
    const aa = add(a, mul(n, o));
    const bb = add(b, mul(n, o * 0.9));
    ctx.beginPath();
    ctx.moveTo(aa.x, aa.y);
    ctx.lineTo(bb.x, bb.y);
    ctx.stroke();
  }
}

function strokeRibbon(ctx, a, b, width, color, alpha) {
  ctx.strokeStyle = hexAlpha(color, alpha);
  ctx.lineWidth = Math.max(1.5, width);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  // highlight
  ctx.strokeStyle = hexAlpha('#fff', 0.25 * alpha);
  ctx.lineWidth = Math.max(1, width * 0.35);
  ctx.stroke();
}

function drawCord(ctx, a, b, width, meta, glow, dpr = 1) {
  if (glow > 0.05) {
    ctx.save();
    ctx.shadowColor = meta.glow;
    ctx.shadowBlur = 8 * glow * dpr;
    ctx.strokeStyle = hexAlpha(meta.color, 0.9);
    ctx.lineWidth = Math.max(1.5, width);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = hexAlpha(meta.color, 0.9);
    ctx.lineWidth = Math.max(1.5, width);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // bright core
  ctx.strokeStyle = hexAlpha('#ede9fe', 0.7);
  ctx.lineWidth = Math.max(1, width * 0.35);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexAlpha(hex, a) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function layerAlpha(layer) {
  switch (layer) {
    case 'bones': return 0.7;
    case 'muscles': return 0.55;
    case 'ligaments': return 0.85;
    case 'tendons': return 0.9;
    default: return 0.7;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
