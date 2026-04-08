---
description: Cross-reference Notion User Stories and Technical Tasks against GitHub issues and fix any mismatches
allowed-tools: Read, Glob, Grep, Bash(gh issue *:*), mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-update-page
---

## Your Task

Cross-reference the Notion User Stories and Technical Tasks databases against GitHub issues. Find and fix any mismatches in status, missing entries, or items that exist in one system but not the other.

---

### 1. Fetch All Notion Entries

Search both Notion databases to collect every row. Use multiple semantic searches with different keywords to ensure full coverage, since each search returns at most 25 results.

- **User Stories** data source: `collection://f9775cbf-3aff-466c-bf4a-764a1cb83bd6`
- **Technical Tasks** data source: `collection://3c5e3512-b3a7-4407-a338-14e634feefff`

For every row found, fetch the page to get its properties (Title, Status, Phase, Area, Confirmed). Deduplicate by page ID across searches.

---

### 2. Fetch All GitHub Issues

Run the following to collect every issue (open and closed):

```
gh issue list --state all --limit 200 --json number,title,state,milestone,labels
```

Parse the JSON output and record the number, title, state, milestone, and labels for each issue. Use this list as the source of truth for the rest of the skill — do not call `gh` again unless you need fresh data after applying changes.

---

### 3. Build the Mapping

Match Notion rows to GitHub issues by title similarity. Not every Notion row will have a 1:1 GitHub issue (some Notion stories are merged into broader GitHub issues). Note these explicitly.

Build three lists:

**A. Matched pairs** — Notion row and its corresponding GitHub issue, with both statuses noted.

**B. Notion rows with no GitHub issue** — MVP items here may need a GitHub issue created. Future items can be noted but do not need action.

**C. GitHub issues with no Notion row** — These may need a Notion entry created.

---

### 4. Report Status Mismatches

For matched pairs, flag any status mismatch:

| Notion Status | GitHub State | Action needed |
|---|---|---|
| To Do | closed | Notion should be updated to Done |
| Done | open | Investigate — was the issue reopened? |
| In Progress | closed | Notion should be updated to Done |

Print a clear report table showing all mismatches before making changes.

---

### 5. Report Missing Entries

Print two tables:

**Notion MVP items with no GitHub issue:**
List each with its title, area, and phase. These need GitHub issues created.

**GitHub issues with no Notion row:**
List each with its number, title, milestone, and labels. Recommend whether it belongs in User Stories or Technical Tasks and suggest the Area and Phase values.

---

### 6. Present Full Report

Before making any changes, present the complete report to the user with:
- Status mismatches to fix
- Notion entries to create
- GitHub issues to create
- Any items where the mapping is ambiguous (ask the user)

---

### 7. Apply Fixes

After presenting the report, apply all fixes. Do not ask for confirmation on clear-cut corrections (status sync). Flag ambiguous cases to the user.

**Notion status updates:**
Use `notion-update-page` to set Status to "Done" for any Notion row whose matched GitHub issue is closed.

**New Notion entries:**
Use `notion-create-pages` to add rows for GitHub issues that have no Notion equivalent:
- User-facing issues go in User Stories with the appropriate Area, Phase, Status, and Confirmed values
- Technical issues go in Technical Tasks

**New GitHub issues:**
Use `gh issue create` for Notion MVP items that have no GitHub issue. Include:
- Title matching the Notion task name
- Labels derived from the Notion Area (e.g. Area: Frontend → label `area: frontend`)
- Milestone set to MVP if the Notion Phase is MVP
- Description derived from the Notion Notes field if present, otherwise write acceptance criteria based on the task title

---

### 8. Summary

Print a final summary of all changes made:
- Notion rows updated (with old → new status)
- Notion rows created (with which database)
- GitHub issues created (with issue number and URL)
- Any items flagged for user decision