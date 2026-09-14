import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getSiteId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return id;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await getSiteId(context);
  const site = await prisma.site.findUnique({ where: { id }, include: { geracoes: { orderBy: { criadoEm: "desc" }, take: 10 } } });
  if (!site) return NextResponse.json({ error: "Site não encontrado" }, { status: 404 });
  return NextResponse.json(site);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = await getSiteId(context);
    const body = await request.json();
    const site = await prisma.site.update({
      where: { id },
      data: {
        nome: typeof body.nome === "string" ? body.nome.trim() : undefined,
        url: typeof body.url === "string" ? body.url.trim().replace(/^https?:\/\//, "").replace(/\/$/, "") : undefined,
        nicho: typeof body.nicho === "string" ? body.nicho : undefined,
        publicoAlvo: typeof body.publicoAlvo === "string" ? body.publicoAlvo : undefined,
        tomDeVoz: typeof body.tomDeVoz === "string" ? body.tomDeVoz : undefined,
        palavrasChaveBase: Array.isArray(body.palavrasChaveBase) ? body.palavrasChaveBase : undefined,
        notasDeEstilo: typeof body.notasDeEstilo === "string" ? body.notasDeEstilo : undefined,
      },
    });
    return NextResponse.json(site);
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o site" }, { status: 500 });
  }
}
