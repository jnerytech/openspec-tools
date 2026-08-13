# Chapter 4: Choose a Model

## Core Idea
The `model` field sets which AI model the subagent uses. It accepts an alias, a full model ID, or `inherit` — and defaults to `inherit`. At invocation time, Claude Code resolves the model through a fixed 4-step precedence chain.

## Frameworks Introduced
- **Model resolution order** (highest precedence first):
  1. `CLAUDE_CODE_SUBAGENT_MODEL` environment variable, if set
  2. The per-invocation `model` parameter (Claude can pass this when invoking)
  3. The subagent definition's `model` frontmatter
  4. The main conversation's model
  - When to use: know this when a subagent runs on an unexpected model — check top-down.
  - How: the first set value wins.

## Key Concepts
- **Model alias**: `sonnet`, `opus`, `haiku`, `fable`.
- **Full model ID**: e.g. `claude-opus-4-8`, `claude-sonnet-4-6` — same values as the `--model` flag.
- **inherit**: same model as the main conversation.
- **Omitted**: defaults to `inherit`.

## Mental Models
- Route cheap/high-volume work (search, log scanning) to `haiku` to control cost.
- Use `sonnet`/`opus` for analysis-heavy specialists (e.g. data scientist).
- Leave `inherit` when the subagent should match whatever the user is running.

## Reference Tables
| `model` value | Result |
| --- | --- |
| `sonnet`/`opus`/`haiku`/`fable` | That alias |
| `claude-opus-4-8` (full id) | That exact model |
| `inherit` | Main conversation's model |
| (omitted) | Defaults to `inherit` |

## Worked Example
A `data-scientist` subagent sets `model: sonnet` in frontmatter (step 3). Normally that wins over the main conversation's model (step 4). But if the operator exports `CLAUDE_CODE_SUBAGENT_MODEL=haiku` (step 1), *every* subagent — including this one — runs on Haiku, overriding the frontmatter. To force Sonnet regardless, the per-invocation parameter (step 2) would still lose to the env var, since step 1 is highest.

## Key Takeaways
1. Default is `inherit` — match the main conversation.
2. Env var `CLAUDE_CODE_SUBAGENT_MODEL` overrides everything.
3. Precedence: env var → invocation param → frontmatter → main model.
4. Use Haiku to cut cost on high-volume subagent work.

## Connects To
- **Ch 1**: built-ins use fixed models (Explore=Haiku, etc.).
- **Ch 12**: a fork uses the main session's model, not a `model` field.
