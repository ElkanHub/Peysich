import type { MetadataRoute } from "next";
import { allPosts } from "@/lib/blog";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const BASE = ROOT.includes("localhost") ? `http://${ROOT}` : `https://${ROOT}`;

/** Three public pages. Everything else is a school's private space. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/sign-in`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/textbooks`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...allPosts().map((p) => ({ url: `${BASE}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...["", "/terms", "/privacy", "/data-processing", "/cookies", "/refunds"].map((p) => (
      { url: `${BASE}/legal${p}`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
