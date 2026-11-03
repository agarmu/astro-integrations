import type { AstroIntegration } from "astro";
import type { Font, SatoriOptions } from "satori";
import { images } from "./registry";

export interface ImageFontFamily {
  name: string;
  fonts: Omit<Font, "name">[];
}

export type ImagesOptions = Omit<
  SatoriOptions,
  "width" | "height" | "fonts"
> & {
  fonts: ImageFontFamily[];
  pathPrefix?: string;
};

export default function generateImages({
  pathPrefix = "/_images",
  fonts,
  ...render
}: ImagesOptions): AstroIntegration {
  images.configure(pathPrefix, {
    ...render,
    fonts: fonts.flatMap(({ name, fonts }) =>
      fonts.map((font) => ({ name, ...font })),
    ),
  });

  return {
    name: "generate-images",
    hooks: {
      "astro:config:done": () => {
        images.clear();
      },
      "astro:build:done": async ({ dir, logger }) => {
        const registered = [...images];
        await Promise.all(
          registered.map(([pathname, image]) =>
            images.write(pathname, dir, image.body),
          ),
        );
        if (registered.length) {
          logger.info(`Generated ${String(registered.length)} images`);
        }
      },
      "astro:server:setup": ({ server }) => {
        server.middlewares.use((request, response, next) => {
          const image = images.getRequest(request.url);
          if (!image) {
            next();
            return;
          }
          const contentType =
            image.format === "jpeg" ? "image/jpeg" : `image/${image.format}`;
          response.setHeader("Content-Type", contentType);
          response.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
          response.end(image.body);
        });
      },
    },
  };
}
