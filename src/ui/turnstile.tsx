"use client";
import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, o: {
        sitekey: string; callback: (t: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void;
        theme?: string; appearance?: string; size?: string; retry?: string;
      }) => string;
      reset: (id: string) => void;
    };
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** The header Better Auth's captcha plugin reads. Empty when Turnstile is off. */
export const captchaHeaders = (token: string) => (TURNSTILE_SITE_KEY ? { "x-captcha-response": token } : {});

/** Cloudflare Turnstile: hands the token to `onToken`, "" when it expires or
 *  fails. Renders nothing when the site key is unset (dev). The parent bumps
 *  `resetKey` after a failed attempt — tokens are single-use.
 *
 *  Desktop: invisible unless Cloudflare needs a click. Phones: the widget is
 *  always shown ("always", flexible width) — on a small screen an invisible
 *  check that silently fails leaves the person pressing Sign in with nothing
 *  happening, and the visible tick says the door is ready. */
export function Turnstile({ onToken, resetKey = 0 }: { onToken: (t: string) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);
  useEffect(() => { cb.current = onToken; }, [onToken]);

  const mount = () => {
    if (!box.current || widget.current !== null || !window.turnstile) return;
    const phone = window.matchMedia("(pointer: coarse)").matches;
    widget.current = window.turnstile.render(box.current, {
      sitekey: TURNSTILE_SITE_KEY, appearance: phone ? "always" : "interaction-only", size: "flexible", retry: "auto",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      callback: (t) => cb.current(t), "expired-callback": () => cb.current(""), "error-callback": () => cb.current(""),
    });
  };
  useEffect(mount, []);
  useEffect(() => { if (resetKey && widget.current !== null) { window.turnstile?.reset(widget.current); cb.current(""); } }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={mount} />
      <div ref={box} className="min-h-0 w-full [&>iframe]:max-w-full" />
    </>
  );
}
