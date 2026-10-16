import type { NextConfig } from "next";

// Every response. Scripts: our own plus Turnstile; 'unsafe-inline' stays because
// the theme / door scripts are inline and the public pages are static (a nonce
// would force them dynamic). Frames: only Turnstile's challenge; nobody frames us.
// ponytail: move to a per-request nonce when the public pages go dynamic anyway.
const CSP = [
  "default-src 'self'",
  // React dev tools need eval for readable stack traces; never in production
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com https://*.r2.cloudflarestorage.com", // photos go to R2 straight from the phone
  "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"], minimumCacheTTL: 2678400 },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // a cached service worker would pin every phone to an old build
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // photographs, shots and icons change by filename, not in place: a day
        // in the browser, a month at the edge, no revalidation round-trips
        source: "/:dir(hero|shots|marketing|icons|splash)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
