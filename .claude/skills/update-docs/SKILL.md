---
description: Sync README, CHANGELOG, version numbers, and standard project docs after recent changes
argument-hint: [pr-number — optional; defaults to current branch vs integration branch]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr list:*), Bash(gh issue view:*), Bash(gh issue list:*), Bash(gh milestone list:*), Bash(gh repo view:*), Bash(gh release list:*), Bash(cat:*), Bash(ls:*), mcp__claude_ai_Notion__notion-update-page
---

## Overview

Read recent changes (PR or branch diff) and update project documentation: `README.md`, `CHANGELOG.md`, version numbers, and standard docs (`CONTRIBUTING.md`, `SECURITY.md`).

This is the semi-automatic version — the agent commits doc changes itself when finished, on the assumption you'll merge the doc commit alongside the feature commits.

## Git policy

Allowed: `git add`, `git commit`, `git push origin <feature-branch>`. Forbidden: pushing to `main` or `dev`.

## Context

- Input: $ARGUMENTS
- Repo: !`gh repo view --json nameWithOwner -q .nameWithOwner`
- Current branch: !`git branch --show-current`

## Your task

### Step 1 — Load context

Read `CLAUDE.md`. Note:
- Integration branch (`dev`)
- Version file locations (see Step 5 below)
- Documentation files the project tracks

### Step 2 — Identify what changed

If `$ARGUMENTS` is a PR number:

```bash
gh pr view $ARGUMENTS --json number,title,body,baseRefName,headRefName,labels
gh pr diff $ARGUMENTS --name-only
```

Otherwise compare current branch to integration branch:

```bash
git log dev..HEAD --oneline
git diff dev..HEAD --stat
```

Summarise: features added, bugs fixed, areas touched.

### Step 3 — README

Read `README.md` in full. Update only:
- Status / feature checklist — tick newly implemented items
- Add a feature bullet only if a major user-facing capability shipped
- Remove "in development" qualifiers no longer accurate

Do not rewrite prose, do not add new sections.

### Step 4 — CHANGELOG

Use Keep a Changelog format. Create the file if missing:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
```

Add entries under `[Unreleased]` grouped by Added / Changed / Fixed / Removed / Security:
- One concise line per entry, past tense
- Reference issue number: `Fixed cooldown bug (#79)`
- No PR numbers
- Omit empty headings
- New entries at the top of `[Unreleased]`

### Step 5 — Version

This project stores the version in two places — keep them in sync:
- `frontend/package.json` — `"version"` field
- `backend/pom.xml` — `<version>` tag directly under `<artifactId>zwift-tool</artifactId>` (not the Spring Boot parent version)

Read the current version from `frontend/package.json`.

Then check the GitHub milestone associated with the completed issues to determine the target version:

```bash
gh issue list --state closed --json number,milestone --limit 50
```

The milestone title is the version number (e.g. `v1.2.0`). Strip the leading `v` when writing to files (e.g. `1.2.0`).

Determine if a bump is justified:
- **PATCH** — only Fixed entries, no new features
- **MINOR** — at least one Added entry, no breaking changes
- **MAJOR** — breaking changes

**Apply the bump only if a release is being cut** — either the milestone version is higher than the stored version, or the user has explicitly asked for a bump.

If applying the bump:
- Update `"version"` in `frontend/package.json`
- Update `<version>` in `backend/pom.xml` (plain version, e.g. `1.2.0` — not `1.2.0-SNAPSHOT`)
- Promote `[Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`
- Insert a fresh empty `[Unreleased]` block above

If not applying the bump, print:

> "Version is X.Y.Z. Based on `[Unreleased]`, the next bump should be X.Y.Z'."

### Step 6 — Standard docs

Check at the repo root and create any missing:

**`CONTRIBUTING.md`**
```markdown
# Contributing

This project is not currently open for external contributions. Issues and feedback are welcome — please open a GitHub issue.
```

**`SECURITY.md`**
```markdown
# Security

If you discover a security vulnerability in this project, please report it privately by emailing [contact@trivedev.uk](mailto:contact@trivedev.uk) rather than opening a public issue.

Do not disclose security issues publicly until they have been addressed.
```

**`LICENSE`** — the README states the project is MIT licensed but no `LICENSE` file exists. Do not create this automatically. Instead, print:

> "A `LICENSE` file is missing. The README states MIT. Create one at the repository root with your name and the current year before the next public release."

If a LICENSE file already exists, no action is needed.

### Step 7 — Update Notion Social Media Context

If a version bump was applied in Step 5:

Update the Zwift Tool Social Media Context page in Notion (page ID: `35314c40-040d-81dd-a023-ead51be6ac88`).

Update the three sections to reflect the current project state:

- **Current Status** — update the version shipped, date, and a one-line description of what it included.
- **Recent Milestones** — append a new bullet for the version just released, using the format: `vX.Y.Z shipped (DD Mon YYYY) — [what shipped]. [Content angle sentence].`
- **What's Coming Next** — update the upcoming technical features list: remove the milestone just shipped and add the next one in sequence from the GitHub project board.

Use `mcp__claude_ai_Notion__notion-update-page` with `command: update_content` to apply targeted replacements. Do not rewrite sections that are not affected.

Print: "Notion Social Media Context updated." or "Notion update skipped — no version bump."

### Step 8 — Commit doc changes

If any documentation files were modified:

```bash
git add README.md CHANGELOG.md CONTRIBUTING.md SECURITY.md frontend/package.json backend/pom.xml
git commit -m "docs: update for #<issue-number-or-pr-number>"
git push origin <current-branch>
```

If no doc files changed, skip the commit.

### Step 9 — Summary

Print:
- **README.md:** what changed, or "no changes"
- **CHANGELOG.md:** entries added
- **Version:** "no bump" or "X.Y.Z → X.Y.Z'"
- **New files:** list, or "none"
- **Action required:** any reminders (LICENSE missing, etc.)
- **Notion:** updated or skipped
- **Commit:** SHA if a commit was made, or "no doc commit needed"
