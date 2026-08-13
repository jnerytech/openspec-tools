# Chapter 1: What Skills Are & Bundled Skills

## Core Idea
A skill is a `SKILL.md` file of instructions that Claude adds to its toolkit and loads **only when used** — so reference material costs almost nothing until needed. Claude invokes skills automatically when relevant, or you invoke directly with `/skill-name`.

## Frameworks Introduced
- **The "stop pasting" trigger** — the signal that you should make a skill.
  - When to use: you keep pasting the same instructions/checklist/procedure into chat, OR a section of CLAUDE.md has grown into a *procedure* rather than a *fact*.
  - How: extract that procedure into `SKILL.md`. Unlike CLAUDE.md (always in context), a skill body loads on demand.
- **Commands = Skills (merged)** — `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy` and behave the same.
  - When to use: deciding whether to migrate old command files. You don't have to — they keep working.
  - How: prefer skills for new work; they add a directory for supporting files, frontmatter invocation control, and automatic model loading.
- **Agent Skills open standard** — Claude Code skills follow the [agentskills.io](https://agentskills.io/) standard (cross-tool). Claude Code *extends* it with invocation control, subagent execution (`context: fork`), and dynamic context injection.

## Key Concepts
- **Skill**: directory with a required `SKILL.md` entrypoint; Claude uses it when relevant.
- **Bundled skill**: prompt-based skill shipped in every session (e.g. `/code-review`, `/batch`, `/debug`, `/loop`, `/claude-api`). Unlike built-in commands (fixed logic), bundled skills give Claude instructions and let it orchestrate with its tools.
- **Built-in command**: fixed logic executed directly (e.g. `/help`, `/compact`) — not prompt-based.
- **`disableBundledSkills`**: setting that turns off bundled skills.

## Mental Models
- Think of a skill as **lazy-loaded CLAUDE.md**: facts → CLAUDE.md (always loaded); procedures → skill (loaded on use).
- Bundled skill vs built-in command = **prompt-driven vs hardcoded**. Bundled ones orchestrate; built-ins just run.

## Anti-patterns
- **Putting a growing procedure in CLAUDE.md**: it burns context every turn. Move it to a skill.
- **Rewriting `.claude/commands/` files just to "modernize"**: unnecessary — they still work; migrate only when you need supporting files or invocation control.

## Reference Tables
**Run-and-verify bundled trio** (all require Claude Code v2.1.145+):

| Skill | Purpose |
| --- | --- |
| `/run` | Launch and drive your app to see a change working |
| `/verify` | Build + run the app to confirm a change does what it should, without falling back to tests/type checks |
| `/run-skill-generator` | Teach `/run` and `/verify` how to build & launch your project |

`/run` and `/verify` work with no setup by inferring the launch from project type (CLI, server, TUI, browser-driven) and from README / `package.json` / `Makefile`. Inference gets unreliable when the app needs a database, env file, graphical session, or multi-step build.

## Worked Example
A project needs a DB + env file to launch, so `/run`'s inference fails. Fix: run `/run-skill-generator` once. It gets the app running from a clean environment, captures what worked (install commands, env vars, launch script), and commits a per-project skill at `.claude/skills/run-<name>/`. After that, `/run`, `/verify`, and any agent in the repo follow the recorded recipe instead of rediscovering it. Re-run it only if the build/launch process changes.

## Key Takeaways
1. Make a skill the moment you notice repeated pasting or a procedure living in CLAUDE.md.
2. Skill bodies are on-demand; CLAUDE.md is always-on — partition facts vs procedures accordingly.
3. Commands and skills are the same mechanism now; skills are the recommended superset.
4. Bundled skills are prompt-based and orchestrate with tools; built-in commands run fixed logic.
5. `/run-skill-generator` records a launch recipe so non-trivial apps become `/run`-able.

## Connects To
- **Ch 2**: where you place the skill determines who can use it.
- **Ch 3**: what to put in `SKILL.md` (reference vs task content) + frontmatter.
- **Ch 7**: `context: fork` and dynamic injection — the Claude Code extensions to the standard.
