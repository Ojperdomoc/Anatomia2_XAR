#!/usr/bin/env node
/**
 * Creates procedural PNG anatomy plates (no external API needed).
 * Used as fallback / default assets; replace via `npm run generate:assets` (Higgsfield).
 */
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'assets');

const W = 768;
const H = 1024;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeB = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeB, data, crc]);
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const compressed = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPx(rgba, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  // alpha blend over existing
  const oa = rgba[i + 3] / 255;
  const na = a / 255;
  const outA = na + oa * (1 - na);
  if (outA <= 0) return;
  rgba[i] = Math.round((r * na + rgba[i] * oa * (1 - na)) / outA);
  rgba[i + 1] = Math.round((g * na + rgba[i + 1] * oa * (1 - na)) / outA);
  rgba[i + 2] = Math.round((b * na + rgba[i + 2] * oa * (1 - na)) / outA);
  rgba[i + 3] = Math.round(outA * 255);
}

function fillCircle(rgba, cx, cy, rad, r, g, b, a) {
  const r2 = rad * rad;
  const x0 = Math.floor(cx - rad);
  const x1 = Math.ceil(cx + rad);
  const y0 = Math.floor(cy - rad);
  const y1 = Math.ceil(cy + rad);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= r2) {
        const fall = 1 - Math.sqrt(d) / rad;
        setPx(rgba, x, y, r, g, b, a * fall * fall);
      }
    }
  }
}

function strokeSegment(rgba, x0, y0, x1, y1, thickness, r, g, b, a, bulge = 0) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const steps = Math.ceil(len);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    const profile = Math.sin(Math.PI * t);
    const rad = thickness * (0.55 + bulge * profile);
    fillCircle(rgba, px, py, rad, r, g, b, a);
  }
}

/** Stylized body landmark layout in image space */
function bodyPoints() {
  const cx = W / 2;
  return {
    nose: [cx, 110],
    lShoulder: [cx - 90, 200],
    rShoulder: [cx + 90, 200],
    lElbow: [cx - 140, 340],
    rElbow: [cx + 140, 340],
    lWrist: [cx - 160, 480],
    rWrist: [cx + 160, 480],
    lHip: [cx - 70, 460],
    rHip: [cx + 70, 460],
    lKnee: [cx - 80, 680],
    rKnee: [cx + 80, 680],
    lAnkle: [cx - 75, 880],
    rAnkle: [cx + 75, 880],
    lFoot: [cx - 95, 940],
    rFoot: [cx + 95, 940],
  };
}

function drawBackground(rgba, c1, c2) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = y / H;
      const u = x / W;
      const r = Math.round(c1[0] * (1 - t) + c2[0] * t + Math.sin(u * 6) * 4);
      const g = Math.round(c1[1] * (1 - t) + c2[1] * t);
      const b = Math.round(c1[2] * (1 - t) + c2[2] * t + Math.cos(u * 4) * 6);
      const i = (y * W + x) * 4;
      rgba[i] = Math.max(0, Math.min(255, r));
      rgba[i + 1] = Math.max(0, Math.min(255, g));
      rgba[i + 2] = Math.max(0, Math.min(255, b));
      rgba[i + 3] = 255;
    }
  }
  // vignette + grid hint
  for (let y = 0; y < H; y += 48) {
    for (let x = 0; x < W; x++) setPx(rgba, x, y, 94, 234, 212, 18);
  }
  for (let x = 0; x < W; x += 48) {
    for (let y = 0; y < H; y++) setPx(rgba, x, y, 94, 234, 212, 14);
  }
}

function drawMuscles(rgba, p) {
  const c = [255, 90, 90];
  const segs = [
    [p.lShoulder, p.rShoulder, 28, 0.4],
    [p.lShoulder, p.lHip, 34, 0.7],
    [p.rShoulder, p.rHip, 34, 0.7],
    [p.lShoulder, p.lElbow, 26, 0.85],
    [p.lElbow, p.lWrist, 18, 0.5],
    [p.rShoulder, p.rElbow, 26, 0.85],
    [p.rElbow, p.rWrist, 18, 0.5],
    [p.lHip, p.lKnee, 32, 0.9],
    [p.lKnee, p.lAnkle, 20, 0.55],
    [p.rHip, p.rKnee, 32, 0.9],
    [p.rKnee, p.rAnkle, 20, 0.55],
    [p.lShoulder, p.nose, 12, 0.3],
    [p.rShoulder, p.nose, 12, 0.3],
    [p.lHip, p.rHip, 24, 0.35],
  ];
  for (const [a, b, th, bulge] of segs) {
    strokeSegment(rgba, a[0], a[1], b[0], b[1], th, c[0], c[1], c[2], 200, bulge);
  }
  // head
  fillCircle(rgba, p.nose[0], p.nose[1] - 10, 36, 255, 120, 110, 160);
}

