---
description: Read current PR or branch changes and update README.md, CHANGELOG.md, and other project documentation
argument-hint: <pr-number or leave blank to use current branch vs dev>
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git status:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(gh issue view:*)
---

## Overview

This skill reads the changes in a PR or branch and updates project documentation to reflect the current state of the codebase. Run this before merging any PR into `dev`, and before merging `dev` into `main`.

## Context

- Input: $ARGUMENTS (PR number, or blank to use current branch diff against dev)
- Current branch: !`git branch --show-current`
- Recent commits on this branch vs dev: !`git log dev...HEAD --oneline 2>/dev/null || git log --oneline -10`

---

## Your task

Work through each step below in order. Print a clear heading for each section.

---

### Step 1 — Identify what changed

If `$ARGUMENTS` is a PR number, fetch the PR details:

```bash
gh pr view $ARGUMENTS --repo Ryan-Atkinson87/zwift-tool
```

Then get the full file diff:

```bash
gh pr diff $ARGUMENTS --repo Ryan-Atkinson87/zwift-tool --name-only
```

If no argument is given, use the diff between the current branch and `dev`:

```bash
git diff dev...HEAD --stat
git log dev...HEAD --oneline
```

Print a summary of what changed: which features were added, which bugs were fixed, and which areas were touched (frontend, backend, config, docs). This summary drives the documentation updates in the steps below.

---

### Step 2 — Update README.md

Read the current `README.md` in full.

Compare the **Status** section checklist against what is now actually implemented in the codebase. Inspect the source files as needed to verify.

For each checklist item:
- Mark `[x]` if the feature is now implemented
- Leave `[ ]` if not yet implemented
- Add new items only if the change introduced a significant user-facing feature not yet listed

Keep the README minimal. Do not add new sections, change the prose, or expand descriptions beyond what is there. Only:
- Update the status checklist
- Add a new feature bullet to "Core Features" if the PR introduced a major user-facing capability
- Remove the *(in development)* qualifier from the live URL only when the product is publicly launched

Print: what was changed in README.md, or "No changes needed."

---

### Step 3 — Update CHANGELOG.md

The CHANGELOG follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

If `CHANGELOG.md` does not exist, create it with this header:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
```

Add entries under `[Unreleased]` for the current changes. Group entries under the appropriate heading:

- **Added** — new features
- **Changed** — changes to existing functionality
- **Fixed** — bug fixes
- **Removed** — removed features or files
- **Security** — security fixes

Rules:
- Each entry is one concise line, written in past tense
- Reference the issue number in parentheses where relevant: `Fixed NullPointerException in workout delete when warm-up is absent (#79)`
- Do not reference PR numbers or branch names — issue numbers only
- If a heading has no entries for this change set, omit it
- Insert the new entries at the top of the existing `[Unreleased]` block

Do not create a versioned release entry (e.g. `## [1.0.0]`). Versioned releases are a separate, deliberate action. Always add to `[Unreleased]`.

Print: the CHANGELOG entries added.

---

### Step 4 — Check for missing standard documentation

Check whether the following files exist at the repository root. Create any that are missing.

#### CONTRIBUTING.md

If missing, create it:

```markdown
# Contributing

This project is not currently open for external contributions. Issues and feedback are welcome — please open a GitHub issue.
```

#### SECURITY.md

If missing, create it:

```markdown
# Security

If you discover a security vulnerability in this project, please report it privately by emailing [contact@trivedev.uk](mailto:contact@trivedev.uk) rather than opening a public issue.

Do not disclose security issues publicly until they have been addressed.
```

#### LICENSE

The README states the project is MIT licensed, but no `LICENSE` file exists. **Do not create this automatically.** Instead, print a reminder:

> "A `LICENSE` file is missing. The README states MIT. Create one at the repository root with your name and the current year before the next public release."

If the LICENSE file already exists, no action is needed.

---

### Step 5 — Summary

Print a final summary:

- **README.md**: what changed, or "no changes needed"
- **CHANGELOG.md**: list of entries added
- **New files created**: list any new files (CONTRIBUTING.md, SECURITY.md), or "none"
- **Action required**: list anything that needs manual action (e.g. LICENSE file), or "none"

Once this skill completes, the documentation changes should be staged and committed alongside or separately from the feature changes before merging.
