import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, revokeSessionsOnPasswordReset: true },
  // username plugin: school-issued logins for students/parents without email.
  // Turnstile guards the doors once its keys exist (docs/CONNECTIONS.md §2):
  // the client sends the token in x-captcha-response, the plugin verifies it
  // before sign-in / sign-up / username sign-in run. No key = no gate (dev).
  plugins: [
    username(),
    ...(process.env.TURNSTILE_SECRET_KEY ? [captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.TURNSTILE_SECRET_KEY,
      endpoints: ["/sign-up/email", "/sign-in/email", "/sign-in/username", "/request-password-reset"],
    })] : []),
  ],
  // Brute force: per IP, in the database (serverless has no shared memory).
  // 60 auth calls a minute in general, 30 sign-in attempts a minute at the door.
  rateLimit: {
    storage: "database",
    window: 60, max: 60,
    // ponytail: 30 not 10 — a staff room behind one carrier NAT shares an IP at 7:30am
    customRules: { "/sign-in/*": { window: 60, max: 30 }, "/sign-up/*": { window: 60, max: 5 } },
  },
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
    // One session cookie across all *.schoolspec.com subdomains. Only for a real
    // owned domain: browsers reject Domain=.localhost, and vercel.app is on the
    // public-suffix list — both use host-only cookies (preview mode is single-host
    // anyway, so sessions work everywhere there).
    // Until NEXT_PUBLIC_ROOT_DOMAIN is set on the deployment the cookie stays
    // host-only rather than the build failing on an undefined domain.
    crossSubDomainCookies: process.env.NODE_ENV === "production" &&
      !!process.env.NEXT_PUBLIC_ROOT_DOMAIN &&
      !ROOT_DOMAIN.includes("localhost") &&
      !ROOT_DOMAIN.endsWith("vercel.app")
      ? { enabled: true, domain: "." + ROOT_DOMAIN.split(":")[0] }
      : { enabled: false },
  },
  trustedOrigins: [
    `http://${ROOT_DOMAIN}`,
    `http://*.${ROOT_DOMAIN}`,
    `https://${ROOT_DOMAIN}`,
    `https://*.${ROOT_DOMAIN}`,
  ],
});

export type Session = typeof auth.$Infer.Session;
