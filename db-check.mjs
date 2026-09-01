import postgres from "postgres";
import { readFileSync } from "fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = readFileSync(".env", "utf8").match(/DATABASE_URL=(.*)/)[1].trim();
const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("MIGRATIONS APPLIED OK");
} catch (e) {
  console.error("REAL ERROR:", e.message);
}
process.exit(0);