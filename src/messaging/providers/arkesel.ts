/** Arkesel SMS v2 — what src/lib/notify.ts sendSms did, moved behind the door.
 *  Never logs the key or the body. */
export const arkeselConfigured = () => !!process.env.SMS_API_KEY;

export async function sendArkesel(opts: { to: string; body: string; senderId?: string }): Promise<{ providerId?: string }> {
  const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: { "api-key": process.env.SMS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: (opts.senderId?.trim() || "SchoolSpec").slice(0, 11),
      message: opts.body, recipients: [opts.to],
    }),
  });
  if (!res.ok) throw new Error(`Arkesel ${res.status}`);
  const j = await res.json().catch(() => null) as { data?: { id?: string }[] } | null;
  return { providerId: j?.data?.[0]?.id };
}

/** What is left on the Arkesel account, for the console's cost page. */
export async function arkeselBalance(): Promise<string | null> {
  if (!arkeselConfigured()) return null;
  try {
    const res = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
      headers: { "api-key": process.env.SMS_API_KEY! },
    });
    const j = await res.json() as { data?: { sms_balance?: string | number } };
    return j.data?.sms_balance == null ? null : String(j.data.sms_balance);
  } catch { return null; }
}
