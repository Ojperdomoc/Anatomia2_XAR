#!/usr/bin/env node
/**
 * Generate anatomy visual assets with the Higgsfield API (Soul v2).
 *
 * Auth (either pair works):
 *   HF_API_KEY_ID + HF_API_KEY_SECRET
 *   or HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_KEY_SECRET
 *
 * Usage:
 *   npm run generate:assets
 *
 * Docs: https://docs.higgsfield.ai/docs
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

const KEY_ID =
  process.env.HF_API_KEY_ID ||
  process.env.HIGGSFIELD_API_KEY_ID ||
  process.env.HF_KEY_ID;
const KEY_SECRET =
  process.env.HF_API_KEY_SECRET ||
  process.env.HIGGSFIELD_API_KEY_SECRET ||
  process.env.HF_KEY_SECRET;

const API = 'https://api.higgsfield.ai';
const ENDPOINT = `${API}/higgsfield-ai/soul/v2/standard`;

const ASSETS = [
  {
    id: 'muscles',
    file: 'muscles.png',
    prompt:
      'Medical anatomy illustration of human muscular system, full body anterior view, detailed striated muscles in vivid crimson and coral red, dark cinematic void background, holographic HUD glow, sci-fi educational style, ultra detailed, no text, no watermark, centered composition, 3D render quality',
  },
  {
    id: 'bones',
    file: 'bones.png',
    prompt:
      'Medical anatomy illustration of human skeleton full body anterior view, clean ivory bones with subtle blue rim light, dark cinematic void background, holographic HUD aesthetic, sci-fi educational atlas, ultra detailed, no text, no watermark, centered, 3D render quality',
  },
  {
    id: 'ligaments',
    file: 'ligaments.png',
    prompt:
      'Medical anatomy illustration focusing on human ligaments and joint capsules, amber and gold fibrous bands connecting bones at shoulders elbows hips knees ankles, translucent bones underneath, dark cinematic background, holographic educational style, ultra detailed, no text, no watermark',
  },
  {
    id: 'tendons',
    file: 'tendons.png',
    prompt:
      'Medical anatomy illustration of human tendons as luminous violet cords anchoring muscles to bones, Achilles biceps quadriceps tendons highlighted, dark cinematic void background, sci-fi holographic atlas style, ultra detailed, no text, no watermark, centered',
  },
  {
    id: 'hero',
    file: 'hero.png',
    prompt:
      'Hero key art for an AR anatomy app: translucent human figure with layered muscles bones ligaments tendons glowing in red ivory gold and violet, holographic HUD rings, dark teal indigo gradient background, futuristic medical tech aesthetic, ultra detailed, no text, no watermark',
  },
];

function authHeader() {
  if (!KEY_ID || !KEY_SECRET) {
    throw new Error(
      'Missing Higgsfield credentials. Set HF_API_KEY_ID and HF_API_KEY_SECRET (see https://cloud.higgsfield.ai/).',
    );
  }
  return `Key ${KEY_ID}:${KEY_SECRET}`;
}

async function submit(prompt) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Submit failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function poll(statusUrl, { timeoutMs = 300_000, intervalMs = 2500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(statusUrl, {
      headers: { Authorization: authHeader() },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Status failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    const status = (data.status || '').toLowerCase();
    if (status === 'completed' || status === 'succeeded' || status === 'success') {
      return data;
    }
    if (status === 'failed' || status === 'error' || status === 'canceled' || status === 'cancelled') {
      throw new Error(`Generation ${status}: ${JSON.stringify(data)}`);
    }
    process.stdout.write(`.`);
    await sleep(intervalMs);
  }
  throw new Error('Timed out waiting for Higgsfield generation');
}

function extractUrl(result) {
  // Be tolerant of response shapes across API versions
  const candidates = [
    result?.output?.url,
    result?.output?.image_url,
    result?.output?.images?.[0]?.url,
    result?.output?.[0]?.url,
    result?.images?.[0]?.url,
    result?.image_url,
    result?.url,
    result?.data?.output?.url,
    result?.data?.images?.[0]?.url,
  ];
  for (const u of candidates) {
    if (typeof u === 'string' && u.startsWith('http')) return u;
  }
  // deep search
  const raw = JSON.stringify(result);
  const match = raw.match(/https:\/\/[^"'\s]+\.(?:png|jpg|jpeg|webp)/i);
  if (match) return match[0];
  throw new Error(`Could not find image URL in result: ${raw.slice(0, 500)}`);
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

async function generateOne(asset) {
  console.log(`\n→ Generating [${asset.id}] via Higgsfield Soul v2`);
  console.log(`  prompt: ${asset.prompt.slice(0, 90)}…`);
  const job = await submit(asset.prompt);
  const statusUrl = job.status_url || `${API}/requests/${job.request_id}/status`;
  console.log(`  request: ${job.request_id || statusUrl}`);
  const result = await poll(statusUrl);
  process.stdout.write('\n');
  const url = extractUrl(result);
  const dest = path.join(OUT_DIR, asset.file);
  const bytes = await download(url, dest);
  console.log(`  ✓ saved ${asset.file} (${(bytes / 1024).toFixed(1)} KB)`);
  return { id: asset.id, file: asset.file, url: `/assets/${asset.file}`, source: url };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  if (!KEY_ID || !KEY_SECRET) {
    console.warn('⚠️  No Higgsfield API keys found.');
    console.warn('   Procedural overlays already work without assets.');
    console.warn('   To generate AI plates:');
    console.warn('     export HF_API_KEY_ID=...');
    console.warn('     export HF_API_KEY_SECRET=...');
    console.warn('     npm run generate:assets');
    console.warn('\n   Writing placeholder manifest so the app can boot.');
    await writePlaceholderManifest();
    process.exit(0);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    provider: 'higgsfield',
    model: 'soul/v2/standard',
    assets: {},
  };

  for (const asset of ASSETS) {
    try {
      const entry = await generateOne(asset);
      manifest.assets[asset.id] = entry;
    } catch (err) {
      console.error(`  ✗ ${asset.id}: ${err.message}`);
    }
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest → ${MANIFEST_PATH}`);
  console.log('Done.');
}

async function writePlaceholderManifest() {
  const assets = {};
  for (const a of ASSETS) {
    const p = path.join(OUT_DIR, a.file);
    assets[a.id] = {
      id: a.id,
      file: a.file,
      url: `/assets/${a.file}`,
      present: existsSync(p),
    };
  }
  await writeFile(
    MANIFEST_PATH,
    JSON.stringify(
      {
        generatedAt: null,
        provider: 'higgsfield',
        note: 'Run npm run generate:assets with HF credentials to populate.',
        assets,
      },
      null,
      2,
    ),
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
