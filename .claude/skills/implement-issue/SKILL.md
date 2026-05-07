---
description: Single-issue automated workflow — review, branch, implement (TDD), verify, commit, push, raise PR. Stops only when genuine user input is required.
argument-hint: <issue-number or pasted issue description>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, Bash(gh:*), Bash(jq:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git fetch:*), Bash(git pull:*), Bash(git rev-list:*), Bash(git checkout:*), Bash(git switch:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git worktree:*), Bash(git remote:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(npx:*), Bash(mvn:*), Bash(./gradlew:*), Bash(pytest:*), Bash(uv:*), Bash(ruff:*), Bash(mypy:*), Bash(python:*), Bash(go:*), Bash(cargo:*), Bash(cd:*), mcp__github__get_issue, mcp__github__list_issues, mcp__github__create_pull_request, mcp__github__update_issue, mcp__github__add_issue_comment, mcp__github__get_pull_request, mcp__github__update_pull_request_branch
---

## Overview

Run a complete single-issue workflow end-to-end with no manual checkpoints, **unless** genuine user input is required. The user's only obligation is to review and merge the resulting PR.

You may stop and ask for input when:
- Acceptance criteria are vague or contradictory
- A schema or API detail is missing from `CLAUDE.md`
- A design choice would risk significant rework if guessed
- An out-of-code task must happen mid-implementation (DNS, secrets, infra)

You may not stop just to "check in" with the user. Auto-proceed past every other point.

## Git permissions

Full git write access on **feature branches** only. Permitted: `checkout`, `branch`, `add`, `commit`, `push origin <feature-branch>`, `worktree add/remove`, `pull`, `fetch`, `switch`. Forbidden: pushing to `main` / `dev` / the integration branch directly, force-push, branch deletion. The user merges the PR.

## Tool usage rules

| Operation | Tool to use |
|-----------|-------------|
| Fetch issue details | `mcp__github__get_issue` (fall back to `gh issue view` if MCP unavailable) |
| Create PR | `mcp__github__create_pull_request` (fall back to `gh pr create`) |
| Update issue labels/state/comments | `mcp__github__update_issue`, `mcp__github__add_issue_comment` |
| List project items / get project status | `gh project item-list` (CLI — MCP does not support project boards) |
| Update project item status | `gh project item-edit` (CLI only) |

## Input handling

`$ARGUMENTS` is either:
1. An issue number (digits only) — fetch via `mcp__github__get_issue`
2. A pasted issue body — use directly. Extract the issue number from the text. If absent, ask once for the number.

## Context

- Input: $ARGUMENTS
- Repo: !`gh repo view --json nameWithOwner -q .nameWithOwner`
- Current branch: !`git branch --show-current`
- Git status: !`git status`

---

## Phase 0 — Load and Review

### Step 0.1 — Load reference material

Read `CLAUDE.md` in full before doing anything else.

### Step 0.2 — Fetch issue

Get the issue body, labels, milestone, and project board status. Print a one-paragraph summary.

### Step 0.3 — Review

Compare the issue against `CLAUDE.md`:
- Contradictions, scope drift, schema/API mismatches
- Missing detail in acceptance criteria
- Industry concerns: security, REST, error handling, idempotency, performance

Only print genuine findings.

### Step 0.4 — Work split

Classify each task:
- **Code** — what you will implement
- **Out-of-code** — what the user must handle (DNS, secrets, infrastructure, third-party setup)

Print:

> **I will handle:**
> - …
>
> **You will need to handle:**
> - … (or "Nothing")

### Step 0.5 — Upfront questions

Identify decisions that require user input before work starts:
- Vague or contradictory acceptance criteria
- Schema/API gaps
- Design choices not covered in `CLAUDE.md`
- Out-of-code tasks blocking work

Number the questions. If there are none, say so.

### Step 0.6 — Branch name and plan

Derive a branch name: `<type>/issue-<number>-<2–4 word description>` (type from the issue label: `feat`, `fix`, `chore`).

Outline a brief implementation plan: order of tasks, files likely involved, test strategy (TDD where it makes sense).

---

### --- CONDITIONAL STOP ---

**Stop here only if at least one of the following is true:**
- There are upfront questions
- There are out-of-code tasks the user must complete first
- The review found something that makes the issue unimplementable

Otherwise proceed directly to Phase 1.

---

## Phase 1 — Branch Setup

### Step 1.1 — Sync the integration branch

Read the integration branch from `CLAUDE.md` (default `main`).

```bash
git fetch origin
git checkout <integration>
git pull origin <integration>
```

### Step 1.2 — Create the feature branch

```bash
git checkout -b <branch-name> <integration>
git push -u origin <branch-name>
```

If you intend to use a worktree (e.g. to keep the main checkout untouched), create one in `/tmp/`:

```bash
git worktree add /tmp/<repo-name>-issue-<number> <branch-name>
```

If working without a worktree, you may stay on the feature branch in the main checkout. Pick whichever the project naturally supports.

### Step 1.3 — Move issue to "In Progress"

If the project board is configured in `CLAUDE.md`, update the issue's status. Skip if the board is not configured or the issue is not on it.

---

## Phase 2 — Implementation

Work through the plan. Apply these rules:

1. **Use Read / Edit / Write tools** for file changes — never `sed`, `awk`, or shell redirection.
2. **TDD where sensible** — for new logic with clear acceptance criteria, write a failing test first. For trivial changes (config, docs, small fixes), implement directly.
3. **Follow `CLAUDE.md`** — every convention listed there must be respected.
4. **Stop on genuine ambiguity** — if implementation reveals a question with no clear answer in `CLAUDE.md` or the issue, stop and ask. Do not guess on schema, contracts, or security-sensitive decisions.
5. **No silent scope expansion** — if you discover work outside the issue's scope, finish the issue's scope first, then list what else needs doing.

When implementation is complete, list the files changed and what each change does.

---

## Phase 3 — Verification

### Step 3.1 — Tests

Run the test command from `CLAUDE.md`. If tests fail, fix the implementation. If failure is unrelated to your changes (pre-existing), note it in the PR body — do not silently fix it.

### Step 3.2 — Lint, build, typecheck

Run lint, build, and typecheck per `CLAUDE.md`. Stop on any failure and resolve before proceeding.

### Step 3.3 — Acceptance criteria

For each acceptance-criteria bullet, verify the actual files and behaviours satisfy it. Print a checklist.

If any are unmet, fix before continuing. Do not open a PR with unmet acceptance criteria.

---

## Phase 4 — Documentation

Apply the `update-docs` skill inline (or call it as a sub-skill if present):
1. Update `README.md` — tick off any newly completed status items
2. Update `CHANGELOG.md` — add entries under `[Unreleased]` for this issue
3. Update `CLAUDE.md` if conventions or paths shifted (rare)
4. Create `CONTRIBUTING.md` / `SECURITY.md` if missing
5. Flag a missing `LICENSE` (do not invent one)

Commit doc changes to the same branch.

---

## Phase 5 — Commit and Push

Determine the conventional commit prefix from the issue type label:
- `type: bug` → `fix:`
- `type: technical` / `type: chore` → `chore:`
- `type: user-story` / `type: feature` → `feat:`
- default → `feat:`

Commit message format:

```
<prefix>: <short description> (#<issue-number>)
```

Stage, commit, and push:

```bash
git add <changed files>
git commit -m "<message>"
git push origin <branch-name>
```

If using a worktree:

```bash
git -C /tmp/<repo-name>-issue-<number> add <files>
git -C /tmp/<repo-name>-issue-<number> commit -m "<message>"
git -C /tmp/<repo-name>-issue-<number> push origin <branch-name>
```

---

## Phase 6 — Pre-PR Checklist

Apply the `pre-pr-checklist` skill (its content is summarised below — refer to that skill for the full list).

Confirm all of:
- All tests pass
- Lint, build, typecheck pass
- No skipped/deleted tests without explanation
- No secrets in code, commits, PR body
- `.env.example` updated for any new env var
- Documentation in sync
- All acceptance criteria met

If anything fails, fix it before continuing.

---

## Phase 7 — PR Creation

Create the PR via `mcp__github__create_pull_request` (fall back to `gh pr create`). Open as draft if your project workflow prefers it; otherwise ready.

**Title format** (per `CLAUDE.md`): default `[#<issue-number>] <short imperative description>`.

**Body:**

```markdown
## Issue
Closes #<issue-number>

## Summary
<2–3 sentences describing what changed and why>

## Acceptance criteria
<copy the checkbox list from the issue, ticked where met>

## Files changed
<bullet list, grouped by area if multi-area>

## Tests added
<description, or "No new tests — <reason>">

## Manual testing needed
<bullet list, or "None — fully covered by automated tests">

## Notes
<anything the reviewer should know — pre-existing test failures, schema changes, follow-ups>
```

---

## Phase 8 — Worktree cleanup (if used)

If a worktree was created in Phase 1:

```bash
git worktree remove /tmp/<repo-name>-issue-<number>
```

If the working tree has uncommitted changes (it shouldn't), use `--force` and warn the user.

---

## Phase 9 — Move issue to "In Review"

If the project board is configured, set the issue status to `In Review`. The board may auto-update when a PR is opened — verify, don't assume.

---

## Phase 10 — Final Summary

Print:
- Issue number and title
- Branch name
- PR URL
- Files changed
- Tests added
- Anything the user needs to manually test before approving
- Project board status

End with:

> "PR is open and ready for your review. Merge when you're happy with it."
