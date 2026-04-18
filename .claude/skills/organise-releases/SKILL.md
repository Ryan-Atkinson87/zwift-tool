---
description: Analyse all unassigned backlog issues, score them for priority and effort, fit them into open milestones or create new ones, and assign issues — all confirmed before any GitHub writes
allowed-tools: Read, Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh milestone list:*), Bash(gh milestone create:*), Bash(gh api:*), Bash(jq:*), Bash(for *:*)
---

## Overview

This skill analyses every open GitHub issue that has no milestone assigned, scores each for priority and effort, checks whether any fit into existing open milestones, groups the rest into new logical milestones with version numbers, and then — after explicit user confirmation — creates the milestones and assigns every issue. Nothing is written to GitHub until the user approves the full plan.

---

## Phase 1 — Gather data

### Step 1.1 — Fetch open milestones

```bash
gh milestone list --repo Ryan-Atkinson87/zwift-tool --state open --json number,title,description,openIssues
```

For each open milestone record:
- Milestone number, title, description
- Current open issue count (`openIssues`) — this is the current capacity load

Also fetch which issues are already assigned to each open milestone so you know what themes they contain:

```bash
gh issue list --repo Ryan-Atkinson87/zwift-tool --state open --milestone "<title>" --json number,title,labels
```

Run this for each open milestone.

### Step 1.2 — Fetch all unassigned open issues

```bash
gh issue list --repo Ryan-Atkinson87/zwift-tool --state open --no-milestone --limit 200 --json number,title,labels,body
```

For each issue, fetch the full body if not already included:

```bash
gh issue view <number> --repo Ryan-Atkinson87/zwift-tool --json number,title,labels,body,comments
```

If there are no unassigned issues, report that and stop.

---

## Phase 2 — Score every issue

For each unassigned issue, produce two ratings. Do not ask for input — derive these from the issue content.

### Priority (P1 / P2 / P3)

| Rating | Criteria |
|--------|----------|
| P1 — High | Bug that breaks existing functionality; security issue; blocks another issue; user-reported critical path problem |
| P2 — Medium | New feature with clear user value; UX improvement with broad impact; non-critical bug |
| P3 — Low | Nice-to-have enhancement; cosmetic; refactor with no user-facing change; documentation |

### Effort (S / M / L / XL)

| Rating | Criteria |
|--------|----------|
| S — Small | Single file or component change; trivial logic; < 1 day estimated |
| M — Medium | A few files; one endpoint or component added/changed; 1–2 days estimated |
| L — Large | Multiple services or components; new API surface; DB schema change; 3–5 days estimated |
| XL — Extra Large | Cross-cutting change; major new feature; auth or infrastructure change; > 5 days estimated |

### Dependency scan

For each issue, scan the title and body for phrases like:
- "depends on #X", "blocked by #X", "requires #X", "after #X", "needs #X first"

Record any cross-issue dependencies found. These constrain which milestone an issue can go into (a dependency must be in an earlier or the same milestone as the issue that needs it).

### Area detection

Identify the primary system area(s) each issue touches based on keywords, labels, and description. Use these categories:

- **auth** — login, signup, JWT, session, tokens, cookies
- **workout-editor** — canvas, intervals, bar chart, drag, resize, zone colours
- **block-library** — blocks, library, save block, replace, bulk replace
- **import-export** — .zwo parsing, file upload, section splitter, export
- **workout-management** — workout list, save, delete, metadata, autosave
- **ui-polish** — styling, accessibility, focus rings, responsive layout, error states
- **backend-api** — REST endpoints, controllers, services, repositories
- **infrastructure** — deployment, CI, environment config, database migrations

An issue may touch multiple areas — list all that apply.

---

## Phase 3 — Fit into existing milestones

For each open milestone:
1. Identify its theme from its title, description, and current issues
2. Check its current capacity (`openIssues` count)
3. For each unassigned issue: does its area and priority fit the milestone theme? Would adding it keep the milestone coherent?

**Fitting rules:**
- Only add an issue to an existing milestone if it clearly matches the milestone's theme
- Do not add an issue to a milestone that already has 8 or more open issues (risk of overloading it)
- Do not add a P1 bug to a feature-focused milestone unless it is directly related

Record which unassigned issues can fit into existing milestones. The remaining unassigned issues move to Phase 4.

---

## Phase 4 — Group remaining issues into new milestones

Take all issues not fitted into existing milestones and group them.

### Grouping principles

