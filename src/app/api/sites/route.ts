import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sites = await prisma.site.findMany({ orderBy: { criadoEm: "desc" } });
    return NextResponse.json(sites);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar os sites";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!nome || !url) {
      return NextResponse.json({ error: "nome e url são obrigatórios" }, { status: 400 });
    }

    const site = await prisma.site.create({
      data: {
        nome,
        url: url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        nicho: body.nicho ?? "",
        publicoAlvo: body.publicoAlvo ?? "",
        tomDeVoz: body.tomDeVoz ?? "",
        palavrasChaveBase: Array.isArray(body.palavrasChaveBase) ? body.palavrasChaveBase : [],
        notasDeEstilo: body.notasDeEstilo ?? "",
      },
    });

    return NextResponse.json(site, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o site";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
