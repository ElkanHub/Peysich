import type { MetadataRoute } from "next";

/** The installable app. Served on every host (root and each school's
 *  subdomain — the proxy lets it through), so "Add to Home Screen" on
 *  stmarys.<domain> opens straight into that school. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SchoolSpec",
    short_name: "SchoolSpec",
    description: "Attendance, report cards, fees and parent SMS — the whole school in one place.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#1a1218",
    theme_color: "#1a1218",
    lang: "en",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
      { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
      { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
      { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Attendance", short_name: "Register", url: "/attendance", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
      { name: "Fees", short_name: "Fees", url: "/fees", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
      { name: "My account", short_name: "Account", url: "/account", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
    ],
    screenshots: [
      { src: "/shots/hero-dashboard.png", sizes: "2040x1275", type: "image/png", form_factor: "wide", label: "The admin dashboard" },
      { src: "/shots/mobile-dashboard.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "The dashboard on a phone" },
    ],
  };
}
