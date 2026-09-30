import type { MetadataRoute } from "next";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const BASE = ROOT.includes("localhost") ? `http://${ROOT}` : `https://${ROOT}`;

/** Only the marketing page and the two doors are for search engines.
 *  Schools live on subdomains and the console on admin.; the proxy stamps
 *  every one of those responses with X-Robots-Tag: noindex as well, so a
 *  crawler that never reads this file still stays out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/signup", "/sign-in", "/legal"],
        disallow: ["/s/", "/platform", "/api/", "/t/", "/go", "/sign/", "/offline", "/_next/"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
