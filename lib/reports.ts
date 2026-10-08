export type ReportSession = {
  id: string;
  date: string;
  week: number;
  arrivalTime: string;
  departureTime: string | null;
  topic: string;
  school: { name: string };
  attendance: {
    status: string;
    arrivalTime: string | null;
    departureTime: string | null;
    participant: { name: string };
  }[];
};
export type ReportFilters = { schoolId: string; week: string; date: string };
export function reportParams(filters: ReportFilters, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  for (const key of ["schoolId", "week", "date"] as const)
    if (filters[key]) params.set(key, filters[key]);
  return params;
}
export async function fetchReportSessions(
  filters: ReportFilters,
  fetcher: typeof fetch = fetch,
) {
  const sessions: ReportSession[] = [];
  let page = 1;
  let total = Infinity;
  while (sessions.length < total) {
    const response = await fetcher(
      "/api/sessions?" + reportParams(filters, page),
      { cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Could not load report records");
    if (
      !Array.isArray(data.sessions) ||
      !Number.isInteger(data.total) ||
      data.total < 0
    )
      throw new Error("Invalid report response");
    total = data.total;
    if (!data.sessions.length && sessions.length < total)
      throw new Error("Records changed during export. Please try again.");
    sessions.push(...data.sessions);
    page++;
  }
  return sessions;
}
function csvCell(value: unknown) {
  const s = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+@\-]|^[\t\r\n]/.test(s) ? "'" + s : s).replaceAll('"', '""') +
    '"'
  );
}
export function reportCsv(sessions: ReportSession[]) {
  return [
    [
      "School",
      "Date",
      "Week",
      "Session arrival",
      "Session departure",
      "Topic",
      "Participant",
      "Status",
      "Participant arrival",
      "Participant departure",
    ],
    ...sessions.flatMap((s) =>
      s.attendance.map((a) => [
        s.school.name,
        s.date.slice(0, 10),
        s.week,
        s.arrivalTime,
        s.departureTime,
        s.topic,
        a.participant.name,
        a.status,
        a.arrivalTime,
        a.departureTime,
      ]),
    ),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
export function reportFilename(
  schoolName: string | undefined,
  filters: ReportFilters,
  generatedDate: string,
) {
  const name =
    (schoolName || "all-schools")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[^\p{L}\p{N}-]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "school";
  return `attendance-${name}-${filters.week ? "week-" + filters.week : "all-weeks"}-${filters.date || generatedDate}`;
}
