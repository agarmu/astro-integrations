import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Root } from "mdast";
import { VFile } from "vfile";
import remarkTypst, { resolveTypstFile } from "../src/index";

const project = mkdtempSync(join(tmpdir(), "astro-remark-typst-"));

afterAll(() => {
  rmSync(project, { recursive: true, force: true });
});

test("rewrites local Typst links in Markdown and MDX", () => {
  const importer = join(project, "src/pages/notes/index.mdx");
  const link = {
    type: "link" as const,
    url: "./lecture.typ?download=1#page=2",
    children: [{ type: "text" as const, value: "Lecture" }],
  };
  const definition = {
    type: "definition" as const,
    identifier: "notes",
    url: "./lecture.typ",
  };
  const file = {
    type: "mdxJsxTextElement" as const,
    name: "File",
    attributes: [
      {
        type: "mdxJsxAttribute" as const,
        name: "href",
        value: "./lecture.typ",
      },
    ],
    children: [],
  };
  const tree: Root = {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [
          link,
          {
            type: "linkReference",
            identifier: "notes",
            referenceType: "full",
            children: [],
          },
          file,
        ],
      },
      definition,
    ],
  };

  remarkTypst({ root: project })(tree, new VFile({ path: importer }));

  expect(link.url).toMatch(/^\/_typst\/[a-f0-9]{64}\.pdf\?download=1#page=2$/);
  const pdf = link.url.slice(0, link.url.indexOf("?"));
  expect(definition.url).toBe(pdf);
  expect(file.attributes[0]?.value).toBe(pdf);
  expect(resolveTypstFile("https://example.com/lecture.typ", importer)).toBe(
    "https://example.com/lecture.typ",
  );
  expect(() =>
    resolveTypstFile("../../../../secret.typ", importer, project),
  ).toThrow("must point inside src/");
});
