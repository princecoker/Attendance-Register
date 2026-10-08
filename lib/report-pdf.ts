import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportFilters, ReportSession } from "./reports";
export async function reportPdf(
  sessions: ReportSession[],
  schoolName: string | undefined,
  filters: ReportFilters,
  generatedDate: string,
) {
  const fontResponse = await fetch("/fonts/DejaVuSans.ttf");
  if (!fontResponse.ok)
    throw new Error("Could not load the report font. Please try again.");
  const bytes = new Uint8Array(await fontResponse.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    putOnlyUsedFonts: true,
  });
  doc.addFileToVFS("DejaVuSans.ttf", btoa(binary));
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.setFont("DejaVu");
  doc.setProperties({
    title: "Attendance & Class Report",
    author: "ClassLedger",
    subject: schoolName || "All schools",
  });
  doc.setFontSize(10);
  const schoolLines: string[] = doc.splitTextToSize(
    `School: ${schoolName || "All schools"}`,
    267,
  );
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0 };
  for (const s of sessions)
    for (const a of s.attendance)
      if (a.status in counts) counts[a.status as keyof typeof counts]++;
  const tableTop = 43 + schoolLines.length * 5;
  autoTable(doc, {
    startY: tableTop,
    margin: { top: tableTop, bottom: 18, left: 15, right: 15 },
    head: [
      [
        "School",
        "Date",
        "Week",
        "Session time",
        "Topic taught",
        "Participant",
        "Status",
        "Participant time",
      ],
    ],
    body: sessions.flatMap((s) =>
      s.attendance.map((a) => [
        s.school.name,
        s.date.slice(0, 10),
        String(s.week),
        `${s.arrivalTime} - ${s.departureTime || "Open"}`,
        s.topic,
        a.participant.name,
        a.status,
        `${a.arrivalTime || "—"} - ${a.departureTime || "—"}`,
      ]),
    ),
    styles: {
      font: "DejaVu",
      fontStyle: "normal",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [8, 116, 67],
      textColor: [255, 255, 255],
      fontStyle: "normal",
    },
    alternateRowStyles: { fillColor: [245, 247, 246] },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 24 },
      2: { cellWidth: 13 },
      3: { cellWidth: 28 },
      4: { cellWidth: 62 },
      5: { cellWidth: 39 },
      6: { cellWidth: 22 },
      7: { cellWidth: 43 },
    },
    didDrawPage: () => {
      doc.setFont("DejaVu");
      doc.setTextColor(8, 116, 67);
      doc.setFontSize(17);
      doc.text("Attendance & Class Report", 15, 16);
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(10);
      doc.text(schoolLines, 15, 25);
      const y = 25 + schoolLines.length * 5;
      doc.setFontSize(9);
      doc.text(
        `Week: ${filters.week || "All weeks"}   |   Date: ${filters.date || "All dates"}   |   Generated: ${generatedDate} (Lagos)`,
        15,
        y,
      );
      doc.text(
        `${sessions.length} sessions   |   ${counts.PRESENT} present   |   ${counts.LATE} late   |   ${counts.ABSENT} absent`,
        15,
        y + 6,
      );
      doc.setDrawColor(244, 197, 66);
      doc.line(15, y + 10, 282, y + 10);
    },
  });
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("ClassLedger · Attendance & learning · Africa/Lagos", 15, 202);
    doc.text(`Page ${page} of ${pageCount}`, 282, 202, { align: "right" });
  }
  return doc;
}
