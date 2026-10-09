"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchool } from "@/core/school-context";
import { closeTerm, closeYearIfDone, openTerm, reopenTerm, schoolWritable } from "@/core/terms";
import { withFlash } from "@/lib/flash";

/* The ceremonies of the cycle (docs/11), admin only. Each one lands back on
 * Home or Settings with one sentence saying what happened. */

const back = (path: string, msg: string, error = false): never => redirect(withFlash(path, msg, error ? { error: true } : undefined));

export async function openTermAction(slug: string, termId: string) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  // opening a term is the paywall: reading is always free, a new cycle is not
  if (!schoolWritable(school.status)) back("/billing", "Renew the subscription to open a new term. Everything is kept and readable meanwhile.", true);
  try { await openTerm(school.id, termId, user.id); }
  catch (e) { back("/", (e as Error).message, true); }
  revalidatePath("/"); revalidatePath("/settings");
  back("/", "The term is open. Registers, scores and fees record into it from today.");
}

export async function closeTermAction(slug: string, termId: string, f: FormData) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  const anyway = f.get("anyway") === "on";
  const { listTerms, summarise } = await import("@/core/terms");
  const t = (await listTerms(school.id)).find((x) => x.id === termId);
  if (!t) return back("/", "No such term.", true);
  if (!anyway) {
    const s = await summarise(school.id, t);
    if (s.reportCards === 0 && s.students > 0)
      back(`/reports`, `No report cards have gone out for ${t.name}. Send them first, or tick "close anyway" on Home.`, true);
  }
  const summary = await closeTerm(school.id, termId, user).catch((e: Error) => back("/", e.message, true));
  const yearDone = await closeYearIfDone(school.id, t.yearId);
  revalidatePath("/"); revalidatePath("/settings"); revalidatePath("/archives");
  back("/archives", `${t.name} is closed and in Archives: ${summary.reportCards} report cards, GHS ${Math.round(summary.collectedPesewas / 100).toLocaleString()} collected.${yearDone ? ` ${t.year.name} is complete.` : ""}`);
}

export async function reopenTermAction(slug: string, termId: string, f: FormData) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  const reason = String(f.get("reason") ?? "").trim();
  if (!reason) back("/settings", "Say why before reopening.", true);
  try { await reopenTerm(school.id, termId, user, reason); }
  catch (e) { back("/settings", (e as Error).message, true); }
  revalidatePath("/"); revalidatePath("/settings"); revalidatePath("/archives");
  back("/", "The term is open again for corrections. Close it from Home when the change is done.");
}
