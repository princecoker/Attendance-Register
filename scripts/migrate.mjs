import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import {
  assertDatabaseConfigured,
  databaseErrorMessage,
  databaseErrorCode,
} from "../lib/database-errors.ts";
assertDatabaseConfigured(process.env.DATABASE_URL);
assertDatabaseConfigured(process.env.DIRECT_URL || process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
  statement_timeout: 60000,
});
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(73901825)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  for (const name of (
    await readdir(new URL("../database/migrations/", import.meta.url))
  )
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const exists = await client.query(
      "SELECT name FROM schema_migrations WHERE name=$1",
      [name],
    );
    if (exists.rowCount) continue;
    await client.query(
      await readFile(
        new URL("../database/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
    await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
      name,
    ]);
    console.log("Applied " + name);
  }
  await client.query("COMMIT");
  console.log("Database is up to date");
} catch (error) {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Migration failed:",
    databaseErrorMessage(error),
    "Code:",
    databaseErrorCode(error),
  );
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
