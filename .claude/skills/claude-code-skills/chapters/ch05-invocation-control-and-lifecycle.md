# Chapter 5: Invocation Control & Skill Content Lifecycle

## Core Idea
By default both you and Claude can invoke any skill. Two frontmatter fields split that control. Once invoked, a skill's rendered content stays in context for the rest of the session and is *not* re-read — so write standing instructions, not one-time steps, and know how compaction carries them forward.

## Frameworks Introduced
- **Two-axis invocation control** — restrict *who* can invoke.
  - When to use: side-effect workflows (you only) or background knowledge (Claude only).
  - How: `disable-model-invocation: true` → only you (use for `/commit`, `/deploy`, `/send-slack-message` — you don't want Claude deciding to deploy). `user-invocable: false` → only Claude (use for non-actionable context like `legacy-system-context`).
- **Invoke-once-then-standing** — a skill enters as one message and persists.
  - When to use: writing any skill body.
  - How: phrase guidance to apply throughout the task; Claude won't re-read the file on later turns.
- **Compaction carry-forward budget** — how skills survive summarization.
  - When to use: long sessions where you invoked many skills.
  - How: after compaction, the most recent invocation of each skill is re-attached, keeping the first **5,000 tokens** each, sharing a **25,000-token** combined budget filled from most-recently-invoked. Re-invoke a large/important skill after compaction to restore full content.

## Key Concepts
- **`disable-model-invocation: true`**: you-only; description NOT in context; full skill loads when you invoke.
- **`user-invocable: false`**: Claude-only; hidden from `/` menu; description always in context.
- **Default**: both invoke; description always in context; full content loads on invoke.
- **Subagent preload exception**: subagents with preloaded skills inject *full* content at startup (not just description).

## Mental Models
- Pick the field by **risk vs. relevance**: dangerous side effects → `disable-model-invocation` (gate the trigger); always-useful background → `user-invocable: false` (let Claude reach for it, hide the menu noise).
- A loaded skill is a **pinned message, not a function call** — it doesn't re-execute per turn; it lingers as context.

## Anti-patterns
- **Writing skill steps as "first do X" one-shots**: after the first response the content is still present but may read as already-done. Write standing instructions.
- **Assuming a skill keeps working forever in a long session**: many invocations later, older skills can be dropped entirely after compaction. Re-invoke if needed.
- **Blaming "the skill stopped working"**: usually content is still present and the model chose other tools. Strengthen `description`/instructions or enforce with hooks.

## Reference Tables
**How the two fields affect invocation & loading:**

| Frontmatter | You invoke | Claude invokes | When loaded into context |
| --- | --- | --- | --- |
| (default) | Yes | Yes | Description always in context; full skill on invoke |
| `disable-model-invocation: true` | Yes | No | Description NOT in context; full skill when you invoke |
| `user-invocable: false` | No | Yes | Description always in context; full skill on invoke |

**Compaction carry-forward:**

| Parameter | Value |
| --- | --- |
| Per-skill kept after compaction | First 5,000 tokens of most recent invocation |
| Combined re-attach budget | 25,000 tokens |
| Fill order | Most-recently-invoked first (older skills dropped) |

## Worked Example
You build a deploy skill you never want Claude to auto-run:
```yaml
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
---

Deploy $ARGUMENTS to production:
1. Run the test suite
2. Build the application
3. Push to the deployment target
4. Verify the deployment succeeded
```
Result: `/deploy` works for you; Claude never triggers it because "code looks ready"; its description isn't even in Claude's context. Inverse case — a `legacy-system-context` skill explaining an old system — uses `user-invocable: false`: Claude knows it when relevant, but `/legacy-system-context` isn't a meaningful user action so it's hidden from the menu.

## Key Takeaways
1. `disable-model-invocation: true` = you-only (gate risky side effects); `user-invocable: false` = Claude-only (background knowledge).
2. `disable-model-invocation` also removes the description from Claude's context and blocks subagent preload.
3. Invoked content persists as a single message; write standing instructions, not one-time steps.
4. Compaction keeps the first 5k tokens per skill within a 25k combined budget, most-recent first.
5. If a skill seems to "stop working," it's usually still loaded — strengthen description/instructions or use hooks.

## Connects To
- **Ch 3**: these fields are part of the frontmatter reference.
- **Ch 6**: `allowed-tools`/`disallowed-tools` are also "while active" and clear on next message.
- **Ch 8**: `skillOverrides` controls visibility/listing from settings instead of frontmatter.
