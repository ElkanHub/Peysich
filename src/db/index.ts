import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Single connection pool, reused across hot reloads in dev (video's prisma-client pattern).
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client = globalForDb.pg ?? postgres(process.env.DATABASE_URL!, {
  max: 5,
  // Neon's pooled endpoint runs pgbouncer in transaction mode, where named
  // prepared statements intermittently vanish ("prepared statement … does
  // not exist" → one failed request, retry works). Unnamed statements are
  // safe on both pooled and direct URLs.
  prepare: false,
  // a suspended Neon compute can take ~10s to wake — wait for it instead
  // of dying on the first request after a quiet spell
  connect_timeout: 30,
  idle_timeout: 30, // release serverless connections instead of hoarding them
});
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
