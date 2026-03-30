---
description: Full issue workflow — review, implement, check, and merge
argument-hint: <issue-number>
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(gh issue view:*), Bash(gh issue list:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git checkout:*), Bash(git merge:*), Bash(git fetch:*), Bash(git rev-list:*), Bash(git stash:*), Bash(npm run *:*), Bash(npm install:*), Bash(mvn *:*), Bash(cd *:*), Bash(gh pr *:*)
---

## Context

- Issue number: $ARGUMENTS
- Issue details: !`gh issue view $ARGUMENTS --repo Ryan-Atkinson87/zwift-tool`
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

### --- CHECKPOINT 1 ---

**Stop here.** Tell the user the review is complete and ask if they are happy to proceed to implementation, or if they want to address any findings first. Wait for their response.

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

### --- CHECKPOINT 2 ---

**Stop here.** Ask the user to confirm the plan and work split. Wait for their response before writing any code.

---

## Phase 3 — Implementation

Implement the issue according to the plan confirmed in Phase 2.

- Follow all coding conventions in `CLAUDE.md`
- Follow all project instructions in `INSTRUCTIONS_COPY.md`
- Work through the tasks in the agreed order
- If you hit a blocker or need a decision, stop and ask the user rather than guessing

When implementation is complete, print a summary of what was created or changed.

### --- CHECKPOINT 3 ---

**Stop here.** Tell the user implementation is complete and ask if they want to review anything before running final checks. Wait for their response.

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

### Step 4.5 — Commit & push

Once all checks pass:

1. Confirm the current branch is `dev`. If not, warn the user and stop.
2. Stage all changes with `git add`.
3. Determine the correct conventional commit prefix based on the issue type label:
   - `type: technical` → `chore:`
   - `type: user-story` → `feat:`
   - Default to `feat:` if unclear
4. Create a commit with the message format: `<prefix> <issue title> (#<issue number>)`
5. Push to `origin/dev`
6. **Print the full commit message so the user can see it.**

### --- CHECKPOINT 4 ---

**Stop here.** Tell the user the commit and push are complete. Show them the commit message. Ask if they are happy to proceed to merge, or if anything needs changing. Wait for their response.

---

## Phase 5 — Merge to Main

### Step 5.1 — Pre-flight checks

Verify:

1. Clean working tree (no uncommitted changes)
2. `dev` is ahead of `main`
3. Local `dev` is up to date with `origin/dev`

### Step 5.2 — Identify changed areas

Using the diff between `main` and `dev`, summarise what changed: frontend, backend, docs, config, and file counts.

### Step 5.3 — Lint & build (if not already run in Phase 4)

Skip if Phase 4 already ran these checks on the same changes. Otherwise run them.

### Step 5.4 — Merge

1. Checkout `main`
2. Merge `dev` into `main` using `git merge dev --no-ff` with the message: `merge: dev into main`
3. Print the merge commit details
4. Do NOT push automatically. Ask the user if they want to push to `origin/main`. Wait for their response.

### Step 5.5 — Sync dev with main

After the user approves the push (or declines):

1. Checkout `dev`
2. Merge `main` into `dev` with `git merge main`
3. Push `dev` to `origin/dev`

### Step 5.6 — Summary

Print a final summary:

- Issue number and title
- Number of commits merged
- Areas affected
- Whether origin/main and origin/dev are both up to date