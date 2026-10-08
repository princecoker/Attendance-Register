import { z } from "zod";
import { NextResponse } from "next/server";
import { getSessions, createSession } from "@/lib/db";
import { databaseErrorCode, databaseErrorMessage } from "@/lib/database-errors";
import { authenticated, sameOrigin } from "@/lib/auth";
import { dateField, sessionSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!(await authenticated()))
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const week = p.get("week");
  const date = p.get("date");
  const schoolId = p.get("schoolId");
  const page = Number(p.get("page") || 1);
  if (
    (week && (!/^\d+$/.test(week) || Number(week) < 1 || Number(week) > 53)) ||
    (date && !dateField.safeParse(date).success) ||
    (schoolId && !z.string().uuid().safeParse(schoolId).success) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000000
  )
    return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
  try {
    return NextResponse.json(
      await getSessions(
        week ? Number(week) : undefined,
        date || undefined,
        page,
        schoolId || undefined,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Session query failed", databaseErrorCode(error));
    return NextResponse.json(
      {
        error: databaseErrorMessage(error),
      },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  if (!(await authenticated()))
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 1_000_000)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  try {
    return NextResponse.json(await createSession(parsed.data), { status: 201 });
  } catch (error) {
    console.error("Session creation failed", databaseErrorCode(error));
    return NextResponse.json(
      {
        error: databaseErrorMessage(error),
      },
      { status: 503 },
    );
  }
}
