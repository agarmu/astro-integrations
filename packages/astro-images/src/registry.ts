import { PathRegistry } from "@agarmu/astro-core";
import type { SatoriOptions } from "satori";

type RenderOptions = Omit<SatoriOptions, "width" | "height">;

export type ImageFormat = "webp" | "png" | "jpeg" | "avif";

interface GeneratedImage {
  body: Uint8Array;
  format: ImageFormat;
}

class ImageRegistry extends PathRegistry<
  GeneratedImage,
  { pathPrefix: string; render?: RenderOptions }
> {
  constructor() {
    super("images", { pathPrefix: "/_images" });
  }

  configure(pathPrefix: string, render: RenderOptions): void {
    const normalized = pathPrefix.replace(/\/+$/, "") || "/";
    ImageRegistry.assertPath(normalized);
    if (normalized !== this.state.pathPrefix) this.clear();
    this.state.pathPrefix = normalized;
    this.state.render = render;
  }

  get render(): RenderOptions {
    if (!this.state.render) {
      throw new Error("Image integration has not been configured");
    }
    return this.state.render;
  }

  protected validate(pathname: string, image: GeneratedImage): void {
    const prefix =
      this.state.pathPrefix === "/" ? "/" : `${this.state.pathPrefix}/`;
    if (
      !pathname.startsWith(prefix) ||
      !pathname.endsWith(`.${image.format}`)
    ) {
      throw new Error(
        `Image path must start with ${prefix} and end in .${image.format}`,
      );
    }
  }

  add(body: Uint8Array, format: ImageFormat): string {
    const prefix = this.state.pathPrefix === "/" ? "" : this.state.pathPrefix;
    return this.register(`${prefix}/${this.hash(body)}.${format}`, {
      body,
      format,
    });
  }
}

export const images = new ImageRegistry();

export function registerImage(body: Uint8Array, format: ImageFormat): string {
  return images.add(body, format);
}
