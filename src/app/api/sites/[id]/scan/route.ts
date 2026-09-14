import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanSite } from "@/lib/site-scanner";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Site não encontrado" }, { status: 404 });

  try {
    const profile = await scanSite(site.url);
    const updated = await prisma.site.update({ where: { id }, data: { nicho: profile.nicho, publicoAlvo: profile.publico_alvo, tomDeVoz: profile.tom_de_voz, palavrasChaveBase: profile.palavras_chave_base, notasDeEstilo: profile.notas_de_estilo, statusScan: "CONCLUIDO", ultimoScanEm: new Date() } });
    return NextResponse.json(updated);
  } catch (error) {
    await prisma.site.update({ where: { id }, data: { statusScan: "ERRO", ultimoScanEm: new Date() } });
    const message = error instanceof Error ? error.message : "Falha desconhecida no scan";
    return NextResponse.json({ error: message, statusScan: "ERRO" }, { status: 502 });
  }
}
