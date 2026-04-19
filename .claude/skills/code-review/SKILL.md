---
description: Review either a specific PR or the full codebase for code quality, security, and conventions
argument-hint: PR <number> | FULL
allowed-tools: Read, Glob, Grep, Agent, Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh api:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(ls:*), mcp__github__get_pull_request, mcp__github__get_pull_request_files, mcp__github__get_pull_request_comments, mcp__github__get_pull_request_reviews
---

## Context

- Arguments: $ARGUMENTS
- Current branch: !`git branch --show-current`

## Your task

Parse $ARGUMENTS to determine the review mode:

- If $ARGUMENTS starts with `PR` (e.g. `PR 42`), extract the PR number and run **PR Review mode**.
- If $ARGUMENTS is `FULL`, run **Full Codebase Review mode**.
- Otherwise, print `Usage: /code-review PR <number> | FULL` and stop.

---

## Mode A — PR Review

### Step A.1 — Load reference material

Read both files before proceeding:

- `/internal_docs/INSTRUCTIONS_COPY.md`
- `/CLAUDE.md`

### Step A.2 — Fetch PR context

Fetch the PR details and the full diff:

```bash
gh pr view <number> --repo Ryan-Atkinson87/zwift-tool --json number,title,body,baseRefName,headRefName,labels,author,additions,deletions,changedFiles
gh pr diff <number> --repo Ryan-Atkinson87/zwift-tool
```

Also fetch the list of changed files:

```
mcp__github__get_pull_request_files  repo=Ryan-Atkinson87/zwift-tool  pull_number=<number>
```

Read each changed file from the working tree (not the diff) so reviewers have full context. If a file is deleted, note it but do not try to read it.

Determine which areas are touched:
- **Backend only** — all changed files are under `backend/`
- **Frontend only** — all changed files are under `frontend/`
- **Both** — files span both areas

### Step A.3 — Spawn parallel review sub-agents

Spawn the appropriate sub-agents **simultaneously in a single call** based on what areas are touched:

| Area | Agents to spawn |
|------|-----------------|
| Backend only | `code-reviewer-backend` + `code-reviewer-security` |
| Frontend only | `code-reviewer-frontend` + `code-reviewer-security` |
| Both | `code-reviewer-backend` + `code-reviewer-frontend` + `code-reviewer-security` |

**Prompt to pass to each agent** (fill in all values):

```
MODE: PR

PR #[number]: [title]
Base branch: [base]
Head branch: [head]
Labels: [labels]
Changes: +[additions] -[deletions] across [changedFiles] files

PR description:
[full PR body]

Changed files:
[list of changed file paths, one per line]

Full diff:
[paste the full gh pr diff output]

Full file contents of changed files:
[for each changed file: paste path as a heading and full content below]
```

Wait for all parallel sub-agents to complete.

### Step A.4 — Consolidate and report

Print the consolidated review report. Use the structure below. Only print sections where findings exist — skip empty sections rather than writing "No issues found."

---

## Code Review: PR #[number] — [title]

**Verdict:** [one of: Approved / Approved with comments / Changes requested]

**Summary:** [2–3 sentence summary of what the PR does and the overall quality assessment]

---

### Critical Issues
> Must be resolved before merge.

[List each critical finding. For each: filename + line reference, description of the issue, why it matters, and suggested fix.]

---

### Significant Issues
> Should be resolved before merge, but reviewer discretion applies.

[Same format as critical.]

---

### Minor Issues
> Nice-to-have improvements; do not block merge.

[Same format.]

---

### Security
[Any security-specific findings from the security reviewer, or "No security concerns identified."]

---

### Conventions
[Any convention violations (Java or TypeScript), or "Conventions followed throughout."]

---

### What was done well
[Genuine positives only — do not pad. Skip if nothing stands out.]

---

**Files reviewed:** [count]
**Reviewers:** code-reviewer-backend, code-reviewer-frontend (if applicable), code-reviewer-security

---

## Mode B — Full Codebase Review

### Step B.1 — Load reference material

Read both files before proceeding:

- `/internal_docs/INSTRUCTIONS_COPY.md`
- `/CLAUDE.md`

### Step B.2 — Codebase snapshot

Gather a high-level picture of the codebase before spawning sub-agents:

```bash
git log --oneline -20
```

List key directories to confirm structure:
- `backend/src/main/java/`
- `frontend/src/`

Read `frontend/package.json` and `backend/pom.xml` to note the dependency landscape.

### Step B.3 — Spawn parallel review sub-agents

Spawn all three sub-agents **simultaneously in a single call**:

- `code-reviewer-backend`
- `code-reviewer-frontend`
- `code-reviewer-security`

**Prompt to pass to each agent:**

```
MODE: FULL

This is a full codebase review of the Zwift Tool project.

Project: Zwift Tool — web-based workout editor for Zwift cyclists.
Stack: Spring Boot (Java 21) backend, React + TypeScript + Tailwind frontend, Neon PostgreSQL, JWT auth via HttpOnly cookies.

Recent commits (last 20):
[paste git log output]

Your focus area and specific instructions are defined in your agent system prompt.
Review everything within your focus area. Be thorough.
```

Wait for all parallel sub-agents to complete.

### Step B.4 — Consolidate and report

Print the consolidated report. Group findings by severity across all three reviewers.

---

## Full Codebase Review

**Date:** [today's date]
**Verdict:** [one of: Clean / Minor issues / Significant issues / Critical issues found]

**Executive summary:** [3–5 sentences covering the overall health of the codebase, standout strengths, and the most pressing areas to address]

---

### Critical Issues
> Must be resolved immediately.

[Each finding: file path + line reference, description, why it matters, suggested fix]

---

### Significant Issues
> Should be resolved in the near term.

[Same format.]

---

### Minor Issues
> Low-priority improvements.

[Same format.]

---

### Security
[Security-specific findings consolidated from all three reviewers. Be explicit about the attack surface and impact for each finding.]

---

### Backend: Java Conventions and Architecture

[All backend-specific findings not already listed above: Javadoc gaps, Lombok misuse, controller/service/exception pattern violations, SQL in services, etc.]

---

### Frontend: TypeScript and React Conventions

[All frontend-specific findings not already listed above: missing types, `any` usage, default exports, inline fetch calls, missing JSDoc, Tailwind violations, accessibility gaps, etc.]

---

### What is in good shape
[Areas of the codebase that are well-written. Be specific — name files or patterns. Do not pad.]

---

### Recommended priorities

1. [Most important thing to fix and why]
2. [Second most important]
3. [Third most important]
(Add more only if genuinely distinct and important)

---

**Reviewers:** code-reviewer-backend, code-reviewer-frontend, code-reviewer-security
