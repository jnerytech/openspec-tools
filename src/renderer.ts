import { marked } from "marked";
import { readFile } from "fs/promises";
import type { MarkdownFile } from "./types.js";

marked.setOptions({ gfm: true, breaks: false });

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #fafaf8;
    --surface:  #ffffff;
    --border:   #e2e0da;
    --text:     #1a1714;
    --muted:    #6b6760;
    --accent:   #2563eb;
    --code-bg:  #f3f2ee;
    --tag-bg:   #eef3ff;
    --tag-text: #1d4ed8;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg:       #111110;
      --surface:  #1c1c1a;
      --border:   #2e2d29;
      --text:     #e8e6e0;
      --muted:    #9b9890;
      --accent:   #60a5fa;
      --code-bg:  #242420;
      --tag-bg:   #1e2d50;
      --tag-text: #93c5fd;
    }
  }

  html { font-size: 18px; -webkit-text-size-adjust: 100%; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: "Georgia", "Times New Roman", serif;
    line-height: 1.75;
    padding: 2rem 1rem 6rem;
  }

  /* ── Layout ── */
  .page-wrap { max-width: 740px; margin: 0 auto; }

  /* ── Skip link (acessibilidade) ── */
  .skip-link {
    position: absolute; top: -999px; left: 1rem;
    background: var(--accent); color: #fff;
    padding: .3rem .8rem; border-radius: 4px;
    font-family: system-ui, sans-serif; font-size: .875rem;
  }
  .skip-link:focus { top: 1rem; }

  /* ── Header ── */
  .site-header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 1.25rem;
    margin-bottom: 2rem;
  }
  .site-header .brand {
    font-family: system-ui, sans-serif;
    font-size: .8rem;
    font-weight: 600;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
  }
  .site-header .brand:hover { color: var(--accent); }
  .site-header h1 {
    font-size: 1.6rem;
    font-weight: 700;
    margin-top: .5rem;
    line-height: 1.25;
  }
  .site-header .subtitle {
    font-family: system-ui, sans-serif;
    font-size: .875rem;
    color: var(--muted);
    margin-top: .3rem;
  }

  /* ── TOC ── */
  .toc {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 2.5rem;
  }
  .toc-label {
    font-family: system-ui, sans-serif;
    font-size: .75rem;
    font-weight: 600;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: .5rem;
  }
  .toc ol { list-style: decimal; padding-left: 1.25rem; }
  .toc li { margin: .2rem 0; }
  .toc a {
    font-family: system-ui, sans-serif;
    font-size: .9rem;
    color: var(--accent);
    text-decoration: none;
  }
  .toc a:hover { text-decoration: underline; }

  /* ── Artifact section ── */
  .artifact {
    margin-bottom: 3.5rem;
    scroll-margin-top: 1rem;
  }
  .artifact-header {
    display: flex;
    align-items: center;
    gap: .75rem;
    margin-bottom: 1.25rem;
    padding-bottom: .75rem;
    border-bottom: 2px solid var(--border);
  }
  .artifact-tag {
    font-family: system-ui, sans-serif;
    font-size: .7rem;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    background: var(--tag-bg);
    color: var(--tag-text);
    padding: .2rem .55rem;
    border-radius: 4px;
  }
  .artifact-title {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--muted);
    font-family: system-ui, sans-serif;
  }

  /* ── Markdown content ── */
  .md-body h1, .md-body h2, .md-body h3,
  .md-body h4, .md-body h5, .md-body h6 {
    font-family: system-ui, sans-serif;
    line-height: 1.3;
    margin: 1.75rem 0 .6rem;
    scroll-margin-top: 1rem;
  }
  .md-body h1 { font-size: 1.5rem; }
  .md-body h2 { font-size: 1.25rem; }
  .md-body h3 { font-size: 1.1rem; color: var(--muted); }
  .md-body h4 { font-size: 1rem; color: var(--muted); }

  .md-body p { margin: .9rem 0; }

  .md-body ul, .md-body ol {
    margin: .8rem 0;
    padding-left: 1.5rem;
  }
  .md-body li { margin: .3rem 0; }

  .md-body strong { font-weight: 700; }
  .md-body em { font-style: italic; }

  .md-body a { color: var(--accent); }

  .md-body code {
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: .85em;
    background: var(--code-bg);
    padding: .1em .35em;
    border-radius: 3px;
  }

  .md-body pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1rem 1.25rem;
    overflow-x: auto;
    margin: 1rem 0;
    font-size: .825rem;
    line-height: 1.55;
  }
  .md-body pre code {
    background: none;
    padding: 0;
    font-size: inherit;
  }

  /* Read-aloud hint: code blocks get a visual skip label */
  .md-body pre::before {
    display: block;
    content: "[ código ]";
    font-family: system-ui, sans-serif;
    font-size: .7rem;
    font-weight: 600;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: .5rem;
  }

  .md-body blockquote {
    border-left: 3px solid var(--border);
    padding-left: 1rem;
    color: var(--muted);
    margin: 1rem 0;
    font-style: italic;
  }

  .md-body hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2rem 0;
  }

  .md-body table {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
    font-family: system-ui, sans-serif;
    font-size: .875rem;
  }
  .md-body th, .md-body td {
    border: 1px solid var(--border);
    padding: .5rem .75rem;
    text-align: left;
  }
  .md-body th {
    background: var(--code-bg);
    font-weight: 600;
  }

  /* ── Index page ── */
  .change-list { list-style: none; }
  .change-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: .75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .change-item:hover { border-color: var(--accent); }
  .change-name {
    font-family: system-ui, sans-serif;
    font-weight: 600;
    font-size: 1rem;
    color: var(--text);
  }
  .change-meta {
    font-family: system-ui, sans-serif;
    font-size: .8rem;
    color: var(--muted);
  }
  .change-link {
    font-family: system-ui, sans-serif;
    font-size: .825rem;
    font-weight: 600;
    color: var(--accent);
    text-decoration: none;
    white-space: nowrap;
  }
  .change-link:hover { text-decoration: underline; }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--muted);
    font-family: system-ui, sans-serif;
  }
  .empty-state p { margin: .5rem 0; }

  /* ── Back nav ── */
  .back-nav {
    font-family: system-ui, sans-serif;
    font-size: .875rem;
    margin-bottom: 1.5rem;
  }
  .back-nav a { color: var(--accent); text-decoration: none; }
  .back-nav a:hover { text-decoration: underline; }

  @media print {
    .skip-link, .toc, .back-nav { display: none; }
    body { background: white; color: black; }
  }
