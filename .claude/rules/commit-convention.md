<!-- opsx-tools:commit-convention created=1 -->
## Commit messages

Every commit message is exactly one line, in Conventional Commits form:

    type(scope): description

- `type` is one of: feat, fix, docs, style, refactor, perf, test, build,
  ci, chore, revert.
- `scope` is optional and names the area touched, in lowercase.
- Mark a breaking change with `!` before the colon: `feat(cli)!: ...`.
- The description is imperative and lowercase, with no trailing period.
- Keep the whole line at 72 characters or fewer.
- Write nothing after that line: no body, no footer, no trailers — in
  particular no `Co-Authored-By` line.
<!-- opsx-tools:commit-convention:end -->
