---
description: Work through all "In Progress" GitHub issues — branch per issue, TDD, implement, draft PR to dev, move to "In Review"
argument-hint: (no arguments — issues are pulled automatically from the "In Progress" column of the Zwift Tool project)
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, Bash(gh:*), Bash(jq:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git fetch:*), Bash(git pull:*), Bash(git rev-list:*), Bash(git checkout:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git worktree:*), Bash(npm run *:*), Bash(mvn *:*), Bash(cd *:*), mcp__github__create_pull_request, mcp__github__get_issue, mcp__github__list_issues, mcp__github__get_pull_request, mcp__github__list_pull_requests, mcp__github__get_pull_request_status, mcp__github__update_issue, mcp__github__add_issue_comment
---

## Overview

This skill works through every issue currently in the "In Progress" column of the Zwift Tool GitHub project. It creates a branch and git worktree per issue, writes failing tests first (TDD), implements the solution in that worktree via a sub-agent, commits and pushes the branch, creates a draft PR to `dev`, and moves the issue to "In Review" in the project board.

Issues with no file overlap and no dependencies are executed in parallel (sub-agents run simultaneously, each in their own worktree). Issues that share files or have ordering dependencies are executed sequentially (one at a time, still using individual worktrees).

---

## Tool usage rules

The GitHub MCP server does **not** support GitHub Projects. Use tools as follows:

| Operation | Tool to use |
|-----------|-------------|
| Fetch issue details | `mcp__github__get_issue` |
| List issues | `mcp__github__list_issues` |
| Create PR | `mcp__github__create_pull_request` |
| Update issue labels/state | `mcp__github__update_issue` |
| Add issue comment | `mcp__github__add_issue_comment` |
| List project items / get project status | `gh project item-list` (CLI only — MCP does not support this) |
| Update project item status ("In Review") | `gh project item-edit` (CLI only — MCP does not support this) |
| All other `gh pr` and `gh issue` calls | Prefer MCP; fall back to CLI only if MCP lacks the specific capability |

---

## Git permissions for this skill

This skill has **full git write access** for branch management and committing. The only exception is merging into `dev` — that is done by the user via the pull requests this skill creates. Permitted operations: `checkout`, `branch`, `add`, `commit`, `push`, `worktree add`, `worktree remove`, `pull`, `fetch`.

---

## Phase 0 — Discovery and Planning

### Step 0.1 — Fetch in-progress issues

GitHub MCP does not support project board queries — use the CLI for these two calls only.

Get the project number:
```bash
gh project list --owner Ryan-Atkinson87 --format json
```

List all "In Progress" items in one call using the built-in `--jq` flag:
```bash
gh project item-list <project-number> --owner Ryan-Atkinson87 --format json --limit 100 \
  --jq '.items[] | select(.status == "In progress") | {id: .id, number: .content.number, title: .content.title}'
```

This returns only the in-progress items with their project item ID (needed later for status updates), issue number, and title.

For each in-progress issue, fetch full details using the MCP:
```
mcp__github__get_issue  repo=Ryan-Atkinson87/zwift-tool  issue_number=<number>
```

If no issues are "In Progress", tell the user and stop.

### Step 0.2 — Load reference material

Read both files in full before proceeding:
- `/internal_docs/INSTRUCTIONS_COPY.md`
- `/CLAUDE.md`

### Step 0.3 — Dependency analysis

For each issue, scan the title and body for references like "depends on #X", "blocked by #X", "requires #X", or "after #X". If any issue in the batch depends on another issue in the same batch, that dependency constrains execution order. Flag any circular dependencies and stop to ask the user how to resolve them.

### Step 0.4 — File overlap analysis and parallelism plan

For each issue, determine which source files and directories it is likely to modify, based on the issue title, description, labels, and tasks. Use Glob and Grep to inspect current structure where the issue implies specific components, services, or endpoints.

Build an overlap matrix. Two issues conflict if they are likely to modify the same file. Produce an execution plan:

- **Parallel group** — issues with no mutual file overlaps and no ordering dependencies between them; these can run simultaneously
- **Sequential queue** — issues that conflict with at least one other issue, or have an explicit dependency; these run one at a time after any parallel group completes

If all issues conflict with each other, the entire batch is sequential. If none conflict, the entire batch is parallel. Mixed batches are common: run the parallel group first, then the sequential queue.

### Step 0.5 — Identify upfront questions

For each issue, identify anything that requires a decision before work starts:

- Acceptance criteria that are vague or contradictory
- Schema or API details not covered in `INSTRUCTIONS_COPY.md`
- Out-of-code tasks the user must handle (DB migrations on hosted infrastructure, environment variables, secrets, DNS)
- Issues where the scope is ambiguous enough that guessing would risk wasted work

Collect all questions into a single numbered list. If there are none, say so.

### --- CHECKPOINT 1 — HARD STOP ---

**HALT. Do not begin any implementation work.**

Print:

1. **Issues in scope** — number and title for each
2. **Execution plan** — parallel group and sequential queue, with a brief reason for any sequential ordering
3. **Branch names** — the proposed `issue-[number]-[short-description]` name for each issue (2–4 word lowercase description derived from the issue title)
4. **Out-of-code tasks** — anything the user must handle before or alongside this run; or "None"
5. **Upfront questions** — numbered list; or "No questions — ready to begin"

Ask the user to confirm the plan and answer any questions before proceeding.

**You MUST wait for an explicit reply. Silence does not count.**

---

## Phase 1 — Branch and Worktree Setup

After the user confirms, set up every branch and worktree before any implementation begins.

