#!/usr/bin/env node
/* Regenerates every SchoolSpec brand asset from the one mark geometry in
 * src/ui/mark-paths.mjs. Run after any change to the mark:
 *
 *   node scripts/gen-brand-assets.mjs
 *
 * Needs Playwright's Chromium (the sandbox and CI have it; locally:
 * `npx playwright install chromium` once). Writes:
 *   public/icons/icon-{72..512}.png       — manifest icons ("any")
 *   public/icons/maskable-{192,512}.png   — Android adaptive (mark in the safe zone)
 *   public/icons/badge-72.png             — monochrome notification badge
 *   public/icons/apple-touch-icon.png     — iOS home screen (180)
 *   public/splash/*.png                   — iOS startup images, portrait + landscape
 *   public/og.png                         — link preview card (1200×630)
 *   src/app/favicon.ico                   — 16/32/48 multi-size ICO
 *   src/app/icon.svg                      — the tile as an SVG favicon
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { MARK_BODY, MARK_WEDGE_TOP, MARK_WEDGE_BOTTOM, WINE, INK } from "../src/ui/mark-paths.mjs";

// require() honours NODE_PATH, so a globally installed playwright works too
const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = new URL("..", import.meta.url).pathname;
// the wordmark in Geist when a built font file exists (next/font emits one), system sans otherwise
import { readdirSync, existsSync } from "node:fs";
const media = ROOT + ".next/static/media";
const geist = existsSync(media) ? readdirSync(media).find((f) => f.endsWith(".woff2")) : null;
const GEIST_URL = geist ? "file://" + media + "/" + geist : "";
const out = (p) => ROOT + p;
mkdirSync(out("public/icons"), { recursive: true });
mkdirSync(out("public/splash"), { recursive: true });

const markSvg = (body, wine = WINE) =>
  `<path d="${MARK_BODY}" fill="${body}"/><path d="${MARK_WEDGE_TOP}" fill="${wine}"/><path d="${MARK_WEDGE_BOTTOM}" fill="${wine}"/>`;

/** Tile: ink rounded square, white mark. `inset` = fraction of the tile the
 *  mark occupies (maskable icons keep it inside Android's 80% safe circle). */
const tileSvg = (size, { radius = 0.22, scale = 0.66, bg = INK } = {}) => {
  const s = (size * scale) / 192;
  const off = (size - 192 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * radius}" fill="${bg}"/>
    <g transform="translate(${off} ${off}) scale(${s})">${markSvg("#FFFFFF")}</g>
  </svg>`.replace(/\n\s+/g, "");
};

/** Badge: white-only mark on transparent (Android tints it itself). */
const badgeSvg = (size) => {
  const s = (size * 0.9) / 192, off = (size - 192 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <g transform="translate(${off} ${off}) scale(${s})">${markSvg("#FFFFFF", "#FFFFFF")}</g></svg>`;
};

/** Splash / OG: ink ground, mark + wordmark centred, wine hairline below. */
const splashHtml = (w, h, { wordmark = true, tagline = "" } = {}) => {
  const markPx = Math.round(Math.min(w, h) * 0.22);
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    @font-face{font-family:Geist;src:url("${GEIST_URL}") format("woff2");font-weight:100 900}
    html,body{margin:0;width:${w}px;height:${h}px;background:${INK};overflow:hidden}
    .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(markPx * 0.22)}px;font-family:Geist,system-ui,sans-serif;color:#fff}
    .w{font-weight:700;letter-spacing:-.03em;font-size:${Math.round(markPx * 0.42)}px}
    .t{font-weight:600;font-size:${Math.round(markPx * 0.17)}px;color:#d8c9d4;letter-spacing:-.01em}
    .rule{position:absolute;bottom:${Math.round(h * 0.07)}px;left:50%;width:${Math.round(markPx * 0.5)}px;height:${Math.max(2, Math.round(markPx * 0.03))}px;background:${WINE};transform:translateX(-50%);border-radius:99px}
  </style></head><body><div class="c">
    <svg width="${markPx}" height="${markPx}" viewBox="0 0 192 192">${markSvg("#FFFFFF")}</svg>
    ${wordmark ? `<div class="w">SchoolSpec</div>` : ""}
    ${tagline ? `<div class="t">${tagline}</div>` : ""}
  </div><div class="rule"></div></body></html>`;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage();

async function pngFromSvg(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(out(file), buf);
  return buf;
}
async function pngFromHtml(html, w, h, file) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html);
  await page.waitForTimeout(400); // font
  writeFileSync(out(file), await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }));
}

// manifest icons ("any") — tile with the mark at 66%
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const pngs = {};
for (const s of sizes) pngs[s] = await pngFromSvg(tileSvg(s), s, `public/icons/icon-${s}.png`);
// maskable — no rounding (the OS masks), mark at 52% so it survives a circle
for (const s of [192, 512]) await pngFromSvg(tileSvg(s, { radius: 0, scale: 0.52 }), s, `public/icons/maskable-${s}.png`);
await pngFromSvg(badgeSvg(72), 72, "public/icons/badge-72.png");
await pngFromSvg(tileSvg(180), 180, "public/icons/apple-touch-icon.png");

// favicon.ico — 16/32/48 as PNG-encoded ICO entries
const ico = [];
for (const s of [16, 32, 48]) ico.push([s, await pngFromSvg(tileSvg(s, { scale: 0.74 }), s, `public/icons/favicon-${s}.png`)]);
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(ico.length, 4);
let offset = 6 + 16 * ico.length; const dirs = [], datas = [];
for (const [s, buf] of ico) {
  const d = Buffer.alloc(16);
  d.writeUInt8(s === 256 ? 0 : s, 0); d.writeUInt8(s === 256 ? 0 : s, 1); d.writeUInt8(0, 2); d.writeUInt8(0, 3);
  d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(buf.length, 8); d.writeUInt32LE(offset, 12);
  dirs.push(d); datas.push(buf); offset += buf.length;
}
writeFileSync(out("src/app/favicon.ico"), Buffer.concat([header, ...dirs, ...datas]));
writeFileSync(out("src/app/icon.svg"), tileSvg(512) + "\n");

// iOS startup images — the device list Apple actually ships; portrait + landscape
const devices = [
  [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3],
  [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2],
  [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [810, 1080, 2], [768, 1024, 2],
];
const manifest = [];
for (const [w, h, r] of devices) {
  for (const land of [false, true]) {
    const W = (land ? h : w) * r, H = (land ? w : h) * r;
    const file = `public/splash/${W}x${H}.png`;
    await pngFromHtml(splashHtml(W, H, { wordmark: true }), W, H, file);
    manifest.push({
      url: `/splash/${W}x${H}.png`,
      media: `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: ${land ? "landscape" : "portrait"})`,
    });
  }
}
writeFileSync(out("src/app/splash-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// link preview card
await pngFromHtml(splashHtml(1200, 630, { tagline: "The whole school, finally in one place." }), 1200, 630, "public/og.png");

await browser.close();
console.log("brand assets regenerated:", sizes.length + 2 + 1 + 1 + 3 + devices.length * 2 + 2, "files");
