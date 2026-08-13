import { marked } from "marked";
import { readFile } from "fs/promises";
import { compareArtifacts } from "./scanner.js";
import type { Change, MarkdownFile } from "./types.js";

/**
 * Every route that shows artifacts passes through here, so the reading order
 * holds however the change was reached. Copied rather than sorted in place: the
 * caller's array is its own, and the index still renders from the scanned one.
 */
function inReadingOrder(files: MarkdownFile[]): MarkdownFile[] {
  return [...files].sort(compareArtifacts);
}

marked.setOptions({ gfm: true, breaks: false });

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    /* Always light, like a rendered .md on github.com — declaring the
       scheme also keeps scrollbars and form controls light when the OS
       is in dark mode. */
    color-scheme: light;

    --bg:       #ffffff;
    --surface:  #f6f8fa;
    --border:   #d1d9e0;
    --text:     #1f2328;
    --muted:    #59636e;
    --accent:   #0969da;
    --code-bg:  #f6f8fa;
    --tag-bg:   #ddf4ff;
    --tag-text: #0969da;

    /* GitHub's markdown font stacks, so a spec reads here the way it
       reads in a rendered .md on github.com */
    --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
                 Helvetica, Arial, sans-serif, "Apple Color Emoji",
                 "Segoe UI Emoji";
    --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
                 "Liberation Mono", monospace;
  }

  html { font-size: 18px; -webkit-text-size-adjust: 100%; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
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
    font-family: var(--font-body); font-size: .875rem;
  }
  .skip-link:focus { top: 1rem; }

  /* ── Header ── */
  .site-header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 1.25rem;
    margin-bottom: 2rem;
  }
  .site-header .brand {
    font-family: var(--font-body);
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
    font-family: var(--font-body);
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
    font-family: var(--font-body);
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
    font-family: var(--font-body);
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
    font-family: var(--font-body);
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
    font-family: var(--font-body);
  }

  /* ── Markdown content ── */
  .md-body h1, .md-body h2, .md-body h3,
  .md-body h4, .md-body h5, .md-body h6 {
    font-family: var(--font-body);
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
    font-family: var(--font-mono);
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
    font-family: var(--font-body);
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
    font-family: var(--font-body);
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
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 1rem;
    color: var(--text);
  }
  .change-meta {
    font-family: var(--font-body);
    font-size: .8rem;
    color: var(--muted);
  }
  .change-link {
    font-family: var(--font-body);
    font-size: .825rem;
    font-weight: 600;
    color: var(--accent);
    text-decoration: none;
    white-space: nowrap;
  }
  .change-link:hover { text-decoration: underline; }

  /* ── Archived ── */
  .section-heading {
    font-family: var(--font-body);
    font-size: 1.05rem;
    font-weight: 600;
    margin: 2.5rem 0 .75rem;
  }
  .section-note {
    font-family: var(--font-body);
    font-size: .85rem;
    color: var(--muted);
    margin-bottom: .75rem;
  }
  .archive-toggle {
    display: inline-block;
    font-family: var(--font-body);
    font-size: .825rem;
    font-weight: 600;
    color: var(--accent);
    text-decoration: none;
    margin-top: .6rem;
  }
  .archive-toggle:hover { text-decoration: underline; }
  .archived-banner {
    font-family: var(--font-body);
    font-size: .875rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 4px solid var(--muted);
    border-radius: 6px;
    padding: .75rem 1rem;
    margin-bottom: 1.5rem;
    color: var(--muted);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--muted);
    font-family: var(--font-body);
  }
  .empty-state p { margin: .5rem 0; }

  /* ── Back nav ── */
  .back-nav {
    font-family: var(--font-body);
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

/**
 * `project` leads every signature in this module: a row of browser tabs from
 * different projects has to be legible, so no page can be rendered without
 * saying which project it belongs to.
 */
function pageShell(
  project: string,
  title: string,
  body: string,
  extraHead = ""
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)} · ${escHtml(project)}</title>
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

/**
 * Whether archived changes are currently shown, and what the invocation asked
 * for. Links only carry the query parameter when the two differ, so a default
 * run keeps clean URLs while a revealed archive survives navigation.
 */
export interface ArchiveViewState {
  current: boolean;
  initial: boolean;
}

const HIDDEN_ARCHIVE: ArchiveViewState = { current: false, initial: false };

