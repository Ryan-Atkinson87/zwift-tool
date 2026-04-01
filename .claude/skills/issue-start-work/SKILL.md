---
description: Start working on an issue — shows in-progress issues if none provided
argument-hint: [issue-number]
allowed-tools: Read, Glob, Grep, Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(gh issue view:*), Bash(gh issue list:*)
---

## Context

- Provided issue number: $ARGUMENTS
- Current branch: !`git branch --show-current`
- Git status: !`git status`
- In-progress issues: !`gh issue list --repo Ryan-Atkinson87/zwift-tool --state open --json number,title,assignees,labels,milestone --template '{{range .}}#{{.number}}\t{{.title}}\t[{{range .labels}}{{.name}} {{end}}]\n{{end}}'`

## Your task

### Step 1 — Identify the issue

If no issue number was provided ($ARGUMENTS is empty), print the in-progress issues list above in a clean table and ask the user which issue they want to start. Stop and wait for their response before continuing.

Otherwise proceed with issue $ARGUMENTS.

Fetch the full issue details:
!`gh issue view $ARGUMENTS --repo Ryan-Atkinson87/zwift-tool`

### Step 2 — Summarise the issue

Print a brief summary:
- **Title** and **number**
- **Labels** (area, type)
- **Milestone**
- **Tasks** — bullet list from the issue body
- **Acceptance criteria** — bullet list from the issue body

### Step 3 — Check current state

- Report the current branch and whether there are any uncommitted changes
- If there are uncommitted changes, warn the user and ask if they want to continue

### Step 4 — Check project instructions

Read `/internal_docs/INSTRUCTIONS_COPY.md`. Look for any content relevant to the issue (domain model, schema, architecture decisions, conventions). Call out anything directly useful for implementation — for example, table definitions if the issue involves the database, or API contracts if it involves endpoints.

### Step 5 — Confirm ready to start

Tell the user:
- Which area(s) will be affected (frontend / backend / both) based on the issue labels
- Any relevant existing files or structure to be aware of (check the repo for related directories/files)
- A suggested implementation order based on the tasks listed in the issue

Ask the user to confirm they're ready to start, or if they have any questions before diving in.