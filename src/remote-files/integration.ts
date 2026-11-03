import type { IncomingMessage, ServerResponse } from "node:http";
import type { AstroIntegration } from "astro";
import sharp from "sharp";
import { remoteFiles, setPathPrefix, type RemoteFile } from "./registry";

export interface RemoteFilesOptions {
  userAgent: string;
  pathPrefix?: string;
}

async function load(file: RemoteFile, userAgent: string) {
  const response = await fetch(file.url, {
    headers: { "User-Agent": userAgent },
  });
  const body = Buffer.from(await response.arrayBuffer());
  return {
    response,
    body:
      response.ok && file.webp
        ? await sharp(body, { animated: true }).webp().toBuffer()
        : body,
  };
}

function clearRemoteFiles(): void {
  remoteFiles.clear();
}

async function serveRemoteFile(
  request: IncomingMessage,
  response: ServerResponse,
  userAgent: string,
): Promise<boolean> {
  const file = remoteFiles.getRequest(request.url);
  if (!file) return false;

  const { response: remote, body } = await load(file, userAgent);
  response.statusCode = remote.status;
  response.setHeader(
    "Content-Type",
    remote.ok && file.webp
      ? "image/webp"
      : (remote.headers.get("content-type") ?? "application/octet-stream"),
  );
  response.end(body);
  return true;
}

async function downloadRemoteFile(
  pathname: string,
  file: RemoteFile,
  dir: URL,
  userAgent: string,
): Promise<void> {
  const { response, body } = await load(file, userAgent);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${file.url}: ${String(response.status)} ${response.statusText}`,
    );
  }

  await remoteFiles.write(pathname, dir, body);
}

export default function downloadRemoteFiles({
  userAgent,
  pathPrefix = "/files",
}: RemoteFilesOptions): AstroIntegration {
  if (!userAgent) throw new Error("downloadRemoteFiles requires a userAgent");
  setPathPrefix(pathPrefix);

  return {
    name: "download-remote-files",
    hooks: {
      "astro:config:done": clearRemoteFiles,
      "astro:server:setup": ({ server }) => {
        server.middlewares.use((request, response, next) => {
          void serveRemoteFile(request, response, userAgent)
            .then((handled) => {
              if (!handled) next();
            })
            .catch(next);
        });
      },
      "astro:build:done": async ({ dir, logger }) => {
        await Promise.all(
          [...remoteFiles].map(async ([pathname, file]) => {
            await downloadRemoteFile(pathname, file, dir, userAgent);
            logger.info(`Downloaded ${file.url}`);
          }),
        );
      },
    },
  };
}
