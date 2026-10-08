import { spawnSync } from "node:child_process";
const u = new URL(process.env.DATABASE_URL || "");
if (
  !["localhost", "127.0.0.1"].includes(u.hostname) ||
  u.username !== "attendance" ||
  u.pathname !== "/attendance" ||
  (u.port && u.port !== "5432") ||
  !u.password
)
  throw new Error(
    "Local Docker setup requires a localhost:5432 DATABASE_URL for user attendance and database attendance, with a password. Use your external provider directly for other configurations.",
  );
const result = spawnSync("docker", ["compose", "up", "-d", "--wait", "db"], {
  stdio: "inherit",
  env: { ...process.env, LOCAL_DB_PASSWORD: decodeURIComponent(u.password) },
});
process.exit(result.status ?? 1);
