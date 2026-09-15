import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateJsonText, getAiConfig } from "@/lib/ai-provider";
import { compressImage, type OptimizedImage } from "@/lib/image-optimizer";

const GENERATION_PROMPT = `Você é um redator especializado em SEO e GEO (Generative Engine Optimization) para e-commerce. Escreva para o site "{{nome}}" ({{url}}), no nicho de {{nicho}}, para {{publico}}. O tom de voz é: {{tom}}. Notas de estilo: {{notas}}. Palavras-chave centrais: {{keywords}}.

Reescreva o texto aplicando uso natural de palavras-chave, resposta direta no início, informação concreta e estrutura fácil de citar por engines de IA. Preserve o sentido original e o público. Para cada imagem anexada, gere um alt text descritivo e contextual.

Formate "texto_otimizado" em Markdown: use "##"/"###" para títulos, "**texto**" para negrito, "*texto*" para itálico e "-" para listas, sempre que isso ajudar a organizar o conteúdo. Preserve qualquer formatação (negrito, itálico, títulos, listas) presente no texto original.

Responda apenas com JSON neste formato: {"texto_otimizado":"","meta_title":"","meta_description":"","palavras_chave_usadas":[],"palavras_chave_sugeridas":[],"alt_texts":[]}`;

type GenerationResult = { texto_otimizado: string; meta_title: string; meta_description: string; palavras_chave_usadas: string[]; palavras_chave_sugeridas: string[]; alt_texts: string[] };

function parseResult(raw: string): GenerationResult {
  const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim()) as Partial<GenerationResult>;
  return {
    // Alguns modelos (ex. Groq) escapam a quebra de linha duas vezes, deixando "\n" literal no texto.
    texto_otimizado: typeof parsed.texto_otimizado === "string" ? parsed.texto_otimizado.replace(/\\n/g, "\n") : "",
    meta_title: typeof parsed.meta_title === "string" ? parsed.meta_title : "",
    meta_description: typeof parsed.meta_description === "string" ? parsed.meta_description : "",
    palavras_chave_usadas: Array.isArray(parsed.palavras_chave_usadas) ? parsed.palavras_chave_usadas.filter((item): item is string => typeof item === "string") : [],
    palavras_chave_sugeridas: Array.isArray(parsed.palavras_chave_sugeridas) ? parsed.palavras_chave_sugeridas.filter((item): item is string => typeof item === "string") : [],
    alt_texts: Array.isArray(parsed.alt_texts) ? parsed.alt_texts.filter((item): item is string => typeof item === "string") : [],
  };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const siteId = String(form.get("site_id") ?? "");
    const textoOriginal = String(form.get("texto") ?? "").trim();
    if (!siteId || !textoOriginal) return NextResponse.json({ error: "site_id e texto são obrigatórios" }, { status: 400 });

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) return NextResponse.json({ error: "Site não encontrado" }, { status: 404 });
    const systemPrompt = GENERATION_PROMPT.replace("{{nome}}", site.nome).replace("{{url}}", site.url).replace("{{nicho}}", site.nicho).replace("{{publico}}", site.publicoAlvo).replace("{{tom}}", site.tomDeVoz).replace("{{notas}}", site.notasDeEstilo).replace("{{keywords}}", site.palavrasChaveBase.join(", "));

    const images: { mimeType: string; data: string }[] = [];
    const optimizedImages: OptimizedImage[] = [];
    const imageFiles = form.getAll("imagens").filter((value): value is File => value instanceof File && value.size > 0);
    for (const image of imageFiles.slice(0, 5)) {
      if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(image.type)) continue;
      const buffer = Buffer.from(await image.arrayBuffer());
      images.push({ mimeType: image.type, data: buffer.toString("base64") });
      try {
        optimizedImages.push(await compressImage(buffer, image.name || "imagem"));
      } catch {
        // Uma falha ao comprimir não deve impedir a geração do restante do conteúdo.
      }
    }

    const currentUser = await getCurrentUser();
    const config = await getAiConfig();
    const userText = `Texto original:\n${textoOriginal}`;
    let raw: string;
    let sawImages = images.length > 0;
    try {
      raw = await generateJsonText(config, { systemPrompt, userText, images, maxOutputTokens: 6_000 });
    } catch (error) {
      // Nem todo modelo aceita imagens (ex. modelos só-texto na Groq). Se falhar com imagens
      // anexadas, tenta de novo sem elas — o texto e a compressão de imagem não dependem disso.
      if (images.length === 0) throw error;
      sawImages = false;
      raw = await generateJsonText(config, { systemPrompt, userText, images: [], maxOutputTokens: 6_000 });
    }
    const result = parseResult(raw);
    // Sem ter visto a imagem de verdade, qualquer alt text seria um chute genérico — melhor
    // deixar em branco do que publicar uma descrição inventada.
    if (!sawImages) result.alt_texts = [];
    const saved = await prisma.geracaoDeConteudo.create({ data: { siteId, userId: currentUser?.id, textoOriginal, textoOtimizado: result.texto_otimizado, metaTitle: result.meta_title, metaDescription: result.meta_description, palavrasChaveUsadas: result.palavras_chave_usadas, palavrasChaveSugeridas: result.palavras_chave_sugeridas, altTexts: result.alt_texts } });
    return NextResponse.json({ ...result, id: saved.id, criado_em: saved.criadoEm, imagens_otimizadas: optimizedImages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível gerar o conteúdo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
