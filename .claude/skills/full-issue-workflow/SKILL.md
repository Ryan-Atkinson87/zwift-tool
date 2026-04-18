---
description: Full issue workflow — review, implement, check, and merge
argument-hint: <issue-number or pasted issue description>
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(gh issue view:*), Bash(gh issue list:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git fetch:*), Bash(git rev-list:*), Bash(npm run *:*), Bash(npm install:*), Bash(mvn *:*), Bash(cd *:*), Bash(gh pr *:*)
---

## Git handling

The user handles all git write operations themselves (add, commit, push, merge, checkout). This skill only ever reads git state and prints commit messages or merge commands for the user to copy. Never run git write commands. Never walk the user through git commands step by step — they know how git works.

## Input handling

The argument can be either:

1. **An issue number** (e.g. `42`) — fetch issue details from GitHub using `gh issue view`
2. **A pasted issue description** (multi-line text containing the issue title, description, tasks, acceptance criteria, etc.) — use the pasted content directly as the issue details

To determine which: if `$ARGUMENTS` is a single number (digits only), treat it as an issue number and fetch from GitHub. Otherwise, treat it as a pasted issue description.

When the input is a pasted description, extract the issue number from the text if present (e.g. from a `#42` reference or a title like `Issue #42`). If no issue number can be found in the pasted text, ask the user for the issue number — it is needed for the commit message in Phase 4.

## Context

- Input: $ARGUMENTS
- Issue details (if issue number): fetch using `gh issue view <number> --repo Ryan-Atkinson87/zwift-tool` if the input is a plain number; otherwise use the pasted text directly as the issue description
- Current branch: !`git branch --show-current`
- Git status: !`git status`

## Your task

You are running a full issue workflow: review, implement, check, and merge. Work through each phase in order. **You must stop and wait for the user to confirm before moving to the next phase.** Do not proceed past a checkpoint without explicit user approval.

---

## Phase 1 — Initial Review

Review the issue against project instructions, coding conventions, and industry standards.

### Step 1.1 — Load reference material

Read both of the following files before proceeding. Do not skip this step.

- `/internal_docs/INSTRUCTIONS_COPY.md` — project instructions
- `/CLAUDE.md` — coding conventions

### Step 1.2 — Issue summary

Print a one-paragraph summary of what the issue is asking for. Include the issue number, title, area labels, and type label.

### Step 1.3 — Review against project instructions

Compare the issue content against `INSTRUCTIONS_COPY.md`. Check for contradictions, scope drift, missing context, schema/API mismatches, and domain model alignment. Print only genuine findings.

### Step 1.4 — Review against coding conventions

Compare the issue's implied implementation against `CLAUDE.md` conventions. Check backend and/or frontend conventions as relevant. Print only genuine findings.

### Step 1.5 — Review against industry standards

Assess security, REST design, data integrity, error handling, idempotency, and performance. Print only genuine concerns.

### Step 1.6 — Summary verdict

Print a verdict: **Ready to implement**, **Minor concerns**, or **Needs revision**. List any action items.

### --- CHECKPOINT 1 — HARD STOP ---

**HALT. Do not continue. Do not begin Phase 2. Do not write any code.**

Tell the user the review is complete. Ask whether they want to proceed to implementation or address any findings first.

You MUST wait for an explicit reply from the user before doing anything further. A reply of "yes", "proceed", "looks good", or similar counts. Silence does not count. Proceeding automatically past this point is a violation of the workflow.

---

## Phase 2 — Start Work

### Step 2.1 — Check current state

Report the current branch and whether there are uncommitted changes. If there are uncommitted changes, warn the user and ask if they want to continue.

### Step 2.2 — Determine work type

Analyse the issue tasks and acceptance criteria. Classify each task as:

- **Code work** — changes to source files that you will implement
- **Out-of-code work** — things the user needs to do manually (e.g. environment config, external service setup, DNS changes, database migrations on hosted infrastructure, deployment config)

Print a clear split:

> **I will handle:**
> - (list of code tasks)
>
> **You will need to handle:**
> - (list of out-of-code tasks, or "Nothing — this is all code work")

### Step 2.3 — Implementation plan

Based on the issue tasks and project instructions, print a suggested implementation order. Note any relevant existing files or structure.

### --- CHECKPOINT 2 — HARD STOP ---

**HALT. Do not continue. Do not write any code. Do not edit any files.**

Ask the user to confirm the plan and work split. Explicitly tell them: "Reply to confirm the plan and I will begin implementation."

You MUST wait for an explicit reply before writing a single line of code. Proceeding automatically past this point is a violation of the workflow.

