import * as path from "node:path";
import type { Config } from "drizzle-kit";

const dbPath =
  process.env.VIBESTONKS_DB_PATH ?? path.resolve(process.cwd(), ".data/db.sqlite");

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: `file:${dbPath}` },
} satisfies Config;
