---
description: Final checks before opening a PR — tests, lint, build, conventions, boundary rules, secrets, docs
allowed-tools: Read, Glob, Grep, Edit, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(gh issue view:*), Bash(gh repo view:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(npx:*), Bash(mvn:*), Bash(./gradlew:*), Bash(pytest:*), Bash(uv:*), Bash(ruff:*), Bash(mypy:*), Bash(go:*), Bash(cargo:*), Bash(cd:*), Bash(grep -rn:*), Bash(find . -name:*)
---

## Overview

A pre-PR checklist applied automatically by `implement-issue` before opening a PR. Can also be run standalone before raising any PR. A PR that fails this checklist will be returned by review.

## Git policy

Read-only.

## Context

- Repo: !`gh repo view --json nameWithOwner -q .nameWithOwner`
- Current branch: !`git branch --show-current`
- Git status: !`git status`

## Your task

Work through every item in order. Stop on the first failure and report — do not continue to a later step if an earlier one fails.

### 1. Tests

Run the test command from `CLAUDE.md`. Confirm:
- All tests pass with zero failures
- No tests have been skipped or deleted without an explanation in the PR body
- Any newly added logic has test coverage on its acceptance-criteria paths

If the project has separate suites (unit, integration, e2e), run all that apply to the changed areas.

### 2. Lint, build, typecheck

Run each from `CLAUDE.md`. Stop on any error. Warnings alone are not blocking unless `CLAUDE.md` says otherwise.

### 3. Acceptance criteria

For each acceptance-criteria bullet on the linked issue, verify the code or output. Print a checklist:

- ✅ <criterion> — met (one-line evidence)
- ❌ <criterion> — not met (reason)

Stop and report if any are unmet.

### 4. Production-readiness bar

Apply the bar from `CLAUDE.md`. Examples (your project's bar may differ):

**All projects:**
- [ ] No secrets in code, commits, or logs (`grep -rn` for common secret patterns; check the diff for `.env` or config files with real values)
- [ ] Every external call has explicit success and failure paths — no `.catch(() => {})`, no swallowed errors
- [ ] No devDependencies imported at runtime
- [ ] Names convey intent; comments explain *why*, not *what*
- [ ] New code is open for extension; no god-objects, no premature abstraction
- [ ] `.env.example` updated for any new env var

**If the project has a frontend:**
- [ ] New data-driven screens have loading / empty / error / populated states
- [ ] No hardcoded API URLs (only `<env-var>` from `CLAUDE.md`)
- [ ] All `fetch` calls use `credentials: 'include'`
- [ ] No tokens in `localStorage` / `sessionStorage`
- [ ] Destructive actions confirm before firing

**If the project has a backend:**
- [ ] Every new request body validated by a schema (Zod / Pydantic / JSR-380)
- [ ] Endpoints accepting credentials are rate-limited or under a global limiter
- [ ] Uncaught errors surface with enough context to debug
- [ ] Env vars added to the schema (if applicable) with realistic minimums (not `min(1)` for secrets)
- [ ] Integration tests hit a real DB, not mocks (where applicable per `CLAUDE.md`)

For each unchecked item, decide: blocker, fix-now, or note in PR body.

### 5. Boundary rules

If `CLAUDE.md` defines boundary rules (e.g. "frontend never imports from admin", "auth state from `/auth/me` only, never localStorage"), verify each.

### 6. Documentation

- [ ] `README.md` reflects the changes (status checklist, feature list)
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry covering this work
- [ ] `CLAUDE.md` updated if conventions, paths, or commands shifted (rare)
- [ ] `.env.example` matches any new env var

If any are missing, recommend running `/update-docs` (or do it inline if the change is small).

### 7. PR title and body preparation

**Title format:** `[#<issue-number>] <imperative description>` (or whatever `CLAUDE.md` specifies).

**Body must include:**

```markdown
## Issue
Closes #<n>

## Summary
<one paragraph: what changed and why>

## Acceptance criteria
<checkbox list from issue, ticked where met>

## Tests added
<description, or "None — <reason>">

## Manual testing needed
<list, or "None — fully covered by automated tests">

## Notes
<pre-existing failures, follow-ups, anything reviewer should know>
```

If the project has a `<spec-reference>` section convention (Notion, Confluence, etc.), include it.

### 8. Labels and milestone

- [ ] PR will inherit the issue's labels and milestone (verify after creation)
- [ ] At least one label set (`feature`, `bug`, `chore`, etc.)

### 9. Project board

If the project board is configured in `CLAUDE.md`:
- [ ] The linked issue will move to `In Review` on PR open (verify after, automation usually handles this)

### 10. Final verdict

Print:

```
✅ All checks passed — ready to open the PR.
   Title: <proposed title>
   Base: <integration-branch>
   Head: <current-branch>
```

Or, if anything failed:

```
❌ Cannot open PR — fix the following first:
   - <failure 1>
   - <failure 2>
```