function drawBones(rgba, p) {
  const c = [230, 238, 255];
  const segs = [
    [p.lShoulder, p.rShoulder, 10],
    [p.lShoulder, p.lElbow, 11],
    [p.lElbow, p.lWrist, 8],
    [p.rShoulder, p.rElbow, 11],
    [p.rElbow, p.rWrist, 8],
    [p.lShoulder, p.lHip, 9],
    [p.rShoulder, p.rHip, 9],
    [p.lHip, p.rHip, 14],
    [p.lHip, p.lKnee, 13],
    [p.lKnee, p.lAnkle, 10],
    [p.rHip, p.rKnee, 13],
    [p.rKnee, p.rAnkle, 10],
    [p.lAnkle, p.lFoot, 8],
    [p.rAnkle, p.rFoot, 8],
    // spine
    [[(p.lShoulder[0] + p.rShoulder[0]) / 2, p.lShoulder[1]], [(p.lHip[0] + p.rHip[0]) / 2, p.lHip[1]], 12],
  ];
  for (const [a, b, th] of segs) {
    strokeSegment(rgba, a[0], a[1], b[0], b[1], th, c[0], c[1], c[2], 220, 0.1);
  }
  const joints = [p.lShoulder, p.rShoulder, p.lElbow, p.rElbow, p.lWrist, p.rWrist, p.lHip, p.rHip, p.lKnee, p.rKnee, p.lAnkle, p.rAnkle, p.nose];
  for (const j of joints) fillCircle(rgba, j[0], j[1], 14, 255, 255, 255, 230);
}

function drawLigaments(rgba, p) {
  const c = [251, 191, 36];
  // faint bones
  drawBones(rgba, p);
  // wash bones down by darkening? skip — overlay gold bands
  const joints = [
    [p.lShoulder, 22],
    [p.rShoulder, 22],
    [p.lElbow, 16],
    [p.rElbow, 16],
    [p.lHip, 24],
    [p.rHip, 24],
    [p.lKnee, 20],
    [p.rKnee, 20],
    [p.lAnkle, 14],
    [p.rAnkle, 14],
  ];
  for (const [j, r] of joints) {
    // X bands
    strokeSegment(rgba, j[0] - r, j[1] - r, j[0] + r, j[1] + r, 4, c[0], c[1], c[2], 220, 0);
    strokeSegment(rgba, j[0] + r, j[1] - r, j[0] - r, j[1] + r, 4, c[0], c[1], c[2], 220, 0);
    // ring
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      const x = j[0] + Math.cos(a) * r;
      const y = j[1] + Math.sin(a) * r;
      setPx(rgba, Math.round(x), Math.round(y), c[0], c[1], c[2], 200);
      setPx(rgba, Math.round(x) + 1, Math.round(y), c[0], c[1], c[2], 160);
    }
  }
}

function drawTendons(rgba, p) {
  const c = [167, 139, 250];
  const segs = [
    [p.lShoulder, p.lElbow, 5],
    [p.lElbow, p.lWrist, 4],
    [p.rShoulder, p.rElbow, 5],
    [p.rElbow, p.rWrist, 4],
    [p.lHip, p.lKnee, 6],
    [p.lKnee, p.lAnkle, 5],
    [p.rHip, p.rKnee, 6],
    [p.rKnee, p.rAnkle, 5],
    [p.lAnkle, p.lFoot, 5],
    [p.rAnkle, p.rFoot, 5],
  ];
  for (const [a, b, th] of segs) {
    // twin cords offset
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * 8;
    const ny = (dx / len) * 8;
    strokeSegment(rgba, a[0] + nx, a[1] + ny, b[0] + nx, b[1] + ny, th, c[0], c[1], c[2], 230, 0);
    strokeSegment(rgba, a[0] - nx, a[1] - ny, b[0] - nx, b[1] - ny, th * 0.85, c[0], c[1], c[2], 200, 0);
  }
}

function drawHero(rgba, p) {
  drawMuscles(rgba, p);
  // bones on top thinner
  const c = [230, 238, 255];
  strokeSegment(rgba, p.lShoulder[0], p.lShoulder[1], p.rShoulder[0], p.rShoulder[1], 6, c[0], c[1], c[2], 180, 0);
  strokeSegment(
    rgba,
    (p.lShoulder[0] + p.rShoulder[0]) / 2,
    p.lShoulder[1],
    (p.lHip[0] + p.rHip[0]) / 2,
    p.lHip[1],
    7,
    c[0],
    c[1],
    c[2],
    180,
    0,
  );
  // HUD rings
  const cx = W / 2;
  const cy = H / 2;
  for (const rad of [180, 260, 340]) {
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      if (Math.sin(a * 6) > 0.3) continue;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad * 1.15;
      setPx(rgba, Math.round(x), Math.round(y), 94, 234, 212, 120);
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const p = bodyPoints();

  const jobs = [
    { name: 'muscles.png', bg: [[8, 12, 24], [20, 8, 16]], draw: drawMuscles },
    { name: 'bones.png', bg: [[8, 12, 28], [12, 16, 32]], draw: drawBones },
    { name: 'ligaments.png', bg: [[16, 12, 6], [10, 10, 20]], draw: drawLigaments },
    { name: 'tendons.png', bg: [[12, 8, 28], [8, 10, 24]], draw: drawTendons },
    { name: 'hero.png', bg: [[5, 10, 22], [8, 30, 36]], draw: drawHero },
  ];

  const manifest = {
    generatedAt: new Date().toISOString(),
    provider: 'procedural-placeholder',
    note: 'Replace with Higgsfield via npm run generate:assets',
    assets: {},
  };

  for (const job of jobs) {
    const rgba = Buffer.alloc(W * H * 4);
    drawBackground(rgba, job.bg[0], job.bg[1]);
    job.draw(rgba, p);
    const png = encodePNG(W, H, rgba);
    const dest = path.join(OUT, job.name);
    await writeFile(dest, png);
    const id = job.name.replace('.png', '');
    manifest.assets[id] = { id, file: job.name, url: `/assets/${job.name}` };
    console.log(`✓ ${job.name} (${(png.length / 1024).toFixed(1)} KB)`);
  }

  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
