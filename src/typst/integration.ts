import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { typstFiles } from "./registry";

export interface TypstOptions {
  /** Font directories, resolved relative to the Astro project root. */
  fontPaths?: string[];
  /** Typst sys.inputs used for builds. */
  inputs?: Record<string, string>;
  /** Additional or overriding sys.inputs used during development. */
  devInputs?: Record<string, string>;
  /** Exact package specifiers mapped to Typst import paths within the workspace. */
  packageImports?: Record<string, string>;
}

class TypstRenderer {
  private root?: string;
  private compiler?: NodeCompiler;

  constructor(private readonly options: TypstOptions) {}

  setRoot(root: URL): void {
    this.root = fileURLToPath(root);
    this.compiler = undefined;
  }

  compile(source: string, dev: boolean): Buffer {
    const root = this.root;
    if (!root) throw new Error("Typst integration has not been configured");

    const compiler = (this.compiler ??= NodeCompiler.create({
      workspace: root,
      fontArgs: [
        {
          fontPaths: (this.options.fontPaths ?? []).map((path) =>
            resolve(root, path),
          ),
        },
      ],
    }));
    const file = resolve(root, source);

    try {
      let content = readFileSync(file, "utf8");
      for (const [specifier, path] of Object.entries(
        this.options.packageImports ?? {},
      )) {
        content = content.replaceAll(
          JSON.stringify(specifier),
          JSON.stringify(path),
        );
      }
      compiler.addSource(file, content);

      const inputs = dev
        ? { ...this.options.inputs, ...this.options.devInputs }
        : this.options.inputs;
      const result = compiler.compile({ mainFilePath: file, inputs });
      if (!result.result) {
        const error = result.takeDiagnostics();
        const diagnostics: unknown = error
          ? compiler.fetchDiagnostics(error)
          : [];
        throw new Error(
          `Typst diagnostics:\n${JSON.stringify(diagnostics, null, 2)}`,
          {
            cause: diagnostics,
          },
        );
      }
      return compiler.pdf(result.result);
    } catch (error) {
      throw new Error(`Failed to compile ${file}: ${String(error)}`, {
        cause: error,
      });
    } finally {
      compiler.unmapShadow(file);
      compiler.evictCache(10);
    }
  }
}

export default function typst(options: TypstOptions = {}): AstroIntegration {
  const renderer = new TypstRenderer(options);

  return {
    name: "compile-typst",
    hooks: {
      "astro:config:done": ({ config }) => {
        renderer.setRoot(config.root);
        typstFiles.clear();
      },
      "astro:build:done": async ({ dir, logger }) => {
        for (const [pathname, file] of typstFiles) {
          await typstFiles.write(
            pathname,
            dir,
            renderer.compile(file.source, false),
          );
          logger.info(`Compiled ${file.source}`);
        }
      },
      "astro:server:setup": ({ server }) => {
        server.middlewares.use((request, response, next) => {
          const file = typstFiles.getRequest(request.url);
          if (!file) {
            next();
            return;
          }

          try {
            response.setHeader("Content-Type", "application/pdf");
            response.setHeader("Cache-Control", "no-store");
            response.end(renderer.compile(file.source, true));
          } catch (error) {
            next(error instanceof Error ? error : new Error(String(error)));
          }
        });
      },
    },
  };
}
