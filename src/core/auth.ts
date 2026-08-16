import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}; // Google button hidden until creds exist (HANDOFF.md)

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  socialProviders: google,
  // username plugin: school-issued logins for students/parents without email
  plugins: [username()],
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "parent", input: false },
      schoolId: { type: "string", required: false, input: false },
      phone: { type: "string", required: false },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 60 }, // avoids a DB hit per request
  },
  advanced: {
    // One session cookie across all *.peysich.com subdomains (production only —
    // browsers reject Domain=.localhost, so dev uses host-only cookies).
    crossSubDomainCookies: process.env.NODE_ENV === "production" &&
      !process.env.NEXT_PUBLIC_ROOT_DOMAIN?.includes("localhost")
      ? { enabled: true, domain: "." + process.env.NEXT_PUBLIC_ROOT_DOMAIN!.split(":")[0] }
      : { enabled: false },
  },
  trustedOrigins: [
    `http://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000"}`,
    `http://*.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000"}`,
    `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ""}`,
    `https://*.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ""}`,
  ],
});

export type Session = typeof auth.$Infer.Session;
