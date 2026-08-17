import Link from "next/link";

// Marketing landing (root domain). Full site comes in Phase 3.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Peysich</h1>
      <p className="max-w-md text-center text-muted-foreground">
        School management for preschool to JHS — attendance, report cards, fees
        and communication, on your school&apos;s own subdomain.
      </p>
      <div className="flex gap-3">
        <Link href="/signup"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          Start free trial
        </Link>
        <Link href="/sign-in"
          className="rounded-md border border-border px-5 py-2.5 text-sm font-medium">
          Sign in
        </Link>
      </div>
      <div className="mt-8 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-3">
        {[["Starter", "375", "Records, attendance, report cards & announcements"],
          ["Standard", "975", "Everything in Starter + timetable, homework, fees (MoMo) & SMS"],
          ["Premium", "2,000", "Everything + admissions, library, transport, HR & analytics"]].map(([n, p, d]) => (
          <div key={n} className="rounded-lg border border-border bg-card p-5 text-left">
            <p className="font-semibold">{n}</p>
            <p className="mt-1 text-2xl font-semibold">GHS {p}<span className="text-sm font-normal text-muted-foreground">/term</span></p>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