---

## Phase 3 — Implementation

Implement the issue according to the plan confirmed in Phase 2.

- Follow all coding conventions in `CLAUDE.md`
- Follow all project instructions in `INSTRUCTIONS_COPY.md`
- Work through the tasks in the agreed order
- If you hit a blocker or need a decision, stop and ask the user rather than guessing

When implementation is complete, print a summary of what was created or changed.

### --- CHECKPOINT 3 — HARD STOP ---

**HALT. Do not continue. Do not run any checks. Do not run lint, build, or tests.**

Tell the user implementation is complete. List what was created or changed. Ask whether they want to review anything before you run the final checks.

You MUST wait for an explicit reply before proceeding to Phase 4. Proceeding automatically past this point is a violation of the workflow.

---

## Phase 4 — Final Check

### Step 4.1 — Acceptance criteria check

Read the acceptance criteria from the issue. For each criterion, check the actual files and changes to determine if it is met. Print a checklist:

- ✅ criterion — if met
- ❌ criterion — if not met, with a brief reason

If any criteria are not met, stop and tell the user what still needs to be done.

### Step 4.2 — Docs & instructions check

Read `/internal_docs/INSTRUCTIONS_COPY.md` and `CLAUDE.md` in full. Check whether either needs updating based on the changes made. Update them if needed. Print what was checked and what (if anything) was updated.

### Step 4.3 — Lint & build

Run checks based on which areas were changed:

- If `frontend/` was changed: run `npm run lint` then `npm run build` from the `frontend/` directory
- If `backend/` was changed: run `mvn verify -q` from the `backend/` directory

If any check fails, stop and report.

### Step 4.4 — Tests

Run tests based on which areas were changed:

- If `frontend/` was changed: run `npm test -- --run` from the `frontend/` directory (skip if no test files exist)
- If `backend/` was changed: run `mvn test` from the `backend/` directory (skip if no test files exist)

If tests fail, stop and report.

### Step 4.5 — Hand off commit message

Once all checks pass, confirm the current branch is `dev` (warn and stop if not). Determine the conventional commit prefix from the issue type label:

- `type: technical` → `chore:`
- `type: user-story` → `feat:`
- Default to `feat:` if unclear

Print the changed file list and the commit message in the format `<prefix> <issue title> (#<issue number>)`. Nothing else — no git command walkthrough.

### --- CHECKPOINT 4 — HARD STOP ---

**HALT. Do not continue. Do not begin Phase 5.**

Tell the user: the commit message and file list are above. Reply once you have committed and pushed and I will move to Phase 5.

You MUST wait for an explicit confirmation from the user that they have committed and pushed before proceeding. Proceeding automatically past this point is a violation of the workflow.

---

## Phase 4b — Update Documentation

Before considering a merge, documentation should reflect the completed work.

Ask the user:

> "Have you run `/update-documentation` for this issue? If not, run it now — it updates README.md and CHANGELOG.md and checks for any missing standard docs. Reply once that is done (or confirm it is not needed for this issue)."

**HALT. You MUST wait for an explicit reply before proceeding to Phase 5. Proceeding automatically past this point is a violation of the workflow.**

---

## Phase 5 — Merge to Main (conditional)

### Step 5.1 — Check whether to merge

Merging to main only happens at the **end of a runbook block**, not after every issue. Before doing anything else in this phase, ask the user:

> "Is this the final issue of the current runbook block? If yes, I'll run the merge-to-main checks. If no, we're done — the changes will stay on `dev` until the block is complete."

**HALT. You MUST wait for an explicit reply before doing anything else in this phase.** If they say no (or there is no active runbook), skip to Step 5.5 and note that merge was deferred. If they say yes, continue with Step 5.2.

### Step 5.2 — Pre-flight checks

Verify:

1. Clean working tree (no uncommitted changes)
2. `dev` is ahead of `main`
3. Local `dev` is up to date with `origin/dev`

### Step 5.3 — Identify changed areas

Using the diff between `main` and `dev`, summarise what changed across the whole runbook block: frontend, backend, docs, config, and file counts.

### Step 5.4 — Hand off merge to user

Print the merge and dev-sync commands for the user to copy. Do not walk them through each one.

```
git checkout main
git merge dev --no-ff -m "merge: dev into main"
git push origin main

git checkout dev
git merge main
git push origin dev
```

### Step 5.5 — Summary

Print a final summary:

- Issue number and title
- Whether the merge happened or was deferred (and why)
- Areas affected by this issue
- Current state of `origin/dev` and (if merged) `origin/main`