1. **Area cohesion** — issues touching the same area(s) belong together; a milestone that mixes unrelated areas is harder to review and test
2. **Dependency ordering** — if issue B depends on issue A, A must be in an equal or earlier milestone number. Never put B in an earlier milestone than A
3. **Priority front-loading** — within a grouping, P1 issues should appear in the earliest possible milestone; do not defer critical bugs
4. **Size balance** — aim for 4–7 issues per milestone. Fewer than 4 is too granular unless the issues are all XL effort. More than 8 is too large
5. **Logical release story** — each milestone should represent a coherent user-facing or technical capability that can be described in one sentence

### Version number assignment

Determine the next available version number by inspecting existing milestone titles. Then assign new milestones using semantic versioning:

- **Patch (x.x.X)** — all issues in the milestone are bug fixes (P1/P2 bugs with no new features)
- **Minor (x.X.0)** — milestone contains new features or UX improvements (even if it also includes bug fixes)
- **Major (X.0.0)** — milestone contains breaking API changes, major architectural changes, or a significant new system (auth overhaul, new domain concept, etc.)

Version numbers must be strictly ascending across milestones. If the current latest milestone is v1.3.0, new milestones start at v1.3.1, v1.4.0, or v2.0.0 depending on content.

---

## Phase 5 — Produce the plan

Print a full release plan for the user to review. Use this format:

---

### Existing milestones — proposed additions

For each open milestone that will receive issues:

> **v1.2.0 — [existing title]** (currently X open issues, adding Y)
> - #42 — Title | P1 | M | auth
> - #51 — Title | P2 | S | ui-polish

If no issues fit any existing milestone, write: "No unassigned issues fit existing open milestones."

---

### New milestones

For each proposed new milestone:

> **v1.3.0 — [short descriptive title]**
> *Description:* [1–2 sentences explaining the theme, what it delivers, and why these issues are grouped together]
> *Semver rationale:* [one sentence: "minor — adds new block library features"]
>
> | # | Title | Priority | Effort | Area |
> |---|-------|----------|--------|------|
> | #33 | ... | P1 | M | block-library |
> | #47 | ... | P2 | L | block-library, backend-api |
>
> *Dependencies:* [list any within-milestone or cross-milestone dependencies, or "None"]

---

### Issue scoring summary

Print a compact table of every scored issue (fitted and ungrouped):

| # | Title | Priority | Effort | Area | Assigned to |
|---|-------|----------|--------|------|-------------|
| #33 | ... | P1 | M | block-library | v1.3.0 (new) |
| #42 | ... | P1 | M | auth | v1.2.0 (existing) |

---

### --- CHECKPOINT — HARD STOP ---

**Do not create anything on GitHub yet.**

Ask the user:

> "This is the proposed release plan. Please review:
> - Issue assignments and milestone groupings
> - Version numbers and their semver rationale
> - Milestone descriptions
>
> Reply **yes** to apply this plan to GitHub, or tell me what to adjust."

**Wait for explicit confirmation. Do not proceed until the user replies.**

---

## Phase 6 — Apply to GitHub

Only run this phase after the user confirms.

### Step 6.1 — Create new milestones

For each new milestone (in ascending version order):

```bash
gh api repos/Ryan-Atkinson87/zwift-tool/milestones \
  -X POST \
  -f title="v1.3.0 — Short Title" \
  -f description="Description text here."
```

Record the returned milestone number for use in Step 6.2.

### Step 6.2 — Assign issues to milestones

For each issue in the plan — both existing-milestone fits and new milestone assignments:

```bash
gh api repos/Ryan-Atkinson87/zwift-tool/issues/<issue-number> \
  -X PATCH \
  -F milestone=<milestone-number>
```

Use the GitHub milestone number (integer), not the version string. For existing milestones, retrieve the number from the Step 1.1 output. For new milestones, use the number returned in Step 6.1.

Process all assignments. If any fail, note them and continue — do not stop the whole run.

---

## Phase 7 — Final report

Print a confirmation table:

| Milestone | Version | Issues assigned | Status |
|-----------|---------|-----------------|--------|
| v1.2.0 — Existing Title | existing | #42, #51 | Updated |
| v1.3.0 — New Title | new | #33, #47, #55, #61 | Created |

List any failures separately with their error messages.

> "Release plan applied. [N] milestones updated or created, [M] issues assigned. Review the milestones at github.com/Ryan-Atkinson87/zwift-tool/milestones."
