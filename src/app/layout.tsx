import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Peysich",
  description: "School management for preschool to JHS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* apply the saved theme before first paint — no light flash */}
        <script dangerouslySetInnerHTML={{ __html:
          `try{if(localStorage.getItem("peysich-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className={`${geist.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
