# Chapter 4: Command Naming, String Substitutions & Supporting Files

## Core Idea
The command you type comes from **where the skill file lives**, not the `name` field (one exception: plugin-root `SKILL.md`). Skills support `$`-substitutions for dynamic values, and supporting files keep `SKILL.md` lean by loading detail only when needed.

## Frameworks Introduced
- **Name-from-path rule** — directory/file location sets the `/command`; `name` is only the display label.
  - When to use: predicting what users type, or debugging a wrong command name.
  - How: see the table below; the only place `name` sets the command is a plugin-root `SKILL.md` (no directory to take it from).
- **Argument substitution family** — `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `$name`.
  - When to use: passing data into a skill at invocation.
  - How: declare `arguments: [issue, branch]` to enable `$issue`/`$branch`; or index with `$0`/`$1`. Quote multi-word args.
- **Supporting-files pattern** — offload large reference/specs/examples/scripts.
  - When to use: SKILL.md is getting long (keep under **500 lines**).
  - How: reference each file from SKILL.md so Claude knows what it contains and when to load it. Scripts are *executed*, not loaded.

## Key Concepts
- **`$ARGUMENTS`**: full argument string as typed. If absent from content, args appended as `ARGUMENTS: <value>`.
- **`$ARGUMENTS[N]` / `$N`**: 0-based positional access (`$0` = first).
- **`$name`**: named arg from `arguments` frontmatter, mapped by position.
- **`${CLAUDE_SESSION_ID}`**: current session ID (logging, session files).
- **`${CLAUDE_EFFORT}`**: `low`/`medium`/`high`/`xhigh`/`max` (ultracode reports as `xhigh`).
- **`${CLAUDE_SKILL_DIR}`**: dir containing this `SKILL.md` — use in bash injection to reference bundled scripts regardless of cwd.

## Mental Models
- Command name = **filesystem address**, not metadata. Want a different `/command`? Move/rename the directory.
- `${CLAUDE_SKILL_DIR}` is the **portable path anchor**: a skill referencing its own scripts works at personal, project, or plugin level unchanged.

## Anti-patterns
- **Setting `name:` expecting it to change the `/command`**: it only changes the display label (except plugin-root).
- **Hardcoding a script path**: breaks when the skill moves levels. Use `${CLAUDE_SKILL_DIR}/scripts/x.py`.
- **Forgetting to quote multi-word args**: `/my-skill hello world` makes `$0`=`hello`, `$1`=`world`; use `"hello world"` to keep it one arg.
- **Letting SKILL.md exceed ~500 lines**: move reference material into supporting files.

## Reference Tables
**Where the command name comes from:**

| Skill location | Name source | Example |
| --- | --- | --- |
| `~/.claude/skills/` or `.claude/skills/` dir | Directory name | `.claude/skills/deploy-staging/` → `/deploy-staging` |
| Nested dir, name clashes | Subdir path + skill dir name | `apps/web/.claude/skills/deploy/` → `/apps/web:deploy` |
| `.claude/commands/` file | File name w/o extension | `.claude/commands/deploy.md` → `/deploy` |
| Plugin `skills/` subdir | Dir name, namespaced by plugin | `my-plugin/skills/review/` → `/my-plugin:review` |
| Plugin root `SKILL.md` | Frontmatter `name` (dir name fallback) | `my-plugin/SKILL.md` `name: review` → `/my-plugin:review` |

**Substitutions:** `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `$name`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}`.

## Worked Example
Positional migration skill:
```yaml
---
name: migrate-component
description: Migrate a component from one framework to another
---

Migrate the $ARGUMENTS[0] component from $ARGUMENTS[1] to $ARGUMENTS[2].
Preserve all existing behavior and tests.
```
`/migrate-component SearchBar React Vue` → `$ARGUMENTS[0]`=`SearchBar`, `[1]`=`React`, `[2]`=`Vue`. The `$N` shorthand (`$0 $1 $2`) is equivalent.

Escaping: to print a literal `$1.00` in prose, write `\$1.00`. Only a single backslash directly before the token escapes it; `\\$1` leaves both backslashes and still expands `$1`.

Supporting-files layout:
```text
my-skill/
├── SKILL.md (required - overview and navigation)
├── reference.md (detailed API docs - loaded when needed)
├── examples.md (usage examples - loaded when needed)
└── scripts/helper.py (executed, not loaded)
```
Reference them so Claude knows when to load:
```markdown
## Additional resources
- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
```

## Key Takeaways
1. Command name = where the file lives; `name:` is display-only (except plugin-root).
2. Nested clashes produce qualified names like `apps/web:deploy`.
3. Use `$ARGUMENTS`, `$N`, or named `$name` args; quote multi-word values.
4. `${CLAUDE_SKILL_DIR}` makes bundled-script paths portable across install levels.
5. Keep SKILL.md < 500 lines; push detail to referenced supporting files; scripts run, they don't load.

## Connects To
- **Ch 2**: nested/qualified naming mirrors the discovery rules.
- **Ch 3**: `arguments` frontmatter enables `$name`; conciseness motivates supporting files.
- **Ch 7**: `${CLAUDE_SKILL_DIR}` + `!` injection run bundled scripts before Claude sees content.
