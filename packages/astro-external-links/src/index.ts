import type { MiddlewareHandler } from "astro";
import { parse, serialize, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

export interface ExternalLinksOptions {
  /* don't add attributes to domains which match the whitelist */
  whitelist?: readonly RegExp[];
}

function matchesWhitelist(
  hostname: string,
  whitelist: readonly RegExp[],
): boolean {
  return whitelist.some((pattern) => {
    // Global and sticky patterns must not depend on the previous link checked.
    const flags = pattern.flags.replace(/[gy]/g, "");
    return new RegExp(pattern.source, flags).test(hostname);
  });
}

export function shouldBeModified(
  href: string,
  pageUrl: URL,
  whitelist: readonly RegExp[],
  siteOrigin = pageUrl.origin,
): boolean {
  let url: URL;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.origin === pageUrl.origin || url.origin === siteOrigin) return false;
  return !matchesWhitelist(url.hostname, whitelist);
}

function getAttribute(element: Element, name: string): string | undefined {
  return element.attrs.find((attribute) => attribute.name === name)?.value;
}

function setAttribute(element: Element, name: string, value: string): void {
  const attribute = element.attrs.find((attribute) => attribute.name === name);
  if (attribute) attribute.value = value;
  else element.attrs.push({ name, value });
}

function protectLink(
  node: Node,
  pageUrl: URL,
  siteOrigin: string,
  whitelist: readonly RegExp[],
): void {
  if (!("tagName" in node) || (node.tagName !== "a" && node.tagName !== "area"))
    return;

  const href = getAttribute(node, "href");
  if (!href) return;

  if (!shouldBeModified(href, pageUrl, whitelist, siteOrigin)) return;

  setAttribute(node, "target", "_blank");

  const tokens = new Set(
    (getAttribute(node, "rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  );
  tokens.delete("opener");
  tokens.add("noopener");
  tokens.add("noreferrer");
  setAttribute(node, "rel", [...tokens].join(" "));
}

export function protectExternalLinks(
  node: Node,
  pageUrl: URL,
  siteOrigin: string,
  { whitelist = [] }: ExternalLinksOptions = {},
): void {
  function visit(current: Node): void {
    protectLink(current, pageUrl, siteOrigin, whitelist);
    if ("childNodes" in current) current.childNodes.forEach(visit);
    if (
      "tagName" in current &&
      current.tagName === "template" &&
      "content" in current
    ) {
      visit(current.content);
    }
  }

  visit(node);
}

export default function externalLinks(
  options: ExternalLinksOptions = {},
): MiddlewareHandler {
  return async (context, next) => {
    const response = await next();
    if (!response.headers.get("content-type")?.includes("text/html")) {
      return response;
    }

    const document = parse(await response.text());
    protectExternalLinks(
      document,
      context.url,
      (context.site ?? context.url).origin,
      options,
    );

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("etag");
    return new Response(serialize(document), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

export { externalLinks };
