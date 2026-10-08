import { NextResponse } from "next/server";
import { configured, equals, token, cookieName, sameOrigin } from "@/lib/auth";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  if (!configured())
    return NextResponse.json(
      {
        error:
          "Administrator access is not configured. Set ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters.",
      },
      { status: 503 },
    );
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (
    typeof body?.password !== "string" ||
    !equals(body.password, process.env.ADMIN_PASSWORD!)
  )
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, token(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 28800,
  });
  return response;
}