`;

function pageShell(title: string, body: string, extraHead = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)} · openspec-tools</title>
  <style>${CSS}</style>
  ${extraHead}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="page-wrap">
    ${body}
  </div>
</body>
</html>`;
}

export function renderIndex(
  changes: import("./types.js").Change[],
  mode: string
): string {
  const listHtml =
    changes.length === 0
      ? `<div class="empty-state">
          <p>No open changes found.</p>
          <p>Run <code>openspec new change &lt;name&gt;</code> to create one.</p>
        </div>`
      : `<ul class="change-list" role="list">
          ${changes
            .map(
              (c) => `
            <li class="change-item">
              <div>
                <div class="change-name">${escHtml(c.name)}</div>
                <div class="change-meta">${c.artifacts.length} artifact${c.artifacts.length !== 1 ? "s" : ""} · ${c.artifacts.map((a) => escHtml(a.name)).join(", ")}</div>
              </div>
              <a class="change-link" href="/change/${encodeURIComponent(c.slug)}">Read →</a>
            </li>`
            )
            .join("")}
        </ul>`;

  const body = `
    <header class="site-header" role="banner">
      <span class="brand">openspec-tools</span>
      <h1>Open Changes</h1>
      <p class="subtitle">${escHtml(mode)} · ${changes.length} change${changes.length !== 1 ? "s" : ""} found</p>
    </header>
    <main id="main">${listHtml}</main>`;

  return pageShell("Open Changes", body);
}

