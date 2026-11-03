import { createHash } from "node:crypto";

export interface RemoteFile {
  url: string;
  webp: boolean;
}

interface Registry {
  files: Map<string, RemoteFile>;
  pathPrefix: string;
}

const key = Symbol.for("astro-integrations.remote-files");
const shared = globalThis as unknown as Record<symbol, Registry | undefined>;
const registry = (shared[key] ??= {
  files: new Map<string, RemoteFile>(),
  pathPrefix: "/files",
});
export const remoteFiles: Map<string, RemoteFile> = registry.files;

export function setPathPrefix(pathPrefix: string): void {
  const normalized = pathPrefix.replace(/\/+$/, "") || "/";
  if (
    !normalized.startsWith("/") ||
    normalized.includes("?") ||
    normalized.includes("#") ||
    new URL(normalized, "https://example.invalid").pathname !== normalized
  ) {
    throw new Error("pathPrefix must be an absolute URL path");
  }
  if (normalized !== registry.pathPrefix) remoteFiles.clear();
  registry.pathPrefix = normalized;
}

export function resolveFile(
  url: string,
  { webp = false }: { webp?: boolean } = {},
): string {
  if (!/^https?:\/\//i.test(url)) return url;

  const filename = decodeURIComponent(
    new URL(url).pathname.split("/").pop() ?? "file",
  ).replace(/[^a-zA-Z0-9._-]/g, "-");
  const dot = filename.lastIndexOf(".");
  const name = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = webp ? ".webp" : dot > 0 ? filename.slice(dot) : "";
  const hash = createHash("sha256")
    .update(`${String(webp)}:${url}`)
    .digest("hex");
  const pathname = `${registry.pathPrefix === "/" ? "" : registry.pathPrefix}/${name}-${hash}${extension}`;

  remoteFiles.set(pathname, { url, webp });
  return pathname;
}
