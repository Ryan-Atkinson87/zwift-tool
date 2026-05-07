---
description: Work through a batch of GitHub issues — branch per issue, parallel where safe, sequential where conflicting, sub-agent per issue, draft PRs, update project board
argument-hint: [milestone-name or "in-progress" or "ready" — defaults to "in-progress" on the GitHub Project board]
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, Bash(gh:*), Bash(jq:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git fetch:*), Bash(git pull:*), Bash(git rev-list:*), Bash(git checkout:*), Bash(git switch:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git worktree:*), Bash(git remote:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(npx:*), Bash(mvn:*), Bash(./gradlew:*), Bash(pytest:*), Bash(uv:*), Bash(ruff:*), Bash(mypy:*), Bash(go:*), Bash(cargo:*), Bash(cd:*), Bash(cp:*), Bash(ls:*), Bash(echo:*), mcp__github__get_issue, mcp__github__list_issues, mcp__github__create_pull_request, mcp__github__update_issue, mcp__github__add_issue_comment, mcp__github__get_pull_request, mcp__github__list_pull_requests
---

## Overview

Work through a batch of issues in one run. Each issue gets its own branch, its own worktree, and its own sub-agent. Issues without file overlap or ordering dependencies run in parallel; conflicting issues run sequentially.

Use this when:
- You have a planned set of issues you want done in one pass
- The set is small enough to plan in one prompt (typically up to 10)
- You want to batch user input — answer questions once at the start, watch the rest run

## Git permissions

Full git write access for branch management and committing. Forbidden: pushing to the integration branch (`main`/`dev`), force-push, branch deletion. The user merges PRs.

## Input handling

`$ARGUMENTS` selects the source of issues:
- A milestone name — `gh issue list --milestone "<name>"`
- `"in-progress"` (default) — issues in the "In Progress" column of the GitHub Project board
- `"ready"` — issues in the "Ready" column
- A space-separated list of issue numbers — explicit batch

If empty, default to `"in-progress"`.

---

## Phase 0 — Discovery and Planning

### Step 0.1 — Fetch issues in scope

If `$ARGUMENTS` is a milestone:

```bash
gh issue list --state open --milestone "<name>" --limit 100 --json number,title,labels,body
```

If `$ARGUMENTS` is `"in-progress"` or `"ready"` (and the project board is configured in `CLAUDE.md`):

```bash
gh project list --owner <owner> --format json
gh project item-list <project-number> --owner <owner> --format json --limit 100 \
  --jq '.items[] | select(.status == "<Status>") | {id: .id, number: .content.number, title: .content.title}'
```

Then fetch full details for each:

```
mcp__github__get_issue  repo=<owner>/<repo>  issue_number=<n>
```

If `$ARGUMENTS` is a space-separated list of numbers, fetch each.

If no issues are in scope, tell the user and stop.

### Step 0.2 — Load reference material

Read `CLAUDE.md`.

### Step 0.3 — Dependency analysis

For each issue, scan title and body for explicit dependencies (`depends on #X`, `blocked by #X`, `requires #X`, `after #X`). If any issue in the batch depends on another issue in the batch, that constrains execution order.

Flag circular dependencies and stop to ask how to resolve.

### Step 0.4 — File overlap analysis

For each issue, predict which files/directories it will modify based on title, body, labels, and a quick `Glob`/`Grep` scan. Build an overlap matrix.

Two issues conflict if they will likely modify the same file. Produce an execution plan:
- **Parallel group** — no overlap, no ordering dependency between any pair
- **Sequential queue** — has overlap or explicit dependency

If all issues conflict pairwise, the whole batch is sequential. If none conflict, all parallel.

### Step 0.5 — Upfront questions

Per issue, identify decisions that need user input before work starts:
- Vague acceptance criteria
- Schema/API gaps
- Out-of-code tasks
- Ambiguous design

Collect into a single numbered list across all issues.

### Step 0.6 — Classify by input requirement

For each issue, classify as:
- **`[auto]`** — fully automatable
- **`[needs input]`** — requires user touchpoints during the run

Apply this ordering rule:
- If the batch is *mostly auto*, schedule `[needs input]` issues **last** — let automation run first
- If the batch is *mostly needs input*, schedule `[needs input]` issues **first** — get user decisions out of the way
- Even split → default to last
- Hard dependencies trump input ordering

### --- CHECKPOINT 1 — HARD STOP ---

Print:

1. **Issues in scope** — number, title, classification
2. **Execution plan** — parallel group + sequential queue, with reasons
3. **Branch names** — proposed `<type>/issue-<n>-<short-desc>` per issue
4. **Out-of-code tasks** — anything the user must handle
5. **Upfront questions** — numbered list, or "No questions"

Ask the user to confirm and answer questions.

**You MUST wait for an explicit reply.** Silence does not count.

---

## Phase 1 — Branch and Worktree Setup

### Step 1.1 — Sync the integration branch

Read the integration branch from `CLAUDE.md` (default `main`).

```bash
git fetch origin
git checkout <integration>
git pull origin <integration>
```

### Step 1.2 — Create all branches

For each issue, create the branch **without switching HEAD**:

```bash
git branch <branch-name> <integration>
git push origin <branch-name>
```

`git branch <name> <start-point>` creates locally without checkout. Each worktree (next step) attaches to its branch independently.

### Step 1.3 — Create all worktrees

```bash
git worktree add /tmp/<repo-name>-issue-<n> <branch-name>
```

Worktrees go in `/tmp/` to keep them outside the main checkout.

Print: "Branches and worktrees created for [N] issues. Starting implementation."

---

## Phase 2 — Execute Issues

### Sub-agent approach

Use `general-purpose` sub-agents for **every** issue, parallel and sequential alike. Inline execution causes per-call permission prompts; sub-agents batch operations under the skill's `allowed-tools`.

### Parallel execution

For issues in the parallel group, spawn all their sub-agents **in a single message** with multiple `Agent` tool calls. Wait for all to complete before continuing.

### Sequential execution

For issues in the sequential queue, spawn one sub-agent at a time. Wait for each to complete and succeed before spawning the next.

### Sub-agent prompt

Pass each sub-agent a fully self-contained prompt. The sub-agent has no memory of this conversation:

```
You are implementing a GitHub issue for the <project-name> project.

Working directory: /tmp/<repo-name>-issue-<n>
Branch: <branch-name>

Issue #<n>: <title>
Labels: <labels>

Full issue body:
<paste verbatim>

Project conventions: read /tmp/<repo-name>-issue-<n>/CLAUDE.md before writing any code.

Instructions:
1. Read CLAUDE.md and any docs it references.
2. TDD where sensible — write failing tests first for new logic with clear criteria.
3. Implement against the acceptance criteria.
4. Run lint / build / typecheck / tests per CLAUDE.md from the working directory.
5. Stage, commit, and push:
   git -C /tmp/<repo-name>-issue-<n> add <files>
   git -C /tmp/<repo-name>-issue-<n> commit -m "<conventional message>"
   git -C /tmp/<repo-name>-issue-<n> push origin <branch-name>
6. Reply with:

STATUS: success | failed
BRANCH: <branch-name>
FILES CHANGED: <bullet list>
TESTS ADDED: <description, or "None — <reason>">
MANUAL TESTING NEEDED: <list, or "None">
FAILURE REASON: <if failed>
```

---

## Phase 3 — Cleanup and PR Creation

### Step 3.1 — Review sub-agent results

Collect structured results. For any `STATUS: failed`:

1. Examine the failure reason
2. Try to resolve directly from the main context — the worktree is still on disk
3. If unresolvable, flag clearly in the final summary and skip PR creation for that issue

### Step 3.2 — Remove all worktrees

```bash
git worktree remove /tmp/<repo-name>-issue-<n>
```

Do this for every issue, succeeded or not.

### Step 3.3 — Create draft PRs

For each successful issue, create a draft PR via `mcp__github__create_pull_request` (fall back to `gh pr create --draft`).

**Title:** `[#<issue-number>] <short imperative description>`

**Body:** same template as `implement-issue` Phase 7.

### Step 3.4 — Move issues to "In Review"

If the project board is configured, update each successful issue's status:

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
|---|---|---|---|---|---|
| #42 | Add zone preset editor | `feat/issue-42-...` | <link> | Done | Yes |
| #43 | Fix cooldown bug | `fix/issue-43-...` | <link> | Done | No |
| #44 | … | `feat/issue-44-...` | — | Failed — see below | — |

### Step 4.2 — Merge sequence (when overlaps exist)

If the file overlap analysis from Step 0.4 found any conflicts between issues in the batch, produce a recommended merge sequence and write it into `IMPLEMENTATION_PLAN.md` under the current milestone section.

**Rules for ordering:**

1. PRs that touch no shared files go first — they are always safe to merge in any order relative to each other.
2. Among PRs that share files, order by dependency: if PR A changes the structure of a file that PR B then adds to, merge A before B.
3. Bug fixes and isolated utility changes first — they have the smallest diff surface and rarely conflict with anything.
4. Structural / layout changes before additive changes — merge the PR that reorganises a component before the one that adds props or attributes to it.
5. PRs that touch the most shared files go last — their conflicts are cheapest to resolve once everything else has landed.

**Format to write into `IMPLEMENTATION_PLAN.md`:**

```markdown
### Merge sequence

Several PRs touch overlapping files (<list key files>). Merge in this order to minimise conflicts:

1. **[#<pr>](<url>)** — `<branch>` — <one-line reason why it is safe first>
2. **[#<pr>](<url>)** — `<branch>` — <reason>
...
```

Add this block immediately below the issue table for the current milestone. If there are no overlapping files across any PRs in the batch, skip this step entirely.

### Step 4.3 — Mark successful PRs ready

```bash
gh pr ready <pr-number>
```

For each successful PR. Skip if your project prefers PRs to stay draft until human review.

### Step 4.4 — Manual testing checklist

If any issue requires manual testing, print one consolidated checklist grouped by issue.

### Step 4.5 — Done

```
All [N] issues processed: [N-x] complete with open PRs, [x] failed.
PRs target the <integration> branch. Successful issues have been moved to In Review.

PR URLs:
- <url>
- <url>
- ...
```

Anything failed gets an explanation of what went wrong and what the user needs to do.
