---
description: Run pre-merge checks for dev to main, then hand off merge to user
allowed-tools: Read, Glob, Grep, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git fetch:*), Bash(git rev-list:*), Bash(npm run *:*), Bash(mvn *:*), Bash(cd *:*), Bash(gh pr *:*)
---

## Context

- Current branch: !`git branch --show-current`
- Git status: !`git status`
- Dev branch log (last 10): !`git log --oneline dev -10`
- Main branch log (last 5): !`git log --oneline main -5`
- Changes dev has over main: !`git log --oneline main..dev`
- File diff summary: !`git diff --stat main..dev`

## Your task

Merge the `dev` branch into `main` after running all relevant checks. Work through each step in order. Print a clear heading for each section. If any step fails, stop and report before proceeding.

### 1. Pre-flight Checks

Before anything else, verify:

1. **Clean working tree**: There must be no uncommitted changes. If there are, stop and tell the user to commit or stash first.
2. **Commits to merge**: Check that `dev` is ahead of `main`. If there are no new commits, stop and tell the user there is nothing to merge.
3. **Remote sync**: Fetch from origin and check that the local `dev` branch is up to date with `origin/dev`. If behind, warn the user and stop.

Print what was checked and the result.

### 2. Identify Changed Areas

Using the diff between `main` and `dev`, determine which areas of the project were changed:

- **Frontend changed**: any files under `frontend/`
- **Backend changed**: any files under `backend/`
- **Docs changed**: `CLAUDE.md`, `README.md`, or files under `internal_docs/`
- **Config changed**: CI/CD, database scripts, or other infrastructure files

Print a summary of what changed and how many files were affected in each area.

### 3. Lint & Build

Run checks based on the areas that changed:

- If `frontend/` was changed: run `npm run lint` then `npm run build` from the `frontend/` directory
- If `backend/` was changed: run `mvn verify -q` from the `backend/` directory

If no frontend or backend files changed, skip this step and note that.

Print the result of each check. If any check fails, stop here and tell the user what needs fixing.

### 4. Tests

Run tests based on the areas that changed:

- If `frontend/` was changed: run `npm test -- --run` from the `frontend/` directory (skip if no test script is defined in package.json)
- If `backend/` was changed: run `mvn test` from the `backend/` directory (skip if no test files exist beyond the smoke test)

Print results. If tests fail, stop and report.

### 5. Hand Off Merge to User

Once all checks pass, do NOT run git checkout, git merge, or git push yourself. Tell the user to run:

```
git checkout main
git merge dev --no-ff -m "merge: dev into main"
git push origin main
```

### 6. Hand Off Dev Sync to User

Tell the user to sync dev with main:

```
git checkout dev
git merge main
git push origin dev
```

This keeps `dev` in sync with `main` so that future work starts from a clean base.

### 7. Summary

Once the user confirms the merge and sync are done, print a final summary:

- Number of commits merged
- Areas affected (frontend, backend, docs, config)
- Whether origin/main and origin/dev are both up to date

### Future: Merge Restrictions

This section is a placeholder for future merge restrictions. Currently there are none, but the following may be added:

- Required CI checks passing
- Required code review approvals
- Branch protection rules
- Changelog or version bump requirements

When restrictions are added, enforce them in step 1 (Pre-flight Checks) before proceeding.