---
description: Apply revisions listed in RUNBOOK.md to GitHub issues and update the runbook when done
allowed-tools: Read, Edit, Bash(gh issue view:*), Bash(gh issue edit:*)
---

## Context

- Runbook: !`cat /Users/ryanthomasatkinson/Projects/zwift-tool/internal_docs/RUNBOOK.md`

## Your task

Work through each step in order. Print a heading for each one.

---

### Step 1 — Load reference material

Read both of the following files before proceeding:

- `/internal_docs/INSTRUCTIONS_COPY.md` — confirmed architecture, schema, domain model, API contracts, auth strategy
- `/CLAUDE.md` — coding conventions for both the Java backend and the React/TypeScript frontend

---

### Step 2 — Parse the revision list

Read the **"Issues requiring revision before work begins"** section of the runbook above.

Build a working list of every issue that requires a change. For each one, record:
- Issue number
- Title
- The specific change described in the runbook

If the section says "None — all issues are ready to implement.", stop here and tell the user there is nothing to do.

---

### Step 3 — Re-review each issue before editing

For each issue in your list, fetch its full current body:

```
gh issue view <number> --repo Ryan-Atkinson87/zwift-tool
```

Re-read the issue carefully against `INSTRUCTIONS_COPY.md` and `CLAUDE.md`. Do not assume the runbook's description of the problem is complete — verify it yourself and look for anything else that needs fixing in the same issue while you have it open.

For each issue, produce a compact review:
- Confirm the problem identified in the runbook is still present
- Note any additional problems found during re-review
- State the full set of changes that need to be made to the issue body

If a problem has already been fixed in the issue (it no longer matches the runbook description), note that and skip the edit for that problem.

---

### Step 4 — Edit each issue

For each issue that still needs changes, construct the corrected issue body by applying all identified changes from Step 3.

Rules for editing:
- Make only the changes identified — do not rewrite, restructure, or expand sections that are correct
- Preserve all existing formatting, headings, task lists, and acceptance criteria that are not being changed
- Where removing a line, remove cleanly without leaving blank lines that break the structure
- Where adding or rewording, match the tone and style of the existing issue body

Apply the edit using:

```
gh issue edit <number> --repo Ryan-Atkinson87/zwift-tool --body "<corrected body>"
```

After each edit, fetch the issue again to confirm the change was applied correctly:

```
gh issue view <number> --repo Ryan-Atkinson87/zwift-tool
```

Print a confirmation for each issue: what was changed and whether the edit was verified.

---

### Step 5 — Update RUNBOOK.md

Once all edits are complete, open `/internal_docs/RUNBOOK.md` and update the **"Issues requiring revision before work begins"** section to reflect the current state:

- If all issues have been resolved, replace the section body with: `None — all issues are ready to implement.`
- If any issues still have outstanding problems that could not be resolved in this run (e.g. requiring input from the issue author), list only those remaining items with a note on what is blocking them

Do not change any other part of RUNBOOK.md.

---

### Step 6 — Summary

Print a brief summary:
- How many issues were reviewed
- How many were edited
- What changes were made to each
- The current state of the "Issues requiring revision" section in RUNBOOK.md