import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/api/auth")) return NextResponse.next();
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (user) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
