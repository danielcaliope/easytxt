import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const siteId = params.get("site_id");
  const q = params.get("q")?.trim();

  const geracoes = await prisma.geracaoDeConteudo.findMany({
    where: {
      ...(siteId ? { siteId } : {}),
      ...(q ? { OR: [{ textoOtimizado: { contains: q, mode: "insensitive" } }, { metaTitle: { contains: q, mode: "insensitive" } }, { textoOriginal: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: { site: { select: { id: true, nome: true } }, user: { select: { id: true, nome: true } } },
    orderBy: { criadoEm: "desc" },
    take: 100,
  });
  return NextResponse.json(geracoes);
}
