---
description: Score backlog issues, group into milestones, apply on GitHub after explicit user confirmation
argument-hint: (no arguments — analyses all unassigned open issues)
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh milestone list:*), Bash(gh milestone create:*), Bash(gh repo view:*), Bash(gh api repos/*:*), Bash(jq:*), Bash(date:*)
---

## Overview

Analyse every open GitHub issue with no milestone assigned. Score for priority and effort, fit into existing milestones where possible, group the rest into new milestones with semver version numbers, present the plan, and — only after explicit user confirmation — create the milestones and assign every issue.

## Git/GitHub policy

The skill uses `gh issue edit` and `gh api` to write to GitHub, but **only after the user confirms the full plan**. Nothing on GitHub changes before the checkpoint.

## Context

- Repo: !`gh repo view --json nameWithOwner -q .nameWithOwner`

## Your task

---

## Phase 1 — Gather

### Step 1.1 — Existing milestones

```bash
gh milestone list --state open --json number,title,description,openIssues
```

For each open milestone, also fetch its current issues to understand its theme:

```bash
gh issue list --state open --milestone "<title>" --json number,title,labels --limit 50
```

### Step 1.2 — Unassigned issues

```bash
gh issue list --state open --no-milestone --limit 200 --json number,title,labels,body
```

For any issue with a truncated body, fetch the full body via `gh issue view <n>`.

If no unassigned issues, tell the user and stop.

---

## Phase 2 — Score

For each unassigned issue, derive (do not ask):

**Priority — P1 / P2 / P3**

| Rating | Criteria |
|---|---|
| P1 | Bug breaking existing functionality; security; blocks another issue; user-reported critical |
| P2 | New feature with clear value; non-critical bug |
| P3 | Nice-to-have; cosmetic; refactor with no user-facing change |

**Effort — S / M / L / XL**

| Rating | Criteria |
|---|---|
| S | Single file or trivial change — under 1 day |
| M | A few files; one endpoint or component — 1–2 days |
| L | Multiple services/components; new API surface; schema change — 3–5 days |
| XL | Cross-cutting; major new feature; auth/infra — over 5 days |

**Dependencies** — scan for `depends on #X`, `blocked by #X`, `requires #X`, `after #X`.

**Areas** — derive from labels and content keywords. List all that apply.

---

## Phase 3 — Fit into existing milestones

For each open milestone, identify its theme and current load. For each unassigned issue, decide whether it fits:

- Theme match — issue's areas align with milestone's existing theme
- Capacity — milestone has fewer than 8 open issues
- Priority — do not put a P1 bug into a feature milestone unless directly related

Record fits. Remaining issues go to Phase 4.

---

## Phase 4 — Group remaining issues into new milestones

Apply these rules:

1. **Area cohesion** — issues touching the same area belong together
2. **Dependency ordering** — A before B in version number if B depends on A
3. **Priority front-loading** — P1 issues in the earliest possible milestone
4. **Size balance** — 4–7 issues per milestone; up to 8 if same area
5. **Logical story** — each milestone describes a coherent capability in one sentence

### Version assignment

Read the latest existing milestone version (parse from titles like `v1.3.0`). Assign new milestones using semver:
- **Patch (vX.Y.Z+1)** — all issues are bugs
- **Minor (vX.Y+1.0)** — at least one new feature
- **Major (vX+1.0.0)** — breaking changes / major architectural shift

Versions must strictly increase across new milestones.

---

## Phase 5 — Plan

Print the plan:

```markdown
### Existing milestones — proposed additions

> **v1.2.0 — <title>** (currently <X> open, adding <Y>)
> - #42 — <title> | P1 | M | <areas>
> - #51 — <title> | P2 | S | <areas>

(or "No issues fit existing open milestones.")

---

### New milestones

> **v1.3.0 — <descriptive title>**
> *Description:* <1–2 sentences>
> *Semver rationale:* <one sentence — minor / patch / major and why>
>
> | # | Title | Priority | Effort | Areas |
> |---|---|---|---|---|
> | #33 | ... | P1 | M | ... |
> | #47 | ... | P2 | L | ... |
>
> *Dependencies:* <within-milestone or cross-milestone>; or "None"

---

### Issue scoring summary

| # | Title | Priority | Effort | Areas | Assigned to |
|---|---|---|---|---|---|
| #33 | ... | P1 | M | ... | v1.3.0 (new) |
| #42 | ... | P1 | M | ... | v1.2.0 (existing) |

---

### IMPLEMENTATION_PLAN.md preview

Also render the full `IMPLEMENTATION_PLAN.md` that will be written after confirmation. List every open milestone in version order (dependency-blocked milestones after their prerequisites). For each milestone, include all issues currently assigned to it — not just the new ones.

```markdown
# Implementation Plan

_Last updated: <date>_

This document reflects the current milestone plan. It is regenerated by `/plan-release` and updated by `/review-pr` after each PR review.

---

## v1.2.0 — <title>

**Description:** <from milestone>
**Status:** In Progress — <X> of <Y> issues open

| # | Title | Priority | Effort | Status |
|---|---|---|---|---|
| #42 | ... | P1 | M | Open |
| #51 | ... | P2 | S | Open |

---

## v1.3.0 — <title>

**Description:** <from milestone>
**Status:** Not started — <N> issues
**Dependencies:** Requires v1.2.0

| # | Title | Priority | Effort | Status |
|---|---|---|---|---|
| #33 | ... | P1 | M | Open |
| #47 | ... | P2 | L | Open |
```
```

---

### --- CHECKPOINT — HARD STOP ---

> "This is the proposed plan. Reply 'apply' to write it to GitHub, or tell me what to adjust. Nothing has been changed yet."

**Do not proceed without an explicit `apply`.** No silent confirmation, no auto-confirm.

---

## Phase 6 — Apply

Only after user confirms.

### Step 6.1 — Create new milestones

For each new milestone, in ascending version order:

```bash
gh api repos/<owner>/<repo>/milestones \
  -X POST \
  -f title="vX.Y.Z — Short Title" \
  -f description="<description>"
```

Record the returned milestone number for the next step.

### Step 6.2 — Assign issues

For each issue in the plan (existing-milestone fits and new-milestone assignments):

```bash
gh issue edit <n> --milestone "<milestone title>"
```

Process all assignments. If any fail, note them and continue — do not abort the whole run on a single failure.

### Step 6.3 — (Optional) Update project board

If the project board is configured in `CLAUDE.md`, set each newly assigned issue's status to `Backlog`. Skip if not configured.

### Step 6.4 — Write IMPLEMENTATION_PLAN.md

Write (or overwrite) `IMPLEMENTATION_PLAN.md` at the project root.

List every open milestone in version order. For each milestone, fetch all currently assigned issues:

```bash
gh issue list --state all --milestone "<title>" --json number,title,labels,state --limit 50
```

Use the current date for the timestamp:

```bash
date +%Y-%m-%d
```

File format:

```markdown
# Implementation Plan

_Last updated: <date>_

This document reflects the current milestone plan. It is regenerated by `/plan-release` and updated by `/review-pr` after each PR review.

---

## v1.2.0 — <title>

**Description:** <from milestone>
**Status:** In Progress — <X> of <Y> issues open

| # | Title | Priority | Effort | Status |
|---|---|---|---|---|
| #42 | ... | P1 | M | Open |
| #51 | ... | P2 | S | Closed |

---

## v1.3.0 — <title>

**Description:** <from milestone>
**Status:** Not started — <N> issues
**Dependencies:** Requires v1.2.0

| # | Title | Priority | Effort | Status |
|---|---|---|---|---|
| #33 | ... | P1 | M | Open |
| #47 | ... | P2 | L | Open |
```

Priority and Effort come from the scoring derived in Phase 2. For issues already in existing milestones (not newly scored), leave Priority and Effort as `—` unless they were scored in this run.

---

## Phase 7 — Final report

```markdown
| Milestone | Type | Issues assigned | Status |
|---|---|---|---|
| v1.2.0 — Existing | existing | #42, #51 | Updated |
| v1.3.0 — New | new | #33, #47, #55, #61 | Created |
```

List any failures separately with their error messages.

> "Plan applied. <N> milestones updated/created, <M> issues assigned. Review at github.com/<owner>/<repo>/milestones."

Recommend next step:

> "Start the first milestone with `/implement-issue` for any issue in it, or `/implement-multiple-issues <milestone-name>` to work through several at once."
