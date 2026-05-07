---
description: Triage and action review feedback on a PR — implement fixes, retest, re-request review
argument-hint: <pr-number>
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr comment:*), Bash(gh pr edit:*), Bash(gh pr ready:*), Bash(gh pr list:*), Bash(gh pr review:*), Bash(gh issue view:*), Bash(gh issue comment:*), Bash(gh repo view:*), Bash(git fetch:*), Bash(git checkout:*), Bash(git switch:*), Bash(git pull:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(mvn:*), Bash(./gradlew:*), Bash(pytest:*), Bash(uv:*), Bash(ruff:*), Bash(mypy:*), Bash(go:*), Bash(cargo:*), Bash(cd:*), mcp__github__get_pull_request, mcp__github__get_pull_request_comments, mcp__github__get_pull_request_reviews, mcp__github__add_issue_comment
---

## Overview

Action the comments on a PR review. Triage every comment, implement fixes, run the test suite, and re-request review.

## Git permissions

Full git write on the PR's feature branch. Forbidden: pushing to the integration branch, force-push, branch deletion.

## Context

- PR: $ARGUMENTS
- Repo: !`gh repo view --json nameWithOwner -q .nameWithOwner`
- Current branch: !`git branch --show-current`

## Your task

### Step 1 — Load context

Read `CLAUDE.md`. Fetch the PR and its linked issue:

```bash
gh pr view $ARGUMENTS --json number,title,body,baseRefName,headRefName,state,labels
gh issue view <linked-issue>
```

Check out the PR branch:

```bash
git fetch origin <head-branch>
git checkout <head-branch>
git pull origin <head-branch>
```

### Step 2 — Read all feedback in full

Fetch every comment on the PR (including review comments and general comments):

```
mcp__github__get_pull_request_comments  pull_number=$ARGUMENTS
mcp__github__get_pull_request_reviews   pull_number=$ARGUMENTS
```

Also fetch comments on the linked issue if any:

```bash
gh issue view <linked-issue> --json comments
```

**Read every comment before actioning anything.** Earlier comments may be superseded by later ones.

### Step 3 — Triage

Classify each comment into one of:

| Category | Definition |
|---|---|
| `bug` | Something is broken or fails the acceptance criteria |
| `change-request` | Behaviour works but needs to change per spec or reviewer instruction |
| `question` | Reviewer asking for clarification, not requesting a change |
| `wont-fix` | Acknowledged and explicitly decided not to act on (per existing convention or previous decision) |
| `already-resolved` | Fixed by another comment's action or a later commit |

Print the triage table before doing anything else:

| Comment | Category | Plan |
|---|---|---|
| <link> | bug | Fix `path/to/file.ts:42` to handle null case |
| <link> | question | Reply: <one-line answer> |
| <link> | change-request | Update endpoint signature to add `cursor` param |

### Step 4 — Action each comment

**`bug` and `change-request`:**
- Verify against the acceptance criteria and `CLAUDE.md`
- If a requested change conflicts with the project conventions, do not implement it — flag the conflict in a reply and tag the reviewer
- Otherwise implement the fix
- After fixing, reply to the comment with what was changed and the commit reference

**`question`:**
- Reply directly with a clear answer
- If the answer reveals a gap in the implementation, treat it as a `bug` or `change-request` accordingly

**`wont-fix`:**
- Reply acknowledging and stating the reason
- Tag the reviewer if the decision needs sign-off

**`already-resolved`:**
- Reply confirming, with a reference to the resolving commit or comment

### Step 5 — Retest

Run the full test command from `CLAUDE.md`. Then run lint, build, and typecheck.

Do not push until everything passes. If a fix breaks something else, keep iterating in the same context — multiple commits on the same branch are fine.

### Step 6 — Commit and push

Stage and commit the fixes. Use a conventional message:

```
fix: address review feedback on PR #<number>
```

Or, if the changes are scoped to a particular concern:

```
fix: <specific concern> (#<issue-number>)
```

Push to the PR branch:

```bash
git push origin <head-branch>
```

### Step 7 — Resolution summary

Post a single summary comment on the PR:

```markdown
## Feedback resolution

| Comment | Category | Resolution |
|---|---|---|
| <link> | bug | Fixed in `<commit>`: <one-line description> |
| <link> | change-request | Implemented in `<commit>`: <description> |
| <link> | question | Answered in reply |
| <link> | wont-fix | <reason> |
| <link> | already-resolved | Resolved in `<commit>` |

Tests: <pass/fail summary>
Lint / build / typecheck: <status>

Re-requesting review.
```

Use `gh pr comment $ARGUMENTS --body "<the comment>"` or `mcp__github__add_issue_comment`.

### Step 8 — Move issue to "In Review"

If the project board has an `In Review` column and the issue moved out of it during feedback, move it back. Skip if not configured.

### Step 9 — Re-request review

Use `gh pr edit $ARGUMENTS --add-reviewer <reviewer>` if the original reviewer should be re-pinged. Otherwise leave a comment asking for re-review.

If the PR was marked draft during feedback handling, mark it ready:

```bash
gh pr ready $ARGUMENTS
```

### Step 10 — Final summary

Print:
- PR number and title
- Number of comments actioned per category
- Tests / lint / build status
- New commit(s) added
- Status of the PR (re-requested review / awaiting CI / ready)
