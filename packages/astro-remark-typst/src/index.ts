import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { registerTypstFile } from "@agarmu/astro-typst";
import type { Root } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

type MdxElement = MdxJsxFlowElement | MdxJsxTextElement;

export interface RemarkTypstOptions {
  root?: string;
}

/** Register a local Typst source and return its generated PDF URL. */
export function resolveTypstFile(
  href: string,
  importer?: string,
  root = process.cwd(),
): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return href;

  const suffixIndex = href.search(/[?#]/);
  const pathname = suffixIndex < 0 ? href : href.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : href.slice(suffixIndex);
  const decoded = decodeURIComponent(pathname);
  if (!decoded.endsWith(".typ")) return href;
  if (!importer)
    throw new Error(`Cannot resolve Typst link ${href} without a source path`);

  const source = decoded.startsWith("/")
    ? resolve(root, `.${decoded}`)
    : resolve(dirname(importer), decoded);
  const sourcePath = relative(resolve(root, "src"), source);
  if (
    sourcePath === ".." ||
    sourcePath.startsWith(`..${sep}`) ||
    isAbsolute(sourcePath)
  ) {
    throw new Error(`Typst link ${href} in ${importer} must point inside src/`);
  }

  return registerTypstFile(source) + suffix;
}

function rewriteJsxHref(
  node: MdxElement,
  importer: string | undefined,
  root: string,
): void {
  if (node.name !== "a" && node.name !== "File") return;
  for (const attribute of node.attributes) {
    if (
      attribute.type === "mdxJsxAttribute" &&
      attribute.name === "href" &&
      typeof attribute.value === "string"
    ) {
      attribute.value = resolveTypstFile(attribute.value, importer, root);
    }
  }
}

/** Rewrite local .typ links in Markdown and MDX. */
export default function remarkTypst({
  root = process.cwd(),
}: RemarkTypstOptions = {}) {
  return (tree: Root, file: VFile): void => {
    const referenced = new Set<string>();
    visit(tree, "linkReference", (node) => {
      referenced.add(node.identifier);
    });

    visit(tree, (node) => {
      if (
        node.type === "link" ||
        (node.type === "definition" && referenced.has(node.identifier))
      ) {
        node.url = resolveTypstFile(node.url, file.path, root);
      } else if (
        node.type === "mdxJsxTextElement" ||
        node.type === "mdxJsxFlowElement"
      ) {
        rewriteJsxHref(node, file.path, root);
      }
    });
  };
}

export { remarkTypst };
