import { PathRegistry } from "../lib/registry";

export interface TypstFile {
  source: string;
}

class TypstFileRegistry extends PathRegistry<TypstFile> {
  constructor() {
    super("typst-files", undefined);
  }

  protected validate(pathname: string, file: TypstFile): void {
    if (!pathname.endsWith(".pdf")) {
      throw new Error("Typst output must be a .pdf URL path");
    }
    const existing = this.get(pathname);
    if (existing && existing.source !== file.source) {
      throw new Error(`Multiple Typst sources map to ${pathname}`);
    }
  }

  add(source: string): string {
    return this.register(`/_typst/${this.hash(Buffer.from(source))}.pdf`, {
      source,
    });
  }
}

export const typstFiles = new TypstFileRegistry();

/** Register a Typst source and return its generated PDF URL. */
export function registerTypstFile(source: string): string {
  return typstFiles.add(source);
}
