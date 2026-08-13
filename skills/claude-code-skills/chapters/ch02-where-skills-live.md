# Chapter 2: Where Skills Live, Precedence & Discovery

## Core Idea
*Where* you store a skill determines *who* can use it and *which* copy wins. Claude Code discovers skills from the personal dir, the project dir, every parent up to repo root, and (on demand) nested subdirectories.

## Frameworks Introduced
- **Four storage levels** — pick by audience.
  - When to use: deciding scope before writing a skill.
  - How: choose the narrowest level that reaches the intended audience.
- **Precedence chain** — enterprise > personal > project, and any level overrides a bundled skill of the same name.
  - When to use: resolving a name clash or intentionally replacing a bundled skill.
  - How: place your override at a higher-priority level. A project `code-review` replaces bundled `/code-review`.
- **Nested / directory-qualified skills** — monorepo packages ship their own skills.
  - When to use: a package needs skills that apply only when working in that package.
  - How: put them in `<pkg>/.claude/skills/`; on a name clash both stay available, the nested one under a qualified name `apps/web:deploy`.

## Key Concepts
- **Personal skill**: `~/.claude/skills/<name>/SKILL.md` — all your projects.
- **Project skill**: `.claude/skills/<name>/SKILL.md` — this project only; commit to share.
- **Plugin skill**: `<plugin>/skills/<name>/SKILL.md` — uses `plugin-name:skill-name` namespace, so it **cannot** conflict with other levels.
- **Live change detection**: edits to `SKILL.md` text under watched dirs take effect within the session, no restart.
- **`--add-dir` exception**: `.claude/skills/` inside an added dir loads automatically (skills are the one exception to "add-dir grants file access, not config").

## Mental Models
- Precedence is **most-specific-trust-wins for clashes, but most-local-discovery-wins for monorepos**: identical names → enterprise/personal/project order; nested packages → both kept, qualified.
- Plugin namespacing is a **collision-proof sandbox** — never worry about a plugin skill shadowing yours.

## Anti-patterns
- **Expecting a brand-new top-level skills directory to hot-load**: creating a *directory* that didn't exist at session start needs a restart so it can be watched. (Adding/editing a skill *inside* an already-watched dir is live.)
- **Assuming `permissions.additionalDirectories` loads skills**: it grants file access only. Only `--add-dir` / `/add-dir` load skills.
- **Expecting commands/output-styles from `--add-dir`**: not loaded — only `.claude/skills/` is the exception.

## Reference Tables
**Storage levels:**

| Location | Path | Applies to |
| --- | --- | --- |
| Enterprise | managed settings | All users in org |
| Personal | `~/.claude/skills/<name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<name>/SKILL.md` | This project only |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where plugin enabled |

**Live change detection scope:**

| Change | Takes effect |
| --- | --- |
| Add/edit/remove `SKILL.md` under watched dir | Within session, no restart |
| New top-level skills dir (absent at start) | Requires restart |
| Plugin `hooks/`, `.mcp.json`, `agents/`, `output-styles/` | Requires `/reload-plugins` |

## Skill directory layout
```text
my-skill/
├── SKILL.md           # Main instructions (required)
├── template.md        # Template for Claude to fill in
├── examples/
│   └── sample.md      # Example output showing expected format
└── scripts/
    └── validate.sh    # Script Claude can execute
```

## Worked Example
A monorepo has a root `deploy` skill and `apps/web/.claude/skills/deploy/`. When Claude edits a file in `apps/web/`, the nested skill becomes available under `apps/web:deploy`; its description says which directory it applies to, and Claude picks the variant matching the files it's working on. Typing `/deploy` runs the **root** skill; type `/apps/web:deploy` to run the nested one explicitly.

## Key Takeaways
1. Choose level by audience: enterprise → personal → project → plugin.
2. Same-name clash: enterprise>personal>project; any level beats a bundled skill; skill beats a same-name command.
3. Skills load from the start dir AND every parent up to repo root, plus nested dirs on demand.
4. Plugin skills are namespaced and collision-proof.
5. `--add-dir` loads skills (the exception); `additionalDirectories` setting does not.
6. New top-level dirs need a restart; in-dir edits are live.

## Connects To
- **Ch 1**: commands vs skills precedence.
- **Ch 4**: how the command *name* is derived from the path (incl. nested qualified names).
- **Ch 8**: `skillOverrides` and plugin management override visibility, not location.
