#!/usr/bin/env node
/* Copies src/pwa/sw.template.js → public/sw.js with the build's version
 * stamped in. Runs before `next build` (see package.json). The version is
 * the commit on Vercel, the clock elsewhere — either way every deploy ships
 * a byte-different worker, which is what makes the update toast fire. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const version = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.SW_VERSION || Date.now().toString(36)).slice(0, 10);
const src = readFileSync(root + "src/pwa/sw.template.js", "utf8");
mkdirSync(root + "public", { recursive: true });
writeFileSync(root + "public/sw.js", src.replace(/__SW_VERSION__/g, version));
console.log(`service worker stamped: ${version}`);
