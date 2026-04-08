---
description: Run end-of-issue checks and prepare for commit
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(git status:*), Bash(git diff:*), Bash(git branch:*), Bash(git log:*), Bash(git fetch:*), Bash(git rev-list:*), Bash(gh issue view:*), Bash(npm run *:*), Bash(mvn *:*), Bash(cd *:*)
---

## Git handling

The user handles all git write operations themselves (add, commit, push, merge, checkout). This skill only ever reads git state and prints commit messages or merge commands for the user to copy. Never run git write commands. Never walk the user through git commands step by step — they know how git works.

## Context

- Issue number: $ARGUMENTS
- Current branch: !`git branch --show-current`
- Git status: !`git status`
- Staged and unstaged changes: !`git diff HEAD`
- Recent commits: !`git log --oneline -5`
- Issue details: !`gh issue view $ARGUMENTS --repo Ryan-Atkinson87/zwift-tool`

## Your task

Work through each step below in order. Print a clear heading for each section.

### 1. Acceptance Criteria Check

Read the acceptance criteria from the issue details above. For each criterion, check the actual files and changes to determine if it is met. Print a checklist:
- ✅ criterion — if met
- ❌ criterion — if not met, with a brief reason

If any criteria are not met, stop here and tell the user what still needs to be done before proceeding.

### 2. Docs & Instructions Check

Read `/internal_docs/INSTRUCTIONS_COPY.md` and `CLAUDE.md` in full before assessing. Then check whether any of the following need creating or updating:
- `README.md` (root or subdirectory)
- `CLAUDE.md` — update if the issue changes architecture, introduces new commands/scripts, or establishes patterns future Claude instances should know about
- `/internal_docs/INSTRUCTIONS_COPY.md` — update if the issue changes anything it describes: schema, domain model, architecture decisions, API contracts, or conventions. Keep it accurate and current. Do not assume it is already up to date — read it and verify line by line against the changes made.
- Any other documentation files

Print what was checked and what (if anything) was updated.

### 3. Lint & Build

Run the relevant checks based on which areas were changed:

- If `frontend/` was changed: run `npm run lint` then `npm run build` from the `frontend/` directory
- If `backend/` was changed: run `mvn verify` from the `backend/` directory

Print the result of each check. If any check fails, stop here and tell the user what needs fixing before proceeding.

### 4. Tests

Run any tests relevant to the areas changed:

- If `frontend/` was changed: run `npm test -- --run` from the `frontend/` directory (skip if no test files exist yet)
- If `backend/` was changed: run `mvn test` from the `backend/` directory (skip if no test files exist yet)

Print results. If tests fail, stop and report before proceeding.

### 5. Hand Off Commit Message

Once all checks above pass, confirm the current branch is `dev` (warn and stop if not). Determine the conventional commit prefix from the issue type label:

- `type: technical` → `chore:`
- `type: user-story` → `feat:`
- Default to `feat:` if unclear

Print the changed file list and the commit message in the format `<prefix> <short description> (#<issue number>)`. Nothing else — no git command walkthrough.

**Stop here.** Wait for the user to confirm they have committed and pushed before continuing.

### 6. Merge to Main (conditional)

Merging to main only happens at the **end of a runbook block**, not after every issue. Ask the user:

> "Is this the final issue of the current runbook block? If yes, I'll run the merge-to-main checks. If no, we're done — the changes will stay on `dev` until the block is complete."

**Wait for their response.** If they say no (or there is no active runbook), print a brief final summary noting that merge was deferred and stop. If they say yes, continue below.

Run pre-flight checks:

1. Clean working tree (no uncommitted changes)
2. `dev` is ahead of `main`
3. Local `dev` is up to date with `origin/dev`

Summarise what changed across the whole runbook block (frontend, backend, docs, config, file counts) using the diff between `main` and `dev`.

Print the merge and dev-sync commands for the user to copy:

```
git checkout main
git merge dev --no-ff -m "merge: dev into main"
git push origin main

git checkout dev
git merge main
git push origin dev
```
