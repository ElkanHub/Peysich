import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaProvider } from "@/pwa/provider";
import splash from "./splash-manifest.json";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const BASE = ROOT.includes("localhost") ? `http://${ROOT}` : `https://${ROOT}`;

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: { default: "SchoolSpec", template: "%s · SchoolSpec" },
  description: "Attendance, report cards, fees and parent SMS — the whole school in one place, from preschool to JHS.",
  applicationName: "SchoolSpec",
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
  openGraph: { title: "SchoolSpec", siteName: "SchoolSpec", images: ["/og.png"], type: "website" },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
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
