import satori from "satori";
import sharp from "sharp";
import { images, registerImage, type ImageFormat } from "./registry";

export interface GenerateImageOptions {
  template: Parameters<typeof satori>[0];
  width: number;
  height: number;
  format?: ImageFormat;
}

/** Render a Satori template and return the registered image URL. */
export async function generateImage({
  template,
  width,
  height,
  format = "webp",
}: GenerateImageOptions): Promise<string> {
  const svg = await satori(template, { ...images.render, width, height });
  const image = await sharp(Buffer.from(svg))
    .resize(width, height)
    .toFormat(format)
    .toBuffer();
  return registerImage(image, format);
}
