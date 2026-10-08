export function databaseErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  )
    return error.code;
  return "UNKNOWN";
}
export function databaseErrorMessage(error: unknown): string {
  switch (databaseErrorCode(error)) {
    case "DATABASE_URL_MISSING":
      return "The database is not configured. An administrator needs to set DATABASE_URL in the hosting environment and redeploy.";
    case "DATABASE_URL_INVALID":
      return "The database connection setting is invalid. An administrator needs to check DATABASE_URL and redeploy.";
    case "42P01":
      return "The database tables have not been created. An administrator needs to apply the database migrations.";
    case "28P01":
    case "28000":
      return "Database authentication failed. An administrator needs to check the database credentials.";
    case "3D000":
      return "The configured database does not exist. An administrator needs to check the database name in DATABASE_URL.";
    case "EAI_AGAIN":
    case "ENOTFOUND":
      return "The database hostname could not be reached. An administrator needs to check the connection URL and network access.";
    default:
      return "The database is temporarily unavailable. Please retry or ask an administrator to check the database connection.";
  }
}
export function assertDatabaseConfigured(connectionString: string | undefined) {
  if (!connectionString)
    throw Object.assign(new Error("Database configuration is missing"), {
      code: "DATABASE_URL_MISSING",
    });
  try {
    const url = new URL(connectionString);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      ["HOST", "host"].includes(url.hostname)
    )
      throw new Error("Invalid connection setting");
  } catch {
    throw Object.assign(new Error("Database configuration is invalid"), {
      code: "DATABASE_URL_INVALID",
    });
  }
}
