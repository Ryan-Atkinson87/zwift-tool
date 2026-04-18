---
description: Fully automatic single-issue workflow — review, branch, implement (TDD), verify, commit, push, and raise PR. Stops only when genuine user input is required.
argument-hint: <issue-number or pasted issue description>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, Bash(gh:*), Bash(jq:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git fetch:*), Bash(git pull:*), Bash(git rev-list:*), Bash(git checkout:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git worktree:*), Bash(npm run *:*), Bash(mvn *:*), Bash(cd *:*), mcp__github__create_pull_request, mcp__github__get_issue, mcp__github__list_issues, mcp__github__get_pull_request, mcp__github__list_pull_requests, mcp__github__get_pull_request_status, mcp__github__update_issue, mcp__github__add_issue_comment
---

## Overview

This skill runs a full single-issue workflow end-to-end with no manual checkpoints, unless genuine user input is required (design choices not covered by the issue, ambiguous acceptance criteria, out-of-code tasks, or implementation blockers). The user's only action is to review and merge the pull request this skill creates.

## Git permissions

This skill has **full git write access**: `checkout`, `branch`, `add`, `commit`, `push`, `worktree add`, `worktree remove`, `pull`, `fetch`. It creates its own feature branch from `dev`, commits, pushes, and raises a PR. The user merges the PR into `dev`.

## Tool usage rules

| Operation | Tool to use |
|-----------|-------------|
| Fetch issue details | `mcp__github__get_issue` |
| Create PR | `mcp__github__create_pull_request` |
| Update issue labels/state | `mcp__github__update_issue` |
| Add issue comment | `mcp__github__add_issue_comment` |
| List project items / get project status | `gh project item-list` (CLI — MCP does not support this) |
| Update project item status | `gh project item-edit` (CLI — MCP does not support this) |
| All other `gh pr` and `gh issue` calls | Prefer MCP; fall back to CLI only if MCP lacks the capability |

---

## Input handling

The argument can be either:

1. **An issue number** (e.g. `42`) — fetch issue details from GitHub using `mcp__github__get_issue`
2. **A pasted issue description** — use the content directly

To determine which: if `$ARGUMENTS` is a single number (digits only), treat it as an issue number. Otherwise treat it as a pasted description and extract the issue number from the text if present. If no number is found in a pasted description, ask for it — it is needed for the branch name and commit message.

- Input: $ARGUMENTS
- Current branch: !`git branch --show-current`
- Git status: !`git status`

---

## Phase 0 — Load and Review

### Step 0.1 — Load reference material

Read both files in full before proceeding:
- `/internal_docs/INSTRUCTIONS_COPY.md`
- `/CLAUDE.md`

### Step 0.2 — Fetch issue

If the input is an issue number, fetch using `mcp__github__get_issue` for repo `Ryan-Atkinson87/zwift-tool`. Print a one-paragraph summary: issue number, title, area labels, type label, and what it is asking for.

### Step 0.3 — Review against project instructions

Compare the issue against `INSTRUCTIONS_COPY.md`. Check for contradictions, scope drift, schema/API mismatches, and domain model alignment. Print only genuine findings.

### Step 0.4 — Review against coding conventions

Compare the issue's implied implementation against `CLAUDE.md`. Check backend and/or frontend conventions as relevant. Print only genuine findings.

### Step 0.5 — Review against industry standards

Assess security, REST design, data integrity, error handling, idempotency, and performance. Print only genuine concerns.

### Step 0.6 — Work split

Classify each task in the issue as:

- **Code work** — changes you will implement
- **Out-of-code work** — things the user must handle (environment config, external service setup, DNS, database migrations on hosted infrastructure, deployment config)

Print clearly:

> **I will handle:**
> - (list of code tasks)
>
> **You will need to handle (before or during this run):**
> - (list of out-of-code tasks, or "Nothing — this is all code work")

### Step 0.7 — Upfront questions

Identify anything that requires a user decision before work starts:

- Acceptance criteria that are vague or contradictory
- Schema or API details not covered in `INSTRUCTIONS_COPY.md`
- Design choices where guessing would risk significant wasted work
- Scope that is ambiguous enough to cause major rework

