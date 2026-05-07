---
description: Review a specific PR or the full codebase for quality, security, conventions, and architecture
argument-hint: PR <number> | FULL
allowed-tools: Read, Glob, Grep, Agent, Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr list:*), Bash(gh repo view:*), Bash(gh api:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(ls:*), Bash(find . -name:*), mcp__github__get_pull_request, mcp__github__get_pull_request_files
---

## Overview

Two modes:
- **PR Review** — review a specific PR with parallel sub-agents
- **Full Codebase Review** — audit the whole repo for quality, security, and convention drift

Both modes consolidate findings into a single report grouped by severity.

This skill differs from `review-pr`: it produces a long-form analysis written to your terminal (and optionally to a file), not a posted PR review. Use this for periodic audits or for a deeper look at a complex PR.

## Git policy

Read-only.

## Context

- Arguments: $ARGUMENTS
- Repo: !`gh repo view --json nameWithOwner -q .nameWithOwner`
- Current branch: !`git branch --show-current`

## Your task

Parse `$ARGUMENTS`:
- Starts with `PR ` (e.g. `PR 42`) → **Mode A: PR Review**
- Equals `FULL` → **Mode B: Full Codebase Review**
- Otherwise: print `Usage: /code-review PR <number> | FULL` and stop

---

## Mode A — PR Review

### Step A.1 — Load reference material

Read both files in full before proceeding:
- `CLAUDE.md`
- `/internal_docs/INSTRUCTIONS_COPY.md`

### Step A.2 — Fetch PR

```bash
gh pr view <number> --json number,title,body,baseRefName,headRefName,labels,author,additions,deletions,changedFiles
gh pr diff <number>
mcp__github__get_pull_request_files  pull_number=<number>
```

Read every changed file from the working tree (not just the diff) so reviewers have full context. Skip deleted files.

Determine areas touched (backend / frontend / docs / config).

### Step A.3 — Spawn parallel review sub-agents

Spawn specialized sub-agents in a **single message**:

| Areas changed | Sub-agents |
|---|---|
| Backend only | `code-reviewer-backend`, `code-reviewer-security` |
| Frontend only | `code-reviewer-frontend`, `code-reviewer-security` |
| Both | `code-reviewer-backend`, `code-reviewer-frontend`, `code-reviewer-security` |
| Docs / config only | `code-reviewer-backend` (conventions), `code-reviewer-security` |

Pass each sub-agent a fully-self-contained prompt:

```
MODE: PR

PR #<number>: <title>
Base: <base>  Head: <head>
Labels: <labels>
+<adds> -<dels> across <count> files

PR description:
<body>

Changed files:
<paths, one per line>

Full diff:
<paste gh pr diff>

Full file contents (post-change):
<for each file: path heading + content>

Project conventions: <paste relevant section of CLAUDE.md>

Your focus is <backend / frontend / security / conventions>. Look for:
<focus-specific bullet list>
```

Wait for all sub-agents to complete.

### Step A.4 — Consolidate report

Print:

```markdown
## Code Review: PR #<n> — <title>

**Verdict:** Approved | Approved with comments | Changes requested

**Summary:** <2–3 sentences>

### Critical Issues
> Must be resolved before merge.
- `<file>:<line>` — <description>. Why it matters: <reason>. Fix: <fix>

### Significant Issues
> Should be resolved before merge; reviewer discretion.
- ...

### Minor Issues
> Nice-to-have improvements.
- ...

### Security
<security-specific findings, or "No security concerns identified.">

### Conventions
<convention violations, or "Conventions followed throughout.">

### What was done well
<genuine positives only — skip if nothing stands out>

**Files reviewed:** <count>
**Sub-agents:** <list>
```

Skip empty sections — don't write "No issues found".

---

## Mode B — Full Codebase Review

### Step B.1 — Load reference material

Read both files in full before proceeding:
- `CLAUDE.md`
- `/internal_docs/INSTRUCTIONS_COPY.md`

### Step B.2 — Codebase snapshot

```bash
git log --oneline -20
```

List key directories:
- Top-level layout (`ls`)
- `backend/src/main/java/`
- `frontend/src/`

Read `frontend/package.json` and `backend/pom.xml` to note the dependency landscape.

### Step B.3 — Spawn parallel review sub-agents

Spawn three specialized sub-agents in a single message:
- `code-reviewer-backend`
- `code-reviewer-frontend`
- `code-reviewer-security`

Pass each a fully-self-contained prompt:

```
MODE: FULL

Project: Zwift Tool — web-based workout editor for Zwift cyclists.
Stack: Spring Boot (Java 21) backend, React + TypeScript + Tailwind frontend, Neon PostgreSQL, JWT auth via HttpOnly cookies.

Recent commits (last 20):
<git log output>

CLAUDE.md (full):
<paste>

INSTRUCTIONS_COPY.md (full):
<paste>

Your focus is <backend / frontend / security>. Audit the whole repo within your area.
Be thorough — read actual source files, don't rely only on the diff.
```

Each sub-agent does its own `Read`/`Glob`/`Grep` to navigate the codebase.

### Step B.4 — Consolidate report

```markdown
## Full Codebase Review

**Date:** <today>
**Verdict:** Clean | Minor issues | Significant issues | Critical issues found

**Executive summary:** <3–5 sentences on overall health, strengths, most pressing areas>

### Critical Issues
- ...

### Significant Issues
- ...

### Minor Issues
- ...

### Security
<consolidated security findings — be explicit about attack surface and impact>

### Backend: Java Conventions and Architecture
<all backend findings not already listed above>

### Frontend: TypeScript and React Conventions
<all frontend findings not already listed above>

### What is in good shape
<specific, named files or patterns — no padding>

### Recommended priorities
1. <most important>
2. <second>
3. <third>

**Sub-agents:** code-reviewer-backend, code-reviewer-frontend, code-reviewer-security
```

### Step B.5 — Save (optional)

Ask the user:

> "Save this review as `internal_docs/code-review-<date>.md` for future reference? Reply 'save' or 'skip'."

If they say save, write the file. Otherwise leave the report in the terminal only.
