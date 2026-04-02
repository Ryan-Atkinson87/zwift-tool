---
description: Review "Next Release" issues, analyse them, and produce a grouped runbook in /internal_docs/RUNBOOK.md
allowed-tools: Read, Glob, Grep, Write, Bash(gh project item-list:*), Bash(gh issue view:*)
---

## Context

- Next Release issues: !`gh project item-list 2 --owner Ryan-Atkinson87 --format json --limit 100 --jq '.items[] | select(.status == "Next Release") | {number: .content.number, title: .title, labels: .labels}'`

## Your task

Work through each step in order. Print a heading for each one.

---

### Step 1 — Load reference material

Read both of the following files before proceeding. Do not skip this step.

- `/internal_docs/INSTRUCTIONS_COPY.md` — confirmed architecture, schema, domain model, API contracts, auth strategy
- `/CLAUDE.md` — coding conventions for both the Java backend and the React/TypeScript frontend

---

### Step 2 — Fetch all "Next Release" issues

"Next Release" is a status column on the GitHub Projects kanban board (project number 2, owner Ryan-Atkinson87). The issues are listed in the context above. If no issues were found, report that and stop.

For each issue, fetch its full body:
`gh issue view <number> --repo Ryan-Atkinson87/zwift-tool`

Build a working list of all issues with: number, title, labels, and a one-sentence summary of what is being asked for.

---

### Step 3 — Review each issue

For each issue, perform a focused review. Do not write this out as a separate section for each issue — compile findings into a single table or compact list. For each issue note:

- Any contradiction with `INSTRUCTIONS_COPY.md` (schema, API contracts, domain model, architecture)
- Any acceptance criteria that would violate coding conventions in `CLAUDE.md`
- Any obvious missing error cases, security gaps, or REST design issues
- Whether the issue is **ready**, has **minor concerns**, or **needs revision**

If an issue needs revision, state the specific change required in one sentence.

---

### Step 4 — Identify dependencies and natural groupings

Analyse the full set of issues and identify:

- Which issues have hard dependencies (issue B cannot be started until issue A is done)
- Which issues touch the same area (same backend service, same frontend feature, same database table) and would be better worked together
- Which issues are independent and can be parallelised

Use this analysis to group the issues into **exactly 3 milestone groups**. Each group should represent a coherent unit of work that can be completed and then reviewed before the next group begins. Group 1 should contain the foundational or blocking work; Group 3 should contain the most dependent or polish work.

---

### Step 5 — Write the runbook

Write the file `/internal_docs/RUNBOOK.md` using the structure below. Replace all placeholder text.

The runbook must:
- Open with a brief (2-3 sentence) description of what this release delivers to the user
- List any issues that need revision before work begins, with the specific change needed
- Present the 3 groups clearly with their rationale
- For each issue in each group, include the issue number, title, a one-line summary of the work, and the key acceptance criteria as a checklist

Use this exact structure:

```markdown
# Release Runbook

## What this release delivers

<2-3 sentence description of the user-facing value being shipped>

---

## Issues requiring revision before work begins

<List any issues flagged as "needs revision" in Step 3, with the specific change needed. If none, write "None — all issues are ready to implement.">

---

## Group 1 — <descriptive group name>

**Rationale:** <one sentence explaining why these issues form a group and why they come first>

### #<number> — <title>

<one-line summary of the work>

Acceptance criteria:
- [ ] <criterion 1>
- [ ] <criterion 2>
...

<repeat for each issue in this group>

---

## Group 2 — <descriptive group name>

**Rationale:** <one sentence>

<repeat issue format>

---

## Group 3 — <descriptive group name>

**Rationale:** <one sentence>

<repeat issue format>

---

## Review checkpoint

After each group is complete, review the following before starting the next group:

- All acceptance criteria checked off for every issue in the group
- No regressions in related areas
- Code reviewed against conventions in CLAUDE.md
```

---

### Step 6 — Confirm

Report that `RUNBOOK.md` has been written. Print the full path. List the issues included in each group as a brief summary so the user can confirm the grouping makes sense before they begin.