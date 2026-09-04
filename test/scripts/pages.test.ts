import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error scripts/*.mjs sits outside the TS project
import * as pages from "../../scripts/pages.mjs";

const {
  DOC_PAGES,
  buildPages,
  githubSlug,
  markdownToHtml,
  parsePagesArgs,
  rewriteHref,
  titleFromMarkdown,
} = pages;

const root = resolve(import.meta.dirname, "../..");
const outs: string[] = [];

afterEach(() => {
  for (const dir of outs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function build() {
  const out = mkdtempSync(join(tmpdir(), "gantree-pages-"));
  outs.push(out);
  buildPages(root, out);
  return out;
}

describe("parsePagesArgs", () => {
  it("reads --out", () => {
    expect(parsePagesArgs(["--out=/tmp/site"])).toMatchObject({ outDir: "/tmp/site" });
  });

  it("rejects junk", () => {
    expect(() => parsePagesArgs(["--fancy"])).toThrow(/unknown arg/);
  });
});

describe("rewriteHref", () => {
  it("turns sibling docs into html", () => {
    expect(rewriteHref("install.md")).toBe("install.html");
    expect(rewriteHref("security.md#dev-auto-login")).toBe("security.html#dev-auto-login");
  });

  it("sends the readme to the site home", () => {
    expect(rewriteHref("../README.md")).toBe("../index.html");
  });

  it("leaves asset paths for docs HTML", () => {
    expect(rewriteHref("../assets/docs/yard.png")).toBe("../assets/docs/yard.png");
  });

  it("points nested harness notes and yard files at GitHub", () => {
    expect(rewriteHref("../repos/ai-gantry/docs/gantree.md")).toBe(
      "https://github.com/shotah/ai-gantry/blob/main/docs/gantree.md",
    );
    expect(rewriteHref("../todo.md")).toBe("https://github.com/shotah/gantree/blob/main/todo.md");
    expect(rewriteHref("../.env.example")).toBe("https://github.com/shotah/gantree/blob/main/.env.example");
  });

  it("leaves absolute and hash hrefs", () => {
    expect(rewriteHref("https://github.com/shotah/ai-gantry")).toBe("https://github.com/shotah/ai-gantry");
    expect(rewriteHref("#bind")).toBe("#bind");
  });
});

describe("githubSlug", () => {
  it("matches the in-doc anchors", () => {
    expect(githubSlug("Dev auto-login")).toBe("dev-auto-login");
    expect(githubSlug("Screenshot yard (no daemon)")).toBe("screenshot-yard-no-daemon");
    expect(githubSlug("8. Console in Docker")).toBe("8-console-in-docker");
  });
});

describe("titleFromMarkdown", () => {
  it("reads the first heading", () => {
    expect(titleFromMarkdown("# Install — home Mini or cloud VM\n\nHi\n")).toBe(
      "Install — home Mini or cloud VM",
    );
  });
});

describe("markdownToHtml", () => {
  it("ids headings and rewrites relative doc links", () => {
    const html = markdownToHtml("## Dev auto-login\n\nSee [install](install.md).\n");
    expect(html).toContain('id="dev-auto-login"');
    expect(html).toContain('href="install.html"');
  });
});

describe("buildPages", () => {
  it("publishes every operator doc except the Hub overview", () => {
    const files = readdirSync(join(root, "docs")).filter((f) => f.endsWith(".md"));
    const published = new Set(DOC_PAGES.map((p: { file: string }) => p.file));
    for (const f of files) {
      if (f === "dockerhub.md") {
        expect(published.has(f)).toBe(false);
      } else {
        expect(published.has(f)).toBe(true);
      }
    }
  });

  it("writes a self-contained github.io tree", () => {
    const out = build();
    const index = readFileSync(join(out, "index.html"), "utf8");
    const install = readFileSync(join(out, "docs", "install.html"), "utf8");
    const security = readFileSync(join(out, "docs", "security.html"), "utf8");
    const architecture = readFileSync(join(out, "docs", "architecture.html"), "utf8");
    const consoleDoc = readFileSync(join(out, "docs", "console.html"), "utf8");

    expect(readFileSync(join(out, ".nojekyll"), "utf8")).toBe("");
    expect(index).toContain("A harness is a process");
    expect(index).toContain("assets/docs/crane-metrics.png");
    expect(index).toContain("assets/banner.svg");
    expect(index).toContain("docs/install.html");
    expect(index).not.toContain("href=\"/gantree/");
    expect(install).toContain("../assets/docs/login.png");
    expect(install).toContain("../style.css");
    expect(security).toContain('id="dev-auto-login"');
    expect(consoleDoc).toContain('id="screenshot-yard-no-daemon"');
    expect(consoleDoc).toContain("../assets/docs/boards.png");
    expect(architecture).toContain("https://github.com/shotah/gantree/blob/main/todo.md");
    expect(architecture).toContain("https://github.com/shotah/ai-gantry/blob/main/docs/gantree.md");
    expect(readdirSync(join(out, "docs"))).not.toContain("dockerhub.html");
  });
});
