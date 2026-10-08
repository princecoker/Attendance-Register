import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchReportSessions,
  reportCsv,
  reportFilename,
  type ReportSession,
} from "../lib/reports";
const record: ReportSession = {
  id: "one",
  school: { name: 'School "A"' },
  date: "2026-10-08",
  week: 2,
  arrivalTime: "09:00",
  departureTime: null,
  topic: "Fractions, decimals\nand practice",
  attendance: [
    {
      participant: { name: ' =HYPERLINK("evil")' },
      status: "PRESENT",
      arrivalTime: "09:00",
      departureTime: null,
    },
  ],
};
test("CSV quotes text and neutralizes spreadsheet formulas without losing requested fields", () => {
  const csv = reportCsv([record]);
  assert(csv.includes('"School ""A"""'));
  assert(csv.includes('"Fractions, decimals\nand practice"'));
  assert(csv.includes('"\' =HYPERLINK(""evil"")"'));
  assert(csv.includes('"2026-10-08","2","09:00",""'));
  assert(csv.includes('"PRESENT"'));
});
test("report export fetches all pages using the same school/date/week filters", async () => {
  const requests: URL[] = [];
  const fetcher = (async (input) => {
    const url = new URL(String(input), "http://localhost");
    requests.push(url);
    const first = url.searchParams.get("page") === "1";
    return Response.json({
      sessions: first
        ? Array.from({ length: 50 }, (_, i) => ({ ...record, id: String(i) }))
        : [{ ...record, id: "50" }],
      total: 51,
    });
  }) as typeof fetch;
  const sessions = await fetchReportSessions(
    { schoolId: "selected-school", week: "2", date: "2026-10-08" },
    fetcher,
  );
  assert.equal(sessions.length, 51);
  assert.equal(requests.length, 2);
  for (const r of requests) {
    assert.equal(r.searchParams.get("schoolId"), "selected-school");
    assert.equal(r.searchParams.get("week"), "2");
    assert.equal(r.searchParams.get("date"), "2026-10-08");
  }
});
test("failed pages stop report generation rather than exporting partial records", async () => {
  await assert.rejects(
    () =>
      fetchReportSessions({ schoolId: "", week: "", date: "" }, (async () =>
        Response.json(
          { error: "Sign in required" },
          { status: 401 },
        )) as typeof fetch),
    /Sign in required/,
  );
});
test("school report filenames identify filters and remove unsafe path characters", () => {
  assert.equal(
    reportFilename(
      "École / Lagos",
      { schoolId: "id", week: "2", date: "2026-10-08" },
      "2026-10-09",
    ),
    "attendance-Ecole-Lagos-week-2-2026-10-08",
  );
});
