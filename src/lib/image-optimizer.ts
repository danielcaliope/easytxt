import sharp from "sharp";

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;

export type OptimizedImage = { nome: string; tipo: string; tamanhoOriginal: number; tamanhoOtimizado: number; dataUrl: string };

export async function compressImage(buffer: Buffer, originalName: string): Promise<OptimizedImage> {
  const optimized = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const nome = originalName.replace(/\.[^.]+$/, "") + ".webp";
  return {
    nome,
    tipo: "image/webp",
    tamanhoOriginal: buffer.length,
    tamanhoOtimizado: optimized.length,
    dataUrl: `data:image/webp;base64,${optimized.toString("base64")}`,
  };
}
