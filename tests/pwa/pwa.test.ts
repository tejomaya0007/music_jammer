import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { preview, type PreviewServer } from 'vite';
import { chromium } from '@playwright/test';

/**
 * PWA checks on the production build:
 *  - vite build works, then vite preview serves it
 *  - manifest is valid, icons exist with the right sizes
 *  - the service worker is emitted, registers in Chromium, and the app shell is precached
 *  - Lighthouse's installability audits pass
 */

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const PORT = 4180;
const URL = `http://localhost:${PORT}/`;

let server: PreviewServer;
let manifest: Record<string, any>;

beforeAll(async () => {
  execSync('npx vite build', { cwd: ROOT, stdio: 'pipe', timeout: 240_000 });
  server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true, host: 'localhost' }, configFile: join(ROOT, 'vite.config.ts') });
  manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'));
}, 300_000);

afterAll(async () => {
  await server?.close();
});

function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  // PNG signature, then IHDR width/height at byte 16 and 20
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('manifest', () => {
  it('has the required installable fields', () => {
    expect(manifest.name).toBe('Jam Room');
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('has 192 and 512 icons, plus a maskable one', () => {
    const sizes = (manifest.icons as Array<{ sizes: string; purpose?: string }>).map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect((manifest.icons as Array<{ purpose?: string }>).some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('every listed icon exists in dist and is the declared size', () => {
    for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
      const file = join(DIST, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(file)).toEqual({ w, h });
    }
  });
});

describe('build output', () => {
  it('emits a service worker and the registration script', () => {
    expect(existsSync(join(DIST, 'sw.js'))).toBe(true);
    expect(existsSync(join(DIST, 'registerSW.js'))).toBe(true);
  });

  it('index.html links the manifest, the icons and registers the worker', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('apple-touch-icon');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('registerSW');
  });

  it('precaches the app shell (js, css, html)', () => {
    const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
    expect(sw).toMatch(/precacheAndRoute/);
    const files = readdirRecursive(join(DIST, 'assets'));
    expect(files.some((f) => f.endsWith('.js'))).toBe(true);
    expect(files.some((f) => f.endsWith('.css'))).toBe(true);
  });

  it('is served by vite preview', async () => {
    const res = await fetch(URL);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<div id="root">');
    const m = await fetch(`${URL}manifest.webmanifest`);
    expect(m.status).toBe(200);
  });
});

describe('service worker in Chromium', () => {
  it('registers and controls the page', async () => {
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(URL);
      await page.waitForFunction(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg;
      }, undefined, { timeout: 30_000 });
      const state = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active?.state ?? reg?.installing?.state ?? reg?.waiting?.state ?? 'none';
      });
      expect(['activated', 'installed', 'activating', 'installing']).toContain(state);
      await ctx.close();
    } finally {
      await browser.close();
    }
  }, 120_000);
});

describe('installability criteria in Chromium', () => {
  // Lighthouse 12+ removed its installability audits, and this Chromium build lacks the
  // Page.getInstallabilityError CDP call. So each criterion Chrome checks is tested here instead.
  it('service worker controls the page and handles fetch (offline-capable shell)', async () => {
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(URL);
      await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()), undefined, { timeout: 30_000 });
      await page.reload();
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 30_000 });
      expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      // sw.js imports the workbox runtime, which holds the fetch listener: scan all worker files
      const swFiles = readdirSync(DIST).filter((f) => /^(sw|workbox-.*)\.js$/.test(f));
      const swSource = swFiles.map((f) => readFileSync(join(DIST, f), 'utf8')).join('\n');
      expect(swSource).toMatch(/addEventListener\(["']fetch["']/);
      await ctx.close();
    } finally {
      await browser.close();
    }
  }, 180_000);

  it('manifest is served with the right type and linked from the page', async () => {
    const res = await fetch(`${URL}manifest.webmanifest`);
    expect(res.headers.get('content-type')).toMatch(/manifest|json/);
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    expect(html).toMatch(/<link[^>]+rel="manifest"[^>]+href="[^"]*manifest.webmanifest"/);
  });
});

function readdirRecursive(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? readdirRecursive(p) : [name];
  });
}
