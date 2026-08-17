import { eq } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/db";
import { schools } from "@/db/schema";

/** Subdomains that can never be school slugs. */
export const RESERVED_SLUGS = new Set([
  "www", "admin", "api", "app", "mail", "smtp", "ftp", "blog", "docs",
  "help", "support", "status", "dev", "staging", "test", "demo", "assets", "cdn",
]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export function isValidSlug(slug: string) {
  return SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Extract the school slug from a Host header, or null for root/admin/unknown hosts. */
export function slugFromHost(host: string, rootDomain: string): string | null {
  const h = host.toLowerCase().split(":")[0];
  const root = rootDomain.toLowerCase().split(":")[0];
  if (h === root || h === `www.${root}`) return null;
  if (!h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -(root.length + 1));
  if (sub.includes(".") || RESERVED_SLUGS.has(sub)) return null;
  return sub;
}

/** Cached slug → school lookup (tag: school:{slug}). */
export const getSchoolBySlug = (slug: string) =>
  unstable_cache(
    async () => {
      const [school] = await db.select().from(schools).where(eq(schools.slug, slug));
      return school ?? null;
    },
    [`school-${slug}`],
    { tags: [`school:${slug}`], revalidate: 300 },
  )();

export const invalidateSchool = (slug: string) => {
  try { revalidateTag(`school:${slug}`, "max"); } catch { /* outside request context */ }
};