export async function renderChange(
  change: import("./types.js").Change
): Promise<string> {
  const tocItems = change.artifacts
    .map(
      (a, i) =>
        `<li><a href="#artifact-${i}">${escHtml(a.name)}</a></li>`
    )
    .join("");

  const sections = await Promise.all(
    change.artifacts.map(async (artifact, i) => {
      const raw = await readFile(artifact.filePath, "utf-8");
      const html = await marked.parse(raw);
      return `
        <section class="artifact" id="artifact-${i}" aria-label="${escHtml(artifact.name)}">
          <div class="artifact-header">
            <span class="artifact-tag">${escHtml(artifact.name)}</span>
            <span class="artifact-title" aria-hidden="true">${escHtml(artifact.filePath.split("/").slice(-2).join("/"))}</span>
          </div>
          <div class="md-body">${html}</div>
        </section>`;
    })
  );

  const body = `
    <header class="site-header" role="banner">
      <a class="brand" href="/">← openspec-tools</a>
      <h1>${escHtml(change.name)}</h1>
      <p class="subtitle">${change.artifacts.length} artifact${change.artifacts.length !== 1 ? "s" : ""}</p>
    </header>
    <nav class="toc" aria-label="Contents">
      <div class="toc-label">On this page</div>
      <ol>${tocItems}</ol>
    </nav>
    <main id="main">${sections.join("")}</main>`;

  return pageShell(change.name, body);
}

export async function renderFiles(
  files: MarkdownFile[],
  title: string,
  backHref?: string
): Promise<string> {
  const tocItems = files
    .map(
      (f, i) =>
        `<li><a href="#section-${i}">${escHtml(f.name)}</a></li>`
    )
    .join("");

  const sections = await Promise.all(
    files.map(async (f, i) => {
      const raw = await readFile(f.filePath, "utf-8");
      const html = await marked.parse(raw);
      return `
        <section class="artifact" id="section-${i}" aria-label="${escHtml(f.name)}">
          <div class="artifact-header">
            <span class="artifact-tag">${escHtml(f.name)}</span>
          </div>
          <div class="md-body">${html}</div>
        </section>`;
    })
  );

  const backNav = backHref
    ? `<nav class="back-nav"><a href="${backHref}">← Back</a></nav>`
    : "";

  const toc =
    files.length > 1
      ? `<nav class="toc" aria-label="Contents">
           <div class="toc-label">On this page</div>
           <ol>${tocItems}</ol>
         </nav>`
      : "";

  const body = `
    <header class="site-header" role="banner">
      <a class="brand" href="/">← openspec-tools</a>
      <h1>${escHtml(title)}</h1>
      <p class="subtitle">${files.length} file${files.length !== 1 ? "s" : ""}</p>
    </header>
    ${backNav}
    ${toc}
    <main id="main">${sections.join("")}</main>`;

  return pageShell(title, body);
}

export async function renderSingleFile(filePath: string): Promise<string> {
  const raw = await readFile(filePath, "utf-8");
  const html = await marked.parse(raw);
  const name = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Document";

  const body = `
    <header class="site-header" role="banner">
      <a class="brand" href="/">← openspec-tools</a>
      <h1>${escHtml(name)}</h1>
    </header>
    <main id="main">
      <div class="md-body">${html}</div>
    </main>`;

  return pageShell(name, body);
}

export function render404(): string {
  const body = `
    <header class="site-header" role="banner">
      <a class="brand" href="/">← openspec-tools</a>
      <h1>Not found</h1>
    </header>
    <main id="main">
      <div class="empty-state">
        <p>This page does not exist.</p>
        <p><a href="/">Go back to the index</a>.</p>
      </div>
    </main>`;
  return pageShell("Not found", body);
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
