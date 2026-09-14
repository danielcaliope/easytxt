import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (!process.env.APP_PASSWORD) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/api/auth")) return NextResponse.next();
  if (request.cookies.get("seo_geo_session")?.value === "authenticated") return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
