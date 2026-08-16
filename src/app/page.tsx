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
      <Link
        href="/sign-in"
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Sign in
      </Link>
    </main>
  );
}
