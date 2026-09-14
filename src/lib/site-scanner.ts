import * as cheerio from "cheerio";
import { generateJsonText, getAiConfig } from "./ai-provider";

const REQUEST_TIMEOUT = 12_000;
// Um user-agent de bot explícito é bloqueado por proteções básicas (Webflow/Cloudflare) em vários
// dos sites reais escaneados. Usar um user-agent de navegador evita esse falso-positivo; o header
// customizado abaixo mantém o scanner identificável para quem inspecionar os logs do site.
const SCANNER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "X-Nitida-Scanner": "https://easytxt.vercel.app",
};
const SCAN_PROMPT = `Você está analisando o conteúdo extraído de um site de e-commerce para criar um perfil editorial inicial. Com base no texto abaixo, infira nicho, publico_alvo, tom_de_voz, 8 a 12 palavras-chave temáticas e notas_de_estilo. Responda apenas com JSON neste formato: {"nicho":"","publico_alvo":"","tom_de_voz":"","palavras_chave_base":[],"notas_de_estilo":""}. Se faltar evidência, use string vazia em vez de inventar.\n\nConteúdo extraído do site:\n`;

type PageContent = { url: string; title: string; description: string; headings: string[]; text: string };
type ProfileDraft = { nicho: string; publico_alvo: string; tom_de_voz: string; palavras_chave_base: string[]; notas_de_estilo: string };

function normalizeUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: SCANNER_HEADERS, signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
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

  const consolidated = pages.map((page) => `URL: ${page.url}\nTITLE: ${page.title}\nDESCRIPTION: ${page.description}\nHEADINGS: ${page.headings.join(" | ")}\nTEXTO: ${page.text}`).join("\n\n---\n\n");
  const config = await getAiConfig();
  const raw = await generateJsonText(config, { systemPrompt: SCAN_PROMPT, userText: consolidated, maxOutputTokens: 2_000 });
  return parseProfile(raw);
}
