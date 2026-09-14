import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { prisma } from "./prisma";

export type AiProviderName = "GEMINI" | "OPENAI" | "ANTHROPIC" | "GROQ";

export type AiConfig = { provider: AiProviderName; apiKey: string; model: string };

export const PROVIDER_LABELS: Record<AiProviderName, string> = {
  GEMINI: "Google Gemini",
  OPENAI: "OpenAI (ChatGPT)",
  ANTHROPIC: "Anthropic (Claude)",
  GROQ: "Groq (Llama e outros)",
};

export const PROVIDER_MODEL_HINTS: Record<AiProviderName, string> = {
  GEMINI: "ex. gemini-3.6-flash",
  OPENAI: "ex. gpt-4o-mini",
  ANTHROPIC: "ex. claude-sonnet-5",
  GROQ: "ex. llama-3.1-8b-instant",
};

const DEFAULT_CONFIG: AiConfig = {
  provider: "GEMINI",
  apiKey: process.env.GEMINI_API_KEY ?? "",
  model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
};

export async function getAiConfig(): Promise<AiConfig> {
  const settings = await prisma.aiSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) return DEFAULT_CONFIG;
  return { provider: settings.provider, apiKey: settings.apiKey, model: settings.model };
}

type ImageInput = { mimeType: string; data: string };

type GenerateParams = {
  systemPrompt?: string;
  userText: string;
  images?: ImageInput[];
  maxOutputTokens: number;
};

export async function generateJsonText(config: AiConfig, params: GenerateParams): Promise<string> {
  if (!config.apiKey) throw new Error(`Chave de API não configurada para ${PROVIDER_LABELS[config.provider]}`);
  if (config.provider === "GEMINI") return generateWithGemini(config, params);
  if (config.provider === "ANTHROPIC") return generateWithAnthropic(config, params);
  if (config.provider === "GROQ") return generateWithOpenAiCompatible(config, params, "https://api.groq.com/openai/v1");
  return generateWithOpenAiCompatible(config, params, undefined);
}

async function generateWithGemini(config: AiConfig, params: GenerateParams) {
  const client = new GoogleGenAI({ apiKey: config.apiKey });
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: params.userText }];
  for (const image of params.images ?? []) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  const response = await client.models.generateContent({
    model: config.model,
    contents: parts,
    config: {
      systemInstruction: params.systemPrompt,
      responseMimeType: "application/json",
      maxOutputTokens: params.maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return response.text ?? "{}";
}

async function generateWithOpenAiCompatible(config: AiConfig, params: GenerateParams, baseURL: string | undefined) {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL });
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: params.userText }];
  for (const image of params.images ?? []) content.push({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (params.systemPrompt) messages.push({ role: "system", content: params.systemPrompt });
  messages.push({ role: "user", content });

  const response = await client.chat.completions.create({
    model: config.model,
    messages,
    max_tokens: params.maxOutputTokens,
    response_format: { type: "json_object" },
  });
  return response.choices[0]?.message?.content ?? "{}";
}

async function generateWithAnthropic(config: AiConfig, params: GenerateParams) {
  const client = new Anthropic({ apiKey: config.apiKey });
  const content: Anthropic.MessageCreateParams["messages"][number]["content"] = [{ type: "text", text: params.userText }];
  for (const image of params.images ?? []) {
    if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(image.mimeType)) {
      content.push({ type: "image", source: { type: "base64", media_type: image.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: image.data } });
    }
  }
  const response = await client.messages.create({
    model: config.model,
    max_tokens: params.maxOutputTokens,
    system: params.systemPrompt,
    messages: [{ role: "user", content }],
  });
  const block = response.content.find((entry) => entry.type === "text");
  return block && "text" in block ? block.text : "{}";
}
