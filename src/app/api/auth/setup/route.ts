import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  const count = await prisma.user.count();
  if (count > 0) return NextResponse.json({ error: "Já existe um administrador configurado" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (!nome || !email || !senha) return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios" }, { status: 400 });
  if (senha.length < 6) return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });

  const user = await prisma.user.create({ data: { nome, email, senhaHash: await hashPassword(senha), role: "ADMIN" } });
  const session = await createSession(user.id);
  const response = NextResponse.json({ ok: true, nome: user.nome, role: user.role });
  response.cookies.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: session.expiresAt,
    path: "/",
  });
  return response;
}
