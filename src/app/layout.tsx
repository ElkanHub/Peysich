import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaProvider } from "@/pwa/provider";
import splash from "./splash-manifest.json";
import { OG_IMAGE } from "@/lib/seo";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const BASE = ROOT.includes("localhost") ? `http://${ROOT}` : `https://${ROOT}`;

const DESCRIPTION = "School management software for basic schools in Ghana. Mark the register in 30 seconds, print report cards under your crest in one click, record fees with an SMS receipt to the parent, and keep parents in the loop. Creche to JHS 3, on any phone.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: { default: "SchoolSpec — school management for basic schools in Ghana", template: "%s · SchoolSpec" },
  description: DESCRIPTION,
  applicationName: "SchoolSpec",
  keywords: ["school management software Ghana", "school management system Ghana", "attendance register app",
    "report card software Ghana", "school fees software Ghana", "GES report cards", "private school software", "basic school app"],
  authors: [{ name: "SchoolSpec", url: BASE }],
  creator: "SchoolSpec",
  category: "education",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SchoolSpec",
    startupImage: splash,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website", siteName: "SchoolSpec", locale: "en_GH", url: "/",
    title: "SchoolSpec — run the school at the speed of the morning",
    description: DESCRIPTION,
    // JPEG under 150 KB on purpose: WhatsApp drops previews over ~300 KB, and
    // WhatsApp is where school owners share links
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "SchoolSpec — run the school at the speed of the morning",
    description: "Attendance, report cards, fees and parent SMS for basic schools in Ghana. Creche to JHS 3, on any phone.",
    images: [OG_IMAGE.url],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a1218",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* apply the saved theme before first paint — no light flash (pre-rebrand key honoured) */}
        <script dangerouslySetInnerHTML={{ __html:
          `try{var t=localStorage.getItem("schoolspec-theme")||localStorage.getItem("peysich-theme");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
