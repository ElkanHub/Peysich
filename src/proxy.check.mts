/** Routing check for src/proxy.ts — run: pnpm run check:proxy
 *  Env is read when the module loads, so it is set before the import. */
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_ROOT_DOMAIN = "schoolspec.app";
process.env.NEXT_PUBLIC_MARKETING_DOMAIN = "schoolspec.com";

const { proxy } = await import("./proxy");
const { NextRequest } = await import("next/server");

/** what the proxy did with GET https://<host><path>, as a short string */
function go(host: string, path: string, cookie = "") {
  const res = proxy(new NextRequest(`https://${host}${path}`, {
    headers: { host, ...(cookie ? { cookie } : {}) },
  }));
  const loc = res.headers.get("location");
  if (loc) return `${res.status} ${loc}`;
  const rw = res.headers.get("x-middleware-rewrite");
  return rw ? `rewrite ${new URL(rw).pathname}` : "pass";
}

const SESSION = "better-auth.session_token=abc";

// the marketing domain holds one page, and hands everything else to the app
assert.equal(go("schoolspec.com", "/"), "pass");
assert.equal(go("schoolspec.com", "/sign-in"), "308 https://schoolspec.app/sign-in");
assert.equal(go("schoolspec.com", "/signup?plan=pro"), "308 https://schoolspec.app/signup?plan=pro");

// the app's own root: signed out → marketing (temporary), signed in → untouched
assert.equal(go("schoolspec.app", "/"), "307 https://schoolspec.com/");
assert.equal(go("schoolspec.app", "/", SESSION), "pass");
assert.equal(go("schoolspec.app", "/sign-in"), "pass");

// schools and the console are unaffected by any of it
assert.equal(go("stmarys.schoolspec.app", "/attendance"), "rewrite /s/stmarys/attendance");
assert.equal(go("stmarys.schoolspec.app", "/"), "rewrite /s/stmarys");
assert.equal(go("admin.schoolspec.app", "/schools"), "rewrite /platform/schools");

// the installable-app files stay global on every host
assert.equal(go("schoolspec.com", "/sw.js"), "pass");
assert.equal(go("stmarys.schoolspec.app", "/manifest.webmanifest"), "pass");

console.log("proxy: ok");
