import type { Metadata } from "next";
import { SignInClient } from "./sign-in-client";

export const metadata: Metadata = { title: "Sign in" };

/** The door. The server knows whether Google is configured; the client
 *  knows which accounts this device has used before. */
export default function SignIn() {
  return <SignInClient google={!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}
