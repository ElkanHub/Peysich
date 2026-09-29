import type { Metadata } from "next";
import { requireSchool } from "@/core/school-context";
import { forRole } from "@/help/steps";
import { HelpList } from "@/help/help-list";
import { PageHeader } from "@/ui/kit";

export const metadata: Metadata = { title: "How to do things" };

/** Every step for this person's role, top to bottom. The "Show me how"
 *  button on each page opens the same steps, filtered to that page. */
export default async function HelpPage({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { user } = await requireSchool(slug);
  const sections = forRole(user.role);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="How to do things"
        sub="Short steps, the exact words on the buttons, and why. On any page, the Show me how button at the top shows only that page's steps." />
      <HelpList sections={sections} />
    </div>
  );
}
