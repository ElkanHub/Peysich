import type { Metadata } from "next";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
export const BASE = ROOT.includes("localhost") ? `http://${ROOT}` : `https://${ROOT}`;

/** The one share card. JPEG under 150 KB on purpose: WhatsApp, where school
 *  owners share links, drops previews above ~300 KB. */
export const OG_IMAGE = {
  url: "/og.jpg", width: 1200, height: 630, type: "image/jpeg",
  alt: "SchoolSpec: 30-second register, report cards in one click, fees receipted by SMS, parents in the loop",
};

/** Search + share metadata for one public page. Next replaces a parent's
 *  openGraph / twitter objects wholesale rather than merging them, so every
 *  page that sets its own title must carry the image again — this does. */
export function pageMeta({ title, description, path, absoluteTitle }: {
  title: string; description: string; path: string; absoluteTitle?: string;
}): Metadata {
  const shown = absoluteTitle ?? `${title} · SchoolSpec`;
  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "SchoolSpec", locale: "en_GH", url: path, title: shown, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: shown, description, images: [OG_IMAGE.url] },
  };
}
