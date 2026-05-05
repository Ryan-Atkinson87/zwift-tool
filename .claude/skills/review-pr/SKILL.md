---
description: Review a PR using parallel sub-agents — spec compliance, security, conventions, accessibility / responsiveness for UI changes
argument-hint: <pr-number>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr list:*), Bash(gh pr review:*), Bash(gh pr comment:*), Bash(gh pr checks:*), Bash(gh issue view:*), Bash(gh issue list:*), Bash(gh milestone list:*), Bash(gh repo view:*), Bash(git fetch:*), Bash(git checkout:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(mvn:*), Bash(./gradlew:*), Bash(pytest:*), Bash(uv:*), Bash(ruff:*), Bash(mypy:*), Bash(go:*), Bash(cargo:*), Bash(cd:*), Bash(date:*), mcp__github__get_pull_request, mcp__github__get_pull_request_files, mcp__github__get_pull_request_comments, mcp__github__get_pull_request_reviews, mcp__github__create_pull_request_review, mcp__github__add_issue_comment
---

## Overview

Run a structured review on a PR. Spawn parallel sub-agents per area (backend, frontend, security, accessibility, responsiveness), consolidate findings, and post a single review comment that classifies each finding as blocking or non-blocking.

This skill never approves or merges. It produces a review the user (or the orchestrator agent) acts on. If you want to leave the review as draft comments instead of posting, the skill will offer that at the end.

## Git policy

Read-only on `git`. The skill checks out the PR branch locally to run lint/build/typecheck. Restore to the original branch when done.

## Context

- PR: $ARGUMENTS
- Repo: !`gh repo view --json nameWithOwner -q .nameWithOwner`
- Original branch: !`git branch --show-current`

## Your task

### Step 1 — Load context

Read `CLAUDE.md` in full. Extract the production-readiness bar, any UI rules (a11y, responsive), branching model, and any boundary rules (e.g. "frontend never imports from admin").

### Step 2 — Fetch PR details

```bash
gh pr view $ARGUMENTS --json number,title,body,baseRefName,headRefName,labels,author,additions,deletions,changedFiles,milestone,url
gh pr diff $ARGUMENTS
mcp__github__get_pull_request_files  pull_number=$ARGUMENTS
```

Read the linked issue (extract from `Closes #<n>` in the PR body):

```bash
gh issue view <n>
```

Determine which areas are touched:
- Files under a backend path → backend
- Files under a frontend path → frontend
- Files under an admin/ops path → admin
- Tests / docs / config — always covered alongside the area they belong to

### Step 3 — Pre-flight: lint and typecheck

Check out the PR branch locally:

```bash
git fetch origin <head-branch>
git checkout <head-branch>
```

Run lint, build, and typecheck per `CLAUDE.md`. Any error is a **blocking** finding — record it, but continue the review (other findings may also block).

If the PR has CI configured, also fetch CI status:

```bash
gh pr checks $ARGUMENTS
```

Note any failing checks.

### Step 4 — Spawn parallel review sub-agents

Spawn the relevant sub-agents in a **single message** with multiple `Agent` tool calls. Use `subagent_type: "general-purpose"`.

| Areas changed | Sub-agents to spawn |
|---|---|
| Backend only | backend, security |
| Frontend only | frontend, security, accessibility, responsiveness |
| Admin only | admin (or frontend), security, accessibility, responsiveness |
| Multi-area | union of the above |
| Backend + frontend (no UI changes per CLAUDE.md) | backend, frontend, security |

If `CLAUDE.md` says a11y and responsiveness checks aren't relevant (e.g. CLI tool, library), skip those sub-agents.

Pass each sub-agent a self-contained prompt. The prompt includes:
- Project name and stack (from `CLAUDE.md`)
- The PR title, body, and full diff
- The linked issue's acceptance criteria
- The relevant section of `CLAUDE.md` for the sub-agent's focus area
- Explicit instructions on what to look for (see the per-agent specs below)

#### Backend reviewer prompt

```
Review the backend changes in this PR for:
- Spec compliance against the acceptance criteria
- Production-readiness bar from CLAUDE.md (validation, rate limiting, error handling, logging, env handling, no devDeps at runtime)
- Boundary rules from CLAUDE.md
- Test coverage on acceptance-criteria paths
- API contract compliance — request/response shape, status codes, auth guards, cookie behaviour

For each finding, output:
- File and line reference
- Category: blocking | non-blocking
- Brief description and required fix
```

#### Frontend reviewer prompt

```
Review the frontend changes in this PR for:
- Spec compliance — does each changed screen render the loading/empty/error/populated states?
- Production-readiness bar from CLAUDE.md (no hardcoded URLs, no token in localStorage/sessionStorage, credentials: 'include' on fetch, destructive actions confirm)
- Boundary rules — no cross-repo imports, auth state from API only
- MSW handlers updated to match endpoint shapes
- Test coverage on primary interaction paths

For each finding, output: file/line, category, description, required fix.
```

#### Security reviewer prompt

```
Review this PR for security concerns:
- Secrets handling — no credentials in code, commits, logs, or PR body
- Input validation on every user-facing input
- Auth checks on every protected route or action
- SQL injection / XSS / CSRF
- Logging — no PII or secrets in logs
- Dependency vulnerabilities introduced

For each finding: file/line, category (blocking/non-blocking), description, fix.
```

#### Accessibility reviewer prompt (UI PRs only)

```
Review the UI changes for WCAG 2.1 AA compliance:
- Keyboard navigation — every interactive element reachable
- Focus visibility on all interactive elements
- Screen reader semantics — alt text, label associations, aria-describedby for errors, heading hierarchy
- Colour contrast — 4.5:1 body, 3:1 large text and UI
- Touch targets ≥ 44×44px on mobile

Cite the WCAG criterion for each finding. Category: AA-critical (blocking), AA (non-blocking unless severe), AAA (enhancement).
```

#### Responsiveness reviewer prompt (UI PRs only)

```
Review the UI changes at:
- Mobile (375px)
- Tablet (768px)
- Desktop (1280px)

For each changed screen, check:
- No horizontal overflow at any breakpoint
- Layout transitions cleanly between breakpoints
- Tap targets meet minimum size on mobile
- Multi-column → single-column collapse on mobile
- All themes / variants render correctly at all breakpoints

For each finding: screen, breakpoint, description, severity (critical / major / minor).
```

Wait for all sub-agents to complete.

### Step 5 — Consolidate

Collect findings from all sub-agents. Group by severity:
- **Blocking** — must fix before merge
- **Non-blocking** — should fix or track as follow-up

Cross-reference findings: if two sub-agents flagged the same line, merge them into one comment to avoid noise.

For non-blocking findings worth tracking, decide whether they justify a follow-up issue. Tell the user which to track.

### Step 6 — Verdict

Determine:
- ✅ **Approve** — no blocking findings, acceptance criteria met, boundary rules observed
- 🔄 **Request changes** — one or more blocking findings
- 💬 **Comment** — non-blocking findings only, but no approval given (use sparingly)

### Step 7 — Post review

Print the consolidated review for the user to inspect first:

```markdown
## Review: PR #<n> — <title>

**Verdict:** <verdict>

**Summary:** <2-3 sentences>

### Blocking
- `<file>:<line>` — <description>. Required fix: <fix>
- ...

### Non-blocking
- `<file>:<line>` — <description>. Suggestion: <fix>
- ...

### What was done well
- <only if genuine>

**Pre-flight:** lint <pass/fail>, typecheck <pass/fail>, build <pass/fail>, CI <status>
**Areas reviewed:** <list>
**Sub-agents:** <list>
```

Ask the user:

> "Post this review to the PR? Reply 'post' to submit it as a Request Changes / Comment / Approve review, 'edit' to revise first, or 'skip' to leave it here without posting."

If they say `post`, use `mcp__github__create_pull_request_review` (or `gh pr review` as fallback) with the appropriate event type (`APPROVE`, `REQUEST_CHANGES`, `COMMENT`).

If they say `edit`, ask what to change. If `skip`, do nothing on GitHub.

### Step 8 — Restore working tree

```bash
git checkout <original-branch>
```

### Step 9 — Hand off

If the verdict was `Request changes`, recommend the implementor run `/handle-feedback <pr-number>` to action the comments.

If `Approve`, recommend the user merge the PR (this skill does not merge).

### Step 9b — Update IMPLEMENTATION_PLAN.md

If `IMPLEMENTATION_PLAN.md` exists at the project root, refresh the section(s) touched by this PR.

1. Identify the milestone for this PR's linked issue (from the `Closes #<n>` in the PR body).
2. Re-fetch all issues in that milestone to get current open/closed state:

```bash
gh issue list --state all --milestone "<title>" --json number,title,state --limit 50
```

3. Rewrite that milestone's issue table — update each issue's Status column (`Open` / `Closed`), and update the milestone-level **Status** line (count of open issues remaining).
4. Update the `_Last updated:` timestamp at the top of the file:

```bash
date +%Y-%m-%d
```

Do not touch any other milestone sections. If `IMPLEMENTATION_PLAN.md` does not exist, skip this step silently.
