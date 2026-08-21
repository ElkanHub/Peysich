"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Light/dark switch. Dark keeps the wine ACCENTS and the ink sidebar —
 *  only the canvas flips to the conventional near-black/grey. Persisted in
 *  localStorage; the root layout applies it before first paint. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    try { setDark(document.documentElement.classList.contains("dark")); } catch { setDark(false); }
  }, []);

  const flip = () => {
    const next = !dark;
    setDark(next);
    try {
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("peysich-theme", next ? "dark" : "light");
    } catch { /* storage blocked — theme still flips for this page */ }
  };

  if (dark === null) return <span className="h-7 w-7" />;
  return (
    <button onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="rounded-md p-1.5 text-ink-text transition-colors hover:bg-ink-2 hover:text-ink-text-strong">
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
