import * as cheerio from "cheerio";
import { GEMINI_MODEL, getGeminiClient } from "./gemini";

const REQUEST_TIMEOUT = 12_000;
const SCAN_PROMPT = `Você está analisando o conteúdo extraído de um site de e-commerce para criar um perfil editorial inicial. Com base no texto abaixo, infira nicho, publico_alvo, tom_de_voz, 8 a 12 palavras-chave temáticas e notas_de_estilo. Responda apenas com JSON neste formato: {"nicho":"","publico_alvo":"","tom_de_voz":"","palavras_chave_base":[],"notas_de_estilo":""}. Se faltar evidência, use string vazia em vez de inventar.\n\nConteúdo extraído do site:\n`;

type PageContent = { url: string; title: string; description: string; headings: string[]; text: string };
type ProfileDraft = { nicho: string; publico_alvo: string; tom_de_voz: string; palavras_chave_base: string[]; notas_de_estilo: string };

function normalizeUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "NítidaSEO/1.0 (+site scan)" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!response.ok) throw new Error(`Fetch ${response.status}: ${url}`);
  return response.text();
}

function parseRobots(content: string) {
  const disallowed: string[] = [];
  let applies = false;
  for (const line of content.split(/\r?\n/)) {
    const [rawKey, rawValue] = line.split(":", 2);
    const key = rawKey?.trim().toLowerCase();
    const value = rawValue?.trim() ?? "";
    if (key === "user-agent") applies = value === "*";
    if (applies && key === "disallow" && value) disallowed.push(value);
  }
  return disallowed;
}

function isBlocked(url: URL, disallowed: string[]) {
  return disallowed.some((path) => path === "/" || url.pathname.startsWith(path));
}

function extractPage(url: string, html: string): PageContent {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header, svg, form").remove();
  const headings = $("h1, h2").map((_, element) => $(element).text().replace(/\s+/g, " ").trim()).get().filter(Boolean).slice(0, 20);
  const text = $("main, article, body").first().text().replace(/\s+/g, " ").trim().slice(0, 5_000);
  return { url, title: $("title").text().trim(), description: $("meta[name='description']").attr("content")?.trim() ?? "", headings, text };
}

async function sitemapUrls(origin: URL) {
  try {
    const xml = await fetchText(new URL("/sitemap.xml", origin).toString());
    return [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)].map((match) => match[1]).filter(Boolean).slice(0, 8);
  } catch {
    return [];
  }
}

function parseProfile(raw: string): ProfileDraft {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<ProfileDraft>;
  return {
    nicho: typeof parsed.nicho === "string" ? parsed.nicho : "",
    publico_alvo: typeof parsed.publico_alvo === "string" ? parsed.publico_alvo : "",
    tom_de_voz: typeof parsed.tom_de_voz === "string" ? parsed.tom_de_voz : "",
    palavras_chave_base: Array.isArray(parsed.palavras_chave_base) ? parsed.palavras_chave_base.filter((value): value is string => typeof value === "string").slice(0, 12) : [],
    notas_de_estilo: typeof parsed.notas_de_estilo === "string" ? parsed.notas_de_estilo : "",
  };
}

export async function scanSite(rawUrl: string) {
  const origin = new URL(normalizeUrl(rawUrl));
  const robots = await fetchText(new URL("/robots.txt", origin).toString()).catch(() => "");
  const disallowed = parseRobots(robots);
  if (isBlocked(origin, disallowed)) throw new Error("A homepage está bloqueada pelo robots.txt");

  const urls = [origin.toString(), ...(await sitemapUrls(origin)).filter((url) => url !== origin.toString())].slice(0, 5);
  const pages: PageContent[] = [];
  for (const candidate of urls) {
    const pageUrl = new URL(candidate, origin);
    if (pageUrl.origin !== origin.origin || isBlocked(pageUrl, disallowed)) continue;
    try { pages.push(extractPage(pageUrl.toString(), await fetchText(pageUrl.toString()))); } catch { /* Uma página indisponível não impede o restante do scan. */ }
  }
  if (!pages.length) throw new Error("Não foi possível extrair páginas do site");

  const client = getGeminiClient();
  const consolidated = pages.map((page) => `URL: ${page.url}\nTITLE: ${page.title}\nDESCRIPTION: ${page.description}\nHEADINGS: ${page.headings.join(" | ")}\nTEXTO: ${page.text}`).join("\n\n---\n\n");
  const response = await client.models.generateContent({ model: GEMINI_MODEL, contents: consolidated, config: { systemInstruction: SCAN_PROMPT, responseMimeType: "application/json", maxOutputTokens: 1200 } });
  return parseProfile(response.text ?? "{}");
}
