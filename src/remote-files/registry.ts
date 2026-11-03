import { PathRegistry } from "../lib/registry";

export interface RemoteFile {
  url: string;
  webp: boolean;
}

class RemoteFileRegistry extends PathRegistry<
  RemoteFile,
  { pathPrefix: string }
> {
  constructor() {
    super("remote-files", { pathPrefix: "/files" });
  }

  get pathPrefix(): string {
    return this.state.pathPrefix;
  }

  setPathPrefix(pathPrefix: string): void {
    const normalized = pathPrefix.replace(/\/+$/, "") || "/";
    RemoteFileRegistry.assertPath(normalized);
    if (normalized !== this.pathPrefix) this.clear();
    this.state.pathPrefix = normalized;
  }

  protected validate(pathname: string, file: RemoteFile): void {
    const prefix = this.pathPrefix === "/" ? "/" : `${this.pathPrefix}/`;
    if (!pathname.startsWith(prefix)) {
      throw new Error(`Remote file path must start with ${prefix}`);
    }
    const protocol = new URL(file.url).protocol;
    if (protocol !== "http:" && protocol !== "https:") {
      throw new Error("Remote file URL must use HTTP or HTTPS");
    }
  }

  resolve(url: string, { webp = false }: { webp?: boolean } = {}): string {
    if (!/^https?:\/\//i.test(url)) return url;

    const filename = decodeURIComponent(
      new URL(url).pathname.split("/").pop() ?? "file",
    ).replace(/[^a-zA-Z0-9._-]/g, "-");
    const dot = filename.lastIndexOf(".");
    const name = dot > 0 ? filename.slice(0, dot) : filename;
    const extension = webp ? ".webp" : dot > 0 ? filename.slice(dot) : "";
    const hash = this.hash(Buffer.from(`${String(webp)}:${url}`));
    const pathname = `${this.pathPrefix === "/" ? "" : this.pathPrefix}/${name}-${hash}${extension}`;

    return this.register(pathname, { url, webp });
  }
}

export const remoteFiles = new RemoteFileRegistry();

export function setPathPrefix(pathPrefix: string): void {
  remoteFiles.setPathPrefix(pathPrefix);
}

export function resolveFile(
  url: string,
  options: { webp?: boolean } = {},
): string {
  return remoteFiles.resolve(url, options);
}
