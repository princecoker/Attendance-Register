import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertDatabaseConfigured,
  databaseErrorMessage,
} from "../lib/database-errors";
test("missing database settings fail explicitly rather than falling back to localhost", () => {
  assert.throws(
    () => assertDatabaseConfigured(undefined),
    (e) => databaseErrorMessage(e).includes("set DATABASE_URL"),
  );
  for (const value of [
    "not-a-url",
    "https://example.com",
    "postgresql://USER:PASSWORD@HOST/database",
  ])
    assert.throws(
      () => assertDatabaseConfigured(value),
      (e) => databaseErrorMessage(e).includes("setting is invalid"),
    );
  assert.doesNotThrow(() =>
    assertDatabaseConfigured(
      "postgresql://attendance:password@localhost:5432/attendance",
    ),
  );
});
test("missing tables, credentials and DNS errors have different actionable messages", () => {
  assert.match(databaseErrorMessage({ code: "42P01" }), /migrations/);
  assert.match(databaseErrorMessage({ code: "28P01" }), /credentials/);
  assert.match(databaseErrorMessage({ code: "EAI_AGAIN" }), /network access/);
});
test("database error responses never echo sensitive driver messages", () => {
  const message = "postgresql://user:private-password@private-host/database";
  for (const code of ["42P01", "28P01", "EAI_AGAIN", "UNKNOWN"])
    assert(
      !databaseErrorMessage({ code, message }).includes("private-password"),
    );
});
