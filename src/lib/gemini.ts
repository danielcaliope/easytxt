import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}
