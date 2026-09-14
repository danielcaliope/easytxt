import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAiConfig, type AiProviderName } from "@/lib/ai-provider";

const VALID_PROVIDERS: AiProviderName[] = ["GEMINI", "OPENAI", "ANTHROPIC", "GROQ"];

function maskKey(key: string) {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (currentUser.role !== "ADMIN") return NextResponse.json({ error: "Apenas administradores podem ver a configuração de IA" }, { status: 403 });

  const config = await getAiConfig();
  return NextResponse.json({ provider: config.provider, model: config.model, apiKeyMasked: maskKey(config.apiKey), hasApiKey: Boolean(config.apiKey) });
}

export async function PUT(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (currentUser.role !== "ADMIN") return NextResponse.json({ error: "Apenas administradores podem alterar a configuração de IA" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const provider = VALID_PROVIDERS.includes(body.provider) ? (body.provider as AiProviderName) : null;
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!provider || !model) return NextResponse.json({ error: "Provedor e modelo são obrigatórios" }, { status: 400 });

  const existing = await prisma.aiSettings.findUnique({ where: { id: "singleton" } });
  const finalApiKey = apiKey || existing?.apiKey || "";
  if (!finalApiKey) return NextResponse.json({ error: "Informe a chave de API" }, { status: 400 });

  const settings = await prisma.aiSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", provider, model, apiKey: finalApiKey },
    update: { provider, model, apiKey: finalApiKey },
  });
  return NextResponse.json({ provider: settings.provider, model: settings.model, apiKeyMasked: maskKey(settings.apiKey), hasApiKey: true });
}
