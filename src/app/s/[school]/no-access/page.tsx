import Link from "next/link";
import { Lock } from "lucide-react";
import { requireSchool } from "@/core/school-context";
import { getFullAdmins, TAB_KEYS } from "@/core/access";
import { Card } from "@/ui/kit";

/** Where a limited member lands when they open a tab they weren't granted.
 *  Never a dead end: it names exactly who can open the door. */
export default async function NoAccess({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { school: slug } = await params;
  const { t } = await searchParams;
  const { school } = await requireSchool(slug);
  const admins = await getFullAdmins(school.id);
  const label = TAB_KEYS.find((k) => k.key === t)?.label ?? "that section";

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-primary">
          <Lock size={20} />
        </span>
        <h1 className="mt-3 text-lg font-semibold">You don&apos;t have access to {label}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your account covers only the sections you&apos;ve been granted.
          {admins.length > 0 && (
            <> To work in {label}, ask{" "}
              <b className="text-foreground">{admins.map((a) => a.name).join(" or ")}</b>{" "}
              to grant it under Settings → Team &amp; access.</>
          )}
        </p>
        <Link href="/" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-strong">
          Back to your dashboard
        </Link>
      </Card>
    </div>
  );
}
