import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (currentUser.role !== "ADMIN") return NextResponse.json({ error: "Apenas administradores podem ver os usuários" }, { status: 403 });

  const users = await prisma.user.findMany({ orderBy: { criadoEm: "asc" }, select: { id: true, nome: true, email: true, role: true, criadoEm: true } });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (currentUser.role !== "ADMIN") return NextResponse.json({ error: "Apenas administradores podem criar usuários" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  const role = body.role === "ADMIN" ? "ADMIN" : "MEMBRO";
  if (!nome || !email || !senha) return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios" }, { status: 400 });
  if (senha.length < 6) return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });

  try {
    const user = await prisma.user.create({ data: { nome, email, senhaHash: await hashPassword(senha), role }, select: { id: true, nome: true, email: true, role: true, criadoEm: true } });
    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Já existe um usuário com esse e-mail" }, { status: 409 });
  }
}
