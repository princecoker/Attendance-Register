import assert from "node:assert/strict";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const school = "Smoke test École Ọmọ " + Date.now();
const otherSchool = school + " Other school";
let browser;
try {
  let r = await fetch(base + "/api/sessions");
  assert.equal(r.status, 401);
  r = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong-password" }),
  });
  assert.equal(r.status, 401);
  r = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  const headers = {
    Origin: base,
    Cookie: cookie,
    "Content-Type": "application/json",
  };
  const baseline = await (
    await fetch(base + "/api/sessions", { headers })
  ).json();
  const baselineEntries = baseline.stats.counts.reduce(
    (n, c) => n + c._count._all,
    0,
  );
  r = await fetch(base + "/api/sessions", {
    method: "POST",
    headers: { ...headers, Origin: "https://untrusted.example" },
    body: "{}",
  });
  assert.equal(r.status, 403);
  const record = {
    school,
    date: "2026-10-08",
    week: 2,
    arrivalTime: "09:00",
    departureTime: "11:00",
    topic: "Fractions and decimals",
    attendance: [
      {
        name: "Test Present",
        status: "PRESENT",
        arrivalTime: "09:00",
        departureTime: "11:00",
      },
      { name: "Test Absent", status: "ABSENT" },
      {
        name: "Test Late",
        status: "LATE",
        arrivalTime: "09:10",
        departureTime: "11:00",
      },
    ],
  };
  r = await fetch(base + "/api/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...record, departureTime: "08:00" }),
  });
  assert.equal(r.status, 400);
  r = await fetch(base + "/api/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify(record),
  });
  assert.equal(r.status, 201);
  const created = await r.json();
  assert.equal(created.attendance.length, 3);
  assert.equal(created.topic, record.topic);
  r = await fetch(base + "/api/sessions?week=2&date=2026-10-08", { headers });
  assert.equal(r.status, 200);
  const result = await r.json();
  assert(result.sessions.some((s) => s.id === created.id));
  assert.equal(
    result.stats.counts.reduce((n, c) => n + c._count._all, 0),
    baselineEntries + 3,
  );
  r = await fetch(base + "/api/sessions?week=3&date=2026-10-08", { headers });
  assert.equal((await r.json()).sessions.length, 0);
  r = await fetch(base + "/api/sessions?date=2026-02-30", { headers });
  assert.equal(r.status, 400);
  const fixture = await pool.query(
    `WITH added AS (
    INSERT INTO sessions(school_id,date,week,arrival_time,departure_time,topic)
    SELECT s.school_id,s.date,s.week,s.arrival_time,s.departure_time,'Pagination attendance'
    FROM sessions s CROSS JOIN generate_series(1,50) WHERE s.id=$1 RETURNING id
  ) INSERT INTO attendance(session_id,participant_id,status)
  SELECT added.id,a.participant_id,'PRESENT' FROM added CROSS JOIN attendance a
  WHERE a.session_id=$1 AND a.status='PRESENT'`,
    [created.id],
  );
  assert.equal(fixture.rowCount, 50);
  r = await fetch(base + "/api/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...record,
      school: otherSchool,
      topic: "Other school must be excluded",
    }),
  });
  assert.equal(r.status, 201);
  const all = await (await fetch(base + "/api/sessions", { headers })).json();
  const schoolId = all.schools.find((s) => s.name === school).id;
  r = await fetch(
    base + "/api/sessions?schoolId=" + schoolId + "&week=2&date=2026-10-08",
    { headers },
  );
  const filtered = await r.json();
  assert.equal(filtered.total, 51);
  assert.equal(filtered.sessions.length, 50);
  assert(filtered.sessions.every((s) => s.school.name === school));
  assert(all.schools.some((s) => s.name === otherSchool));
  r = await fetch(base + "/api/sessions?schoolId=not-a-uuid", { headers });
  assert.equal(r.status, 400);
  console.log(
    "PASS API: authentication, origin protection, validation, database persistence, statuses, statistics and filters",
  );
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/login");
  await page
    .getByLabel("Administrator password")
    .fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your classes, at a glance." })
    .waitFor();
  await page.getByText(school, { exact: true }).first().waitFor();
  await page.screenshot({
    path: "/tmp/attendance-dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Log session", exact: true })
    .first()
    .click();
  await page.getByLabel("Name of school").fill(school);
  await page.getByLabel("Topic taught").fill("Browser-tested session");
  await page
    .getByLabel("Participant 1", { exact: true })
    .fill("Browser participant");
  await page.getByRole("button", { name: "Clock in", exact: true }).click();
  assert.match(await page.locator("#arrival").inputValue(), /^\d{2}:\d{2}$/);
  await page.getByRole("button", { name: "Clock out", exact: true }).click();
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await page.getByText("Session and attendance saved successfully.").waitFor();
  await page
    .getByRole("button", { name: "History & reports", exact: true })
    .click();
  await page
    .getByLabel("Name of school", { exact: true })
    .selectOption({ label: school });
  await page.getByLabel("Academic week", { exact: true }).selectOption("2");
  await page.getByLabel("Session date", { exact: true }).fill("2026-10-08");
  await page
    .getByText("51 sessions matching your filters", { exact: true })
    .waitFor();
  assert.equal(await page.locator("tbody tr").count(), 50);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^attendance-/);
  await download.saveAs("/tmp/attendance-school-report.csv");
  const csv = await readFile("/tmp/attendance-school-report.csv", "utf8");
  assert(!csv.includes(otherSchool));
  assert(csv.includes(record.topic));
  assert.equal((csv.match(/Pagination attendance/g) || []).length, 50);
  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const pdfDownload = await pdfPromise;
  assert.match(pdfDownload.suggestedFilename(), /\.pdf$/);
  await pdfDownload.saveAs("/tmp/attendance-school-report.pdf");
  const pdf = await readFile("/tmp/attendance-school-report.pdf");
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const pdfText = execFileSync(
    "pdftotext",
    ["-layout", "/tmp/attendance-school-report.pdf", "-"],
    { encoding: "utf8" },
  );
  assert(pdfText.includes(school));
  assert(!pdfText.includes(otherSchool));
  assert(pdfText.includes(record.topic));
  assert(pdfText.includes("51 sessions"));
  assert.equal((pdfText.match(/Pagination attendance/g) || []).length, 50);
  assert(pdfText.includes("Page 2 of"));
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Name of school", { exact: true }).inputValue(),
    "",
  );
  await page.locator("tbody").getByText(otherSchool, { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Log session", exact: true })
    .first()
    .click();
  await page.screenshot({ path: "/tmp/attendance-mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: sign-in, dashboard, session form, clock buttons, saved attendance, history filters, school filtering, paginated CSV/PDF exports, mobile layout and sign-out",
  );
} finally {
  if (browser) await browser.close();
  await pool.query(
    "DELETE FROM sessions WHERE school_id IN (SELECT id FROM schools WHERE name=ANY($1::text[]))",
    [[school, otherSchool]],
  );
  await pool.query(
    "DELETE FROM participants WHERE school_id IN (SELECT id FROM schools WHERE name=ANY($1::text[]))",
    [[school, otherSchool]],
  );
  await pool.query("DELETE FROM schools WHERE name=ANY($1::text[])", [
    [school, otherSchool],
  ]);
  await pool.end();
}
