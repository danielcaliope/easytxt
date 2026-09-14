import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

async function requireAdmin() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  if (currentUser.role !== "ADMIN") return { error: NextResponse.json({ error: "Apenas administradores podem gerenciar usuários" }, { status: 403 }) };
  return { currentUser };
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await context.params;

  const body = await request.json().catch(() => ({}));
  const data: { nome?: string; role?: "ADMIN" | "MEMBRO"; senhaHash?: string } = {};
  if (typeof body.nome === "string" && body.nome.trim()) data.nome = body.nome.trim();
  if (body.role === "ADMIN" || body.role === "MEMBRO") data.role = body.role;
  if (typeof body.senha === "string" && body.senha) {
    if (body.senha.length < 6) return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
    data.senhaHash = await hashPassword(body.senha);
  }

  if (data.role === "MEMBRO") {
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) return NextResponse.json({ error: "Não é possível remover o último administrador" }, { status: 400 });
    }
  }

  try {
    const user = await prisma.user.update({ where: { id }, data, select: { id: true, nome: true, email: true, role: true, criadoEm: true } });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o usuário" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await context.params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return NextResponse.json({ error: "Não é possível remover o último administrador" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
