import { redirect } from "next/navigation";
/** Folded into the Schools hub (docs/12 §3.3). */
export default function Moved() { redirect("/platform/schools?tab=onboarding"); }
