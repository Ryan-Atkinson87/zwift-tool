---
description: Run pre-merge checks against main (or your integration branch) and perform the merge — asks for explicit confirmation before pushing
allowed-tools: Read, Glob, Grep, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git fetch:*), Bash(git pull:*), Bash(git rev-list:*), Bash(git checkout:*), Bash(git switch:*), Bash(git merge:*), Bash(gh repo view:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(mvn:*), Bash(./gradlew:*), Bash(pytest:*), Bash(uv:*), Bash(ruff:*), Bash(mypy:*), Bash(go:*), Bash(cargo:*), Bash(cd:*), mcp__claude_ai_Notion__notion-update-page
---

## Overview

Used in projects with a `dev` → `main` flow. Run pre-merge checks, then merge `dev` into `main` and sync `dev` back. The skill **performs** the merge (this is the semi-auto tier) but explicitly confirms with the user before each push to a protected branch.

If your project uses a single-branch flow (PRs merge directly to `main`), this skill is not for you — merge each PR directly via `gh pr merge` after review.

## Git permissions

Allowed: `git checkout`, `git fetch`, `git pull`, `git merge`, `git push origin <integration>`.
**Forbidden without confirmation:** pushing to `main`. The skill always asks before each push to a protected branch.

## Context

- Repo: !`gh repo view --json nameWithOwner -q .nameWithOwner`
- Current branch: !`git branch --show-current`
- Git status: !`git status`

## Your task

### Step 1 — Confirm the project model

Read `CLAUDE.md`. Confirm the project uses a `dev` → `main` flow. If it uses a single-branch flow, tell the user this skill does not apply and recommend using `gh pr merge` per PR.

### Step 2 — Pre-flight checks

Run the following and stop on any failure:

1. **Working tree clean** — no uncommitted changes
2. **On `dev`** — switch if not (`git checkout dev`)
3. **`dev` up to date with origin** (`git fetch origin dev`, then check `rev-list`)
4. **Commits to merge** — `git rev-list --count main..dev` > 0. If 0, tell the user there is nothing to merge and stop.

### Step 3 — Identify changed areas

Using `git diff --stat main..dev`, summarise:
- Files changed by top-level area (frontend / backend / docs / config)
- Number of commits
- Authors (first line of `git log main..dev --pretty='%an'`, deduped)

Print a summary so the user knows what is about to ship.

### Step 4 — Open PRs check

```bash
gh pr list --base dev --state open
```

If any PR is targeting `dev` and is not yet merged, warn the user. Ask whether to wait or proceed. Stop until they reply.

### Step 5 — Lint and build

Run lint and build per `CLAUDE.md`. Run only the suites for areas that changed. Stop on any failure.

### Step 6 — Tests

Run the test command per `CLAUDE.md`. Stop on any failure.

### Step 7 — Documentation check

Ask the user:

> "Have you run `/update-docs` for the changes on `dev`? It updates README, CHANGELOG, and version. Reply 'yes' (or 'not needed') to continue."

**Wait for the reply.** If they say no, stop and instruct them to run `/update-docs` first.

### Step 8 — Confirm before merge

Print:

```
About to merge:
- <N> commits
- Areas: <list>
- All checks passed: lint, build, tests
- Working tree clean

Reply 'merge' to proceed with:
  git checkout main
  git merge dev --no-ff -m "merge: dev into main"
  git push origin main
```

**Wait for explicit `merge` reply.** No proceeding on silence or anything else.

### Step 9 — Merge to main

Once confirmed:

```bash
git checkout main
git pull origin main
git merge dev --no-ff -m "merge: dev into main"
```

If the merge has conflicts, **stop**, abort the merge (`git merge --abort`), and tell the user. Do not auto-resolve conflicts — they require human judgement.

### Step 10 — Confirm before push to main

Print:

```
Merge prepared on main. About to push to origin/main.
Reply 'push' to confirm.
```

**Wait for `push` reply.** Then:

```bash
git push origin main
```

### Step 11 — Sync dev with main

```bash
git checkout dev
git merge main
git push origin dev
```

The push to `dev` does not need a separate confirmation — `dev` is the integration branch and this is a fast-forward sync.

### Step 12 — Update Notion Social Media Context

Update the Zwift Tool Social Media Context page in Notion (page ID: `35314c40-040d-81dd-a023-ead51be6ac88`).

Update the three sections to reflect the current project state:

- **Current Status** — update the version shipped, date, and a one-line description of what it included. State that the posting window is active if relevant.
- **Recent Milestones** — append a new bullet for the version just merged to main, using the format: `vX.Y.Z shipped (DD Mon YYYY) — [what shipped]. [Content angle sentence].`
- **What's Coming Next** — update the upcoming technical features list to reflect the next milestone in the GitHub project board. Remove any milestones that have now shipped and add the next one in sequence.

Use `mcp__claude_ai_Notion__notion-update-page` with `command: update_content` to apply targeted replacements. Do not rewrite sections that are not affected.

### Step 13 — Final summary

Print:
- Number of commits merged into main
- Areas affected (frontend, backend, docs, config)
- Origin state for `main` and `dev` (both up to date)
- Recommended next steps:
  - Tag the release if this completes a milestone (do it manually with `git tag -a vX.Y.Z`)
  - Update any external status pages or release notes
  - Plan the next milestone with `/plan-release`
