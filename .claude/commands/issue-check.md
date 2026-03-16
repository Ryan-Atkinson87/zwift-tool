---
description: Run end-of-issue checks, commit, and push for a given issue number
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git branch:*), Bash(git log:*), Bash(gh issue view:*), Bash(npm run *:*), Bash(mvn *:*)
---

## Context

- Issue number: $ARGUMENTS
- Current branch: !`git branch --show-current`
- Git status: !`git status`
- Staged and unstaged changes: !`git diff HEAD`
- Recent commits: !`git log --oneline -5`
- Issue details: !`gh issue view $ARGUMENTS --repo Ryan-Atkinson87/zwift-tool`

## Your task

Work through each step below in order. Print a clear heading for each section.

### 1. Acceptance Criteria Check

Read the acceptance criteria from the issue details above. For each criterion, check the actual files and changes to determine if it is met. Print a checklist:
- ✅ criterion — if met
- ❌ criterion — if not met, with a brief reason

If any criteria are not met, stop here and tell the user what still needs to be done before proceeding.

### 2. Docs & README Check

Review the changes made and assess whether any of the following need creating or updating:
- `README.md` (root or subdirectory)
- `CLAUDE.md` — update if the issue changes architecture, introduces new commands/scripts, or establishes patterns future Claude instances should know about
- Any other documentation files

Print what was checked and what (if anything) was updated.

### 3. Lint & Build

Run the relevant checks based on which areas were changed:

- If `frontend/` was changed: run `npm run lint` then `npm run build` from the `frontend/` directory
- If `backend/` was changed: run `mvn verify` from the `backend/` directory

Print the result of each check. If any check fails, stop here and tell the user what needs fixing before proceeding.

### 4. Tests

Run any tests relevant to the areas changed:

- If `frontend/` was changed: run `npm test -- --run` from the `frontend/` directory (skip if no test files exist yet)
- If `backend/` was changed: run `mvn test` from the `backend/` directory (skip if no test files exist yet)

Print results. If tests fail, stop and report before proceeding.

### 5. Commit & Push

Once all checks above pass:

1. Confirm the current branch is `dev`. If not, warn the user and stop.
2. Stage all changes with `git add`.
3. Determine the correct conventional commit prefix based on the issue type label:
   - `type: technical` → `chore:`
   - `type: user-story` → `feat:`
   - Default to `feat:` if unclear
4. Create a commit with the message format: `<prefix> <short description> (#<issue number>)`
   - The short description should be concise (under 60 chars) and match the issue title
   - Example: `feat: scaffold frontend React/Vite/TS/Tailwind (#1)`
5. Push to `origin/dev`

Print the final commit message and confirm the push succeeded.