Collect all questions into a numbered list. If there are none, say so.

### Step 0.8 — Propose branch name and plan

Derive a branch name: `issue-[number]-[short-description]` (2–4 word lowercase description from the issue title).

Print a brief implementation plan: the order you will tackle tasks, and which source files or layers are likely to be involved.

---

### --- CONDITIONAL STOP ---

**Only stop here if at least one of the following is true:**

- There are upfront questions that require a user decision
- There are out-of-code tasks the user must complete before implementation can begin
- The review found something that makes the issue unimplementable as written

If any of those apply: **HALT. Print all questions and blockers in a single message. Do not begin Phase 1 until the user replies.**

If none apply: proceed directly to Phase 1 without pausing.

---

## Phase 1 — Branch and Worktree Setup

### Step 1.1 — Sync dev

```bash
git fetch origin dev
git checkout dev
git pull origin dev
```

### Step 1.2 — Create and push branch

```bash
git checkout -b issue-[number]-[short-description] dev
git push origin issue-[number]-[short-description]
git checkout dev
```

### Step 1.3 — Create worktree

```bash
git worktree add /tmp/zwift-tool-issue-[number] issue-[number]-[short-description]
```

Confirm the worktree is created successfully before continuing.

---

## Phase 2 — Implementation

Spawn a sub-agent of type `issue-implementer`. Pass it the following dynamic context (fill in all bracketed values):

```
Worktree: /tmp/zwift-tool-issue-[number]
Branch: issue-[number]-[short-description]

Issue #[number]: [title]
Labels: [labels]

Full issue body:
[full issue body pasted verbatim]
```

Wait for the sub-agent to complete. If it returns `STATUS: failed`, examine the failure reason and attempt to resolve it directly (the worktree is still on disk). If you cannot resolve it, skip to Phase 4 and report the failure clearly.

---

## Phase 3 — Worktree Cleanup

Remove the worktree:

```bash
git worktree remove /tmp/zwift-tool-issue-[number] --force
```

---

## Phase 4 — PR Creation and Board Update

### Step 4.1 — Create PR

If the sub-agent succeeded, create a PR using `mcp__github__create_pull_request`. If the MCP tool does not support `draft: true`, fall back to:

```bash
gh pr create \
  --repo Ryan-Atkinson87/zwift-tool \
  --base dev \
  --head issue-[number]-[short-description] \
  --title "<prefix> [title] (#[number])" \
  --body "<body>"
```

Determine the commit prefix from issue labels:
- `type: technical` → `chore:`
- `type: user-story` → `feat:`
- Default: `feat:`

**PR body:**

```
## Issue
Closes #[number] — [title]

## What was done
[2–5 bullet points from the sub-agent's FILES CHANGED and implementation summary]

## Tests added
[Content from sub-agent's TESTS ADDED field, or "No automated tests added — [reason]"]

## Needs manual testing
[Content from sub-agent's MANUAL TESTING NEEDED field, or "None — fully covered by automated tests"]

## Areas affected
**[frontend / backend / both]** — [brief description of affected components, endpoints, or services]
```

### Step 4.2 — Move issue to "In Review"

If a PR was created, update the issue's project status from "In Progress" to "In Review".

Get the project number and field IDs if not already known:

```bash
gh project list --owner Ryan-Atkinson87 --format json
gh project field-list <project-number> --owner Ryan-Atkinson87 --format json
gh project item-list <project-number> --owner Ryan-Atkinson87 --format json --limit 100
```

Then update the item:

```bash
gh project item-edit \
  --project-id <project-node-id> \
  --id <item-node-id> \
  --field-id <status-field-id> \
  --single-select-option-id <in-review-option-id>
```

If the issue is not on the project board, skip this step.

---

## Phase 5 — Final Summary

Print a summary covering:

- Issue number and title
- Branch name
- PR URL (or failure reason)
- Files changed (from sub-agent report)
- Tests added (from sub-agent report)
- Any manual testing the user needs to do before approving the PR
- Current project board status

If implementation failed, print a clear explanation of what went wrong and what the user needs to do next.

> "PR is open against `dev` and ready for your review. Merge when you're happy with it."
