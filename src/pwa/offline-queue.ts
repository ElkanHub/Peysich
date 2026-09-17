"use client";
/* ── Offline write queue (IndexedDB) ────────────────────────────────────────
   A teacher marking the register in a classroom with no signal should not
   lose the work. Saves that can't reach the server are kept here and
   replayed the moment the network returns (see PwaProvider). Tiny promise
   wrapper over IndexedDB — no dependency, no schema drift. */

const DB = "schoolspec-offline";
const STORE = "register_queue";

export type QueuedRegister = {
  id?: number; slug: string; classId: string; className: string;
  date?: string; statuses: Record<string, string>; at: number; tries: number;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

export const QUEUE_EVENT = "schoolspec:queue";
const changed = () => window.dispatchEvent(new Event(QUEUE_EVENT));

export async function enqueueRegister(item: Omit<QueuedRegister, "id" | "at" | "tries">) {
  await tx("readwrite", (s) => s.add({ ...item, at: Date.now(), tries: 0 }));
  changed();
}
export const pendingRegisters = () => tx<QueuedRegister[]>("readonly", (s) => s.getAll());
async function remove(id: number) { await tx("readwrite", (s) => s.delete(id)); changed(); }
async function bump(item: QueuedRegister) { await tx("readwrite", (s) => s.put({ ...item, tries: item.tries + 1 })); }

/** Replays everything waiting. Returns what was sent so the UI can say so.
 *  A rejected save (e.g. the day became a holiday) is dropped after 3 tries
 *  rather than looping forever — the register page shows the truth anyway. */
export async function flushRegisters(): Promise<{ sent: number; left: number }> {
  if (typeof indexedDB === "undefined" || !navigator.onLine) return { sent: 0, left: 0 };
  const items = await pendingRegisters();
  let sent = 0;
  for (const it of items) {
    try {
      const r = await fetch("/api/sync/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: it.slug, classId: it.classId, date: it.date, statuses: it.statuses }),
      });
      if (r.ok || (r.status >= 400 && r.status < 500)) { await remove(it.id!); if (r.ok) sent++; }
      else if (it.tries >= 3) await remove(it.id!);
      else await bump(it);
    } catch { /* still offline — leave it */ }
  }
  const left = (await pendingRegisters()).length;
  changed();
  return { sent, left };
}
