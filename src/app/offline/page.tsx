import type { Metadata } from "next";
import { OfflineClient } from "./client";

export const metadata: Metadata = { title: "Offline" };

/** Served by the service worker when a page can't be reached. It is
 *  precached with its own scripts, so the live "waiting for a connection"
 *  state works even on a phone that has never opened it before. */
export default function OfflinePage() {
  return <OfflineClient />;
}
