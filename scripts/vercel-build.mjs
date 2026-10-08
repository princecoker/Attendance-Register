import { spawnSync } from "node:child_process";
function run(script) {
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (process.env.VERCEL_ENV === "production") {
  console.log(
    "Applying versioned production database migrations before deployment",
  );
  run("db:deploy");
} else {
  console.log(
    "Skipping production migrations outside a production Vercel deployment",
  );
}
run("build");
