import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

/** The sign-up page is a client component, so its search metadata lives here. */
export const metadata: Metadata = pageMeta({
  title: "Start your free trial",
  description: "Create your school on SchoolSpec in two minutes: your name, your school's name, and you are in. 14 days free, no card, cancel any time. Attendance, report cards, fees and parent SMS for basic schools in Ghana.",
  path: "/signup",
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
