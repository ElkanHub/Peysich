import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./auth";

/** Request-deduped session lookup for server components/actions. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"] & {
  role: string;
  schoolId?: string | null;
};