### Step 1.1 — Sync dev

```bash
git fetch origin dev
git checkout dev
git pull origin dev
```

### Step 1.2 — Create and push all branches

For each issue in the batch:

```bash
git checkout -b issue-[number]-[short-description] dev
git push origin issue-[number]-[short-description]
git checkout dev
```

Confirm each branch is pushed before creating the next.

### Step 1.3 — Create all worktrees

For each issue:

```bash
git worktree add /tmp/zwift-tool-issue-[number] issue-[number]-[short-description]
```

Worktrees are placed in `/tmp/` to keep them outside the main repository directory. Confirm each is created successfully.

Print a summary:

> "Branches and worktrees created for [N] issues. Starting implementation."

---

## Phase 2 — Execute Issues

### When to use sub-agents vs. inline execution

Sub-agents have a cold-start cost — they re-read reference files and re-derive context from scratch. Only use them when there is a concrete benefit:

| Scenario | Approach |
|----------|----------|
| Parallel group (2+ non-conflicting issues) | Sub-agents — run simultaneously for speed |
| Sequential + custom agent type available (`issue-implementer`) | Sub-agent — scoped tools, right model, keeps orchestrator context clean |
| Sequential + no custom agent type (falling back to `general-purpose`) | **Inline — main agent does the work directly, no sub-agent** |

Currently, `issue-implementer` is always available, so all issues use sub-agents. If that agent is ever unavailable and the batch is entirely sequential, skip the sub-agent entirely and execute the workflow steps from the Sub-agent invocation section inline.

### Parallel execution

For issues in the parallel group, spawn all their sub-agents **simultaneously in a single call** (multiple Agent tool invocations in one message). Each sub-agent uses the `issue-implementer` type and receives the dynamic context prompt defined in the Sub-agent invocation section below.

Wait for all parallel sub-agents to complete before proceeding to the sequential queue or Phase 3. If any sub-agent reports a failure, note it and handle it in Phase 3.

### Sequential execution

For issues in the sequential queue, spawn one sub-agent at a time using the `issue-implementer` type. Wait for each to complete and succeed before spawning the next. Respect the ordering determined in Phase 0.

### Sub-agent invocation

Spawn a sub-agent of type `issue-implementer`. The agent's system prompt handles the static workflow — only pass the dynamic context below.

Prompt to pass (fill in all bracketed values):

```
Worktree: /tmp/zwift-tool-issue-[number]
Branch: issue-[number]-[short-description]

Issue #[number]: [title]
Labels: [labels]

Full issue body:
[full issue body pasted verbatim]
```

---

## Phase 3 — Cleanup and PR Creation

### Step 3.1 — Review sub-agent results

Collect the structured results from all sub-agents. For any that returned `STATUS: failed`:

1. Examine the failure reason
2. Attempt to resolve the issue directly from the main context (the worktree is still on disk)
3. If you cannot resolve it, flag it clearly in the final summary and skip PR creation for that issue — do not move it to "In Review"

### Step 3.2 — Remove all worktrees

For each issue (whether successful or not):

```bash
git worktree remove /tmp/zwift-tool-issue-[number] --force
```

Confirm each worktree is removed.

### Step 3.3 — Create draft PRs for all successful issues

For each issue where the sub-agent succeeded, create a draft PR using `mcp__github__create_pull_request`. If the MCP tool does not support `draft: true`, fall back to:

```bash
gh pr create \
  --repo Ryan-Atkinson87/zwift-tool \
  --base dev \
  --head issue-[number]-[short-description] \
  --title "<prefix> [title] (#[number])" \
  --draft \
  --body "<body>"
```

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

### Step 3.4 — Move all successful issues to "In Review"

For each issue where a PR was created, update its project status from "In Progress" to "In Review".

If the project node ID, Status field ID, and "In Review" option ID are not yet cached from Phase 0, retrieve them now:

```bash
gh project field-list <project-number> --owner Ryan-Atkinson87 --format json
gh project item-list <project-number> --owner Ryan-Atkinson87 --format json --limit 100
```

Then update each item:

```bash
gh project item-edit \
  --project-id <project-node-id> \
  --id <item-node-id> \
  --field-id <status-field-id> \
  --single-select-option-id <in-review-option-id>
```

---

## Phase 4 — Final Summary and PR Activation

### Step 4.1 — Summary table

| # | Title | Branch | PR | Status | Manual testing |
|---|-------|--------|----|--------|----------------|
| #42 | Add zone preset editor | issue-42-... | [link] | Done | Yes |
| #43 | Fix cooldown block bug | issue-43-... | [link] | Done | No |
| #44 | ... | issue-44-... | — | Failed — see below | — |

For any failed issues, print a clear explanation of what went wrong and what the user needs to do next.

### Step 4.2 — Un-draft all successful PRs

```bash
gh pr ready <pr-number> --repo Ryan-Atkinson87/zwift-tool
```

Confirm each one is successfully marked ready for review.

### Step 4.3 — Manual testing checklist

If any issue requires manual testing, print a consolidated checklist grouped by issue — one place for the user to work through when reviewing the PRs:

**#42 — Add zone preset editor**
- [ ] Open the zone preset settings panel and confirm presets load
- [ ] Edit a preset and verify it persists after reload

**#43 — Fix cooldown block bug**
- No manual testing required

If no issues require manual testing, say so.

### Step 4.4 — Done

> "All [N] issues processed: [N-x] complete with open PRs, [x] failed (see above). PRs are against `dev` and ready for your review. Successful issues have been moved to In Review on the project board."

List all PR URLs one per line.
