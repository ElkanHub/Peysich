import type { Metadata } from "next";
import { SignInClient } from "./sign-in-client";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Sign in",
  description: "Sign in to your school on SchoolSpec — heads, teachers, parents and students, with the login your school gave you.",
  path: "/sign-in",
});

/** The door. The server knows whether Google is configured; the client
 *  knows which accounts this device has used before. */
export default function SignIn() {
  return <SignInClient google={!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}