/** Single place where links are built, so the archive state is never dropped. */
function linkTo(
  path: string,
  view: ArchiveViewState,
  state: boolean = view.current
): string {
  if (state === view.initial) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}archived=${state ? "1" : "0"}`;
}

function artifactMeta(change: Change): string {
  const count = `${change.artifacts.length} artifact${change.artifacts.length !== 1 ? "s" : ""}`;
  return `${count} · ${change.artifacts.map((a) => escHtml(a.name)).join(", ")}`;
}

function changeItem(
  name: string,
  meta: string,
  href: string
): string {
  return `
    <li class="change-item">
      <div>
        <div class="change-name">${escHtml(name)}</div>
        <div class="change-meta">${meta}</div>
      </div>
      <a class="change-link" href="${href}">Read →</a>
    </li>`;
}

function archivedList(changes: Change[], view: ArchiveViewState): string {
  if (changes.length === 0) {
    return `<p class="section-note">There are no archived changes.</p>`;
  }

  const items = changes
    .map((c) => {
      const date = c.archived?.date;
      const meta = date
        ? `Archived ${escHtml(date)} · ${artifactMeta(c)}`
        : artifactMeta(c);
      return changeItem(
        c.archived?.displayName ?? c.name,
        meta,
        linkTo(`/archived/${encodeURIComponent(c.slug)}`, view)
      );
    })
    .join("");

  return `<ul class="change-list" role="list">${items}</ul>`;
}

export function renderIndex(
  project: string,
  changes: Change[],
  changesDir: string,
  options: {
    view?: ArchiveViewState;
    archivedChanges?: Change[];
    /** Archive directory targeted directly: no open-change section at all. */
    archiveOnly?: boolean;
  } = {}
): string {
  const view = options.view ?? HIDDEN_ARCHIVE;
  const archivedChanges = options.archivedChanges ?? [];

  if (options.archiveOnly) {
    const body = `
    <header class="site-header" role="banner">
      <span class="brand">${escHtml(project)}</span>
      <h1>Archived Changes</h1>
      <p class="subtitle">${escHtml(changesDir)}/archive · ${archivedChanges.length} change${archivedChanges.length !== 1 ? "s" : ""} found</p>
    </header>
    <main id="main">${archivedList(archivedChanges, view)}</main>`;

    return pageShell(project, "Archived Changes", body);
  }

  const listHtml =
    changes.length === 0
      ? `<div class="empty-state">
          <p>No open changes found.</p>
          <p>Run <code>openspec new change &lt;name&gt;</code> to create one.</p>
        </div>`
      : `<ul class="change-list" role="list">
          ${changes
            .map((c) =>
              changeItem(
                c.name,
                artifactMeta(c),
                linkTo(`/change/${encodeURIComponent(c.slug)}`, view)
              )
            )
            .join("")}
        </ul>`;

  const archivedSection = view.current
    ? `<h2 class="section-heading">Archived changes</h2>
       ${archivedList(archivedChanges, view)}`
    : "";

  const toggle = `<a class="archive-toggle" href="${linkTo("/", view, !view.current)}">${
    view.current ? "Hide archived changes" : "Show archived changes"
  }</a>`;

  const body = `
    <header class="site-header" role="banner">
      <span class="brand">${escHtml(project)}</span>
      <h1>Open Changes</h1>
      <p class="subtitle">${escHtml(changesDir)} · ${changes.length} change${changes.length !== 1 ? "s" : ""} found</p>
      ${toggle}
    </header>
    <main id="main">${listHtml}${archivedSection}</main>`;

  return pageShell(project, "Open Changes", body);
}

export async function renderChange(
  project: string,
  change: Change,
  view: ArchiveViewState = HIDDEN_ARCHIVE
): Promise<string> {
  const artifacts = inReadingOrder(change.artifacts);

  const tocItems = artifacts
    .map(
      (a, i) =>
        `<li><a href="#artifact-${i}">${escHtml(a.name)}</a></li>`
    )
    .join("");

  const sections = await Promise.all(
    artifacts.map(async (artifact, i) => {
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

  const title = change.archived?.displayName ?? change.name;

  // States the context out loud, so an old task list is not read as work still
  // outstanding. Open changes carry nothing here.
  const banner = change.archived
    ? `<p class="archived-banner" role="note">${
        change.archived.date
          ? `Archived on ${escHtml(change.archived.date)} — this is history, not pending work.`
          : `Archived — this is history, not pending work.`
      }</p>`
    : "";

  const body = `
    <header class="site-header" role="banner">
      <a class="brand" href="${linkTo("/", view)}">← ${escHtml(project)}</a>
      <h1>${escHtml(title)}</h1>
      <p class="subtitle">${change.artifacts.length} artifact${change.artifacts.length !== 1 ? "s" : ""}</p>
    </header>
    ${banner}
    <nav class="toc" aria-label="Contents">
      <div class="toc-label">On this page</div>
      <ol>${tocItems}</ol>
    </nav>
    <main id="main">${sections.join("")}</main>`;

  return pageShell(project, title, body);
}

export async function renderFiles(
  project: string,
  files: MarkdownFile[],
  title: string,
  backHref?: string
): Promise<string> {
  const ordered = inReadingOrder(files);

  const tocItems = ordered
    .map(
      (f, i) =>
        `<li><a href="#section-${i}">${escHtml(f.name)}</a></li>`
    )
    .join("");

  const sections = await Promise.all(
    ordered.map(async (f, i) => {
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
      <a class="brand" href="/">← ${escHtml(project)}</a>
      <h1>${escHtml(title)}</h1>
      <p class="subtitle">${files.length} file${files.length !== 1 ? "s" : ""}</p>
    </header>
    ${backNav}
    ${toc}
    <main id="main">${sections.join("")}</main>`;

  return pageShell(project, title, body);
}

export async function renderSingleFile(
  project: string,
  filePath: string
): Promise<string> {
  const raw = await readFile(filePath, "utf-8");
  const html = await marked.parse(raw);
  const name = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Document";

  const body = `
    <header class="site-header" role="banner">
      <a class="brand" href="/">← ${escHtml(project)}</a>
      <h1>${escHtml(name)}</h1>
    </header>
    <main id="main">
      <div class="md-body">${html}</div>
    </main>`;

  return pageShell(project, name, body);
}

export function render404(project: string): string {
  const body = `
    <header class="site-header" role="banner">
      <a class="brand" href="/">← ${escHtml(project)}</a>
      <h1>Not found</h1>
    </header>
    <main id="main">
      <div class="empty-state">
        <p>This page does not exist.</p>
        <p><a href="/">Go back to the index</a>.</p>
      </div>
    </main>`;
  return pageShell(project, "Not found", body);
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
