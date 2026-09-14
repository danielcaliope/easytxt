import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const configuredPassword = process.env.APP_PASSWORD;
  if (!configuredPassword) {
    return NextResponse.json({ error: "APP_PASSWORD não configurada" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.password !== configuredPassword) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("seo_geo_session", "authenticated", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  });
  return response;
}
