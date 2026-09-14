import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const siteId = new URL(request.url).searchParams.get("site_id");
  const geracoes = await prisma.geracaoDeConteudo.findMany({ where: siteId ? { siteId } : undefined, include: { site: { select: { id: true, nome: true } } }, orderBy: { criadoEm: "desc" }, take: 50 });
  return NextResponse.json(geracoes);
}
