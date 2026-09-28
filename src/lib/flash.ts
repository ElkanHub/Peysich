/** Build a redirect target that shows a specific toast on arrival.
 *
 *  Every server action that finishes something says what it did, in one
 *  sentence, in the person's words: "Register saved. 3 parents told."
 *  Legacy keys (saved / done / error) still work, but new code passes a
 *  sentence. Prefix the sentence with "!" for the error tone.
 *
 *    redirect(withFlash(`/s/${slug}/fees`, "Payment of GHS 250 saved."));
 *    redirect(withFlash(path, "Draft removed.", { undo: `${path}/undo` }));
 *
 *  `undo` is a URL the toast POSTs to (a route.ts) when Undo is tapped. */
export function withFlash(path: string, message: string, opts?: { error?: boolean; undo?: string }) {
  const p = new URLSearchParams();
  p.set("flash", (opts?.error ? "!" : "") + message);
  if (opts?.undo) p.set("undo", opts.undo);
  return `${path}${path.includes("?") ? "&" : "?"}${p.toString()}`;
}
