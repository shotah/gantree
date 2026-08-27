#!/usr/bin/env node
/**
 * Static GitHub Pages tree (shotah.github.io/gantree).
 *
 *   npm run pages
 *   npm run pages -- --out=dist/pages
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

export const PAGES_ORIGIN = "https://shotah.github.io/gantree";
export const YARD_REPO = "https://github.com/shotah/gantree";
export const CRANE_REPO = "https://github.com/shotah/ai-gantry";

export const DOC_PAGES = [
  { file: "install.md", nav: "Install" },
  { file: "console.md", nav: "Console" },
  { file: "operators.md", nav: "Operators" },
  { file: "headless.md", nav: "Headless" },
  { file: "architecture.md", nav: "Architecture" },
  { file: "security.md", nav: "Security" },
  { file: "custom-mcp.md", nav: "Custom MCP" },
];

export function parsePagesArgs(argv) {
  const out = { outDir: "dist/pages", help: false };
  for (const a of argv) {
    if (a === "--help" || a === "-h") {
      out.help = true;
    } else if (a.startsWith("--out=")) {
      out.outDir = a.slice("--out=".length);
    } else {
      throw new Error(`unknown arg ${a}`);
    }
  }
  return out;
}

export function githubSlug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function titleFromMarkdown(md) {
  const m = String(md).match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "gantree";
}

function splitHash(href) {
  const i = href.indexOf("#");
  if (i === -1) {
    return { path: href, hash: "" };
  }
  return { path: href.slice(0, i), hash: href.slice(i) };
}

/** Rewrite markdown/image hrefs so docs HTML works on a project Pages site. */
export function rewriteHref(href) {
  if (!href) {
    return href;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("?")) {
    return href;
  }
  const { path, hash } = splitHash(href);
  if (path === "../README.md" || path === "README.md") {
    return `../index.html${hash}`;
  }
  if (path.endsWith(".md") && !path.includes("/")) {
    return `${path.slice(0, -3)}.html${hash}`;
  }
  if (path.startsWith("../repos/ai-gantry/")) {
    return `${CRANE_REPO}/blob/main/${path.slice("../repos/ai-gantry/".length)}${hash}`;
  }
  if (path.startsWith("../assets/")) {
    return href;
  }
  if (path.startsWith("../")) {
    return `${YARD_REPO}/blob/main/${path.slice(3)}${hash}`;
  }
  return href;
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function markdownToHtml(md) {
  const marked = new Marked();
  marked.use({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const plain = html.replace(/<[^>]+>/g, "");
        return `<h${depth} id="${escapeAttr(githubSlug(plain))}">${html}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const next = rewriteHref(href);
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
        return `<a href="${escapeAttr(next)}"${titleAttr}>${text}</a>`;
      },
      image({ href, title, text }) {
        const next = rewriteHref(href);
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
        return `<img src="${escapeAttr(next)}" alt="${escapeAttr(text)}"${titleAttr}>`;
      },
    },
  });
  return marked.parse(md, { async: false });
}

function navHtml(root, current) {
  const items = [
    { href: `${root}index.html`, label: "Home", id: "home" },
    ...DOC_PAGES.map((p) => ({
      href: `${root}docs/${p.file.replace(/\.md$/, ".html")}`,
      label: p.nav,
      id: p.file,
    })),
    { href: YARD_REPO, label: "GitHub", id: "github" },
    { href: CRANE_REPO, label: "ai-gantry", id: "crane" },
  ];
  return items
    .map((item) => {
      const cur = item.id === current ? ` aria-current="page"` : "";
      return `<a href="${escapeAttr(item.href)}"${cur}>${item.label}</a>`;
    })
    .join("\n        ");
}

function layout({
  title,
  description,
  canonical,
  depth,
  current,
  body,
  bodyClass = "",
}) {
  const root = depth === 0 ? "" : "../";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeAttr(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <link rel="canonical" href="${escapeAttr(canonical)}">
  <meta name="theme-color" content="#09090b">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeAttr(canonical)}">
  <meta property="og:image" content="${PAGES_ORIGIN}/assets/banner.png">
  <link rel="icon" href="${root}assets/logo.svg" type="image/svg+xml">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="${root}style.css">
</head>
<body class="${escapeAttr(bodyClass)}">
  <a class="skip" href="#content">Skip to content</a>
  <header class="top">
    <a class="brand" href="${root}index.html">
      <img src="${root}assets/logo.svg" width="28" height="28" alt="">
      gantree
    </a>
    <nav class="nav" aria-label="Site">
        ${navHtml(root, current)}
    </nav>
  </header>
  <main id="content" class="wrap">
    ${body}
  </main>
  <footer class="foot">
    <div class="wrap">
      <span>MIT · operator plane for <a href="${CRANE_REPO}">ai-gantry</a></span>
      <span><a href="${YARD_REPO}">github.com/shotah/gantree</a></span>
    </div>
  </footer>
</body>
</html>
`;
}

const HOME_DESCRIPTION
  = "Shipping yard for personal agents. A long-horizon Go harness you run — not a Claude Code plugin marketplace.";

export function buildPages(rootDir, outDir) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, ".nojekyll"), "");
  cpSync(join(rootDir, "site", "style.css"), join(outDir, "style.css"));
  cpSync(join(rootDir, "assets"), join(outDir, "assets"), { recursive: true });

  const homeBody = readFileSync(join(rootDir, "site", "home.html"), "utf8");
  writeFileSync(join(outDir, "index.html"), layout({
    title: "gantree — shipping yard for personal agents",
    description: HOME_DESCRIPTION,
    canonical: `${PAGES_ORIGIN}/`,
    depth: 0,
    current: "home",
    body: homeBody,
    bodyClass: "home",
  }));

  writeFileSync(join(outDir, "404.html"), layout({
    title: "Not in the yard — gantree",
    description: HOME_DESCRIPTION,
    canonical: `${PAGES_ORIGIN}/404.html`,
    depth: 0,
    current: "",
    body: `<div class="lost">
      <p class="kicker">404</p>
      <h1>That page is not in the yard.</h1>
      <p><a href="index.html">Back to the board</a></p>
    </div>`,
  }));

  mkdirSync(join(outDir, "docs"), { recursive: true });
  for (const page of DOC_PAGES) {
    const md = readFileSync(join(rootDir, "docs", page.file), "utf8");
    const title = titleFromMarkdown(md);
    const slug = page.file.replace(/\.md$/, ".html");
    writeFileSync(join(outDir, "docs", slug), layout({
      title: `${title} — gantree`,
      description: title,
      canonical: `${PAGES_ORIGIN}/docs/${slug}`,
      depth: 1,
      current: page.file,
      body: `<article class="prose">${markdownToHtml(md)}</article>`,
    }));
  }
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return fileURLToPath(import.meta.url) === resolve(entry);
}

if (isMain()) {
  const args = parsePagesArgs(process.argv.slice(2));
  if (args.help) {
    console.log("npm run pages [-- --out=dist/pages]");
    process.exit(0);
  }
  const root = resolve(import.meta.dirname, "..");
  const outDir = resolve(root, args.outDir);
  buildPages(root, outDir);
  const docs = readdirSync(join(outDir, "docs")).length;
  console.log(`wrote ${outDir} (${docs} doc pages)`);
}
