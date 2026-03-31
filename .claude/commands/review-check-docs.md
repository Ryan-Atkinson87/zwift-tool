---
description: Check that all project documentation is accurate and up to date with the actual codebase
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(git log:*), Bash(git diff:*), Bash(find *:*), Bash(ls *:*), Bash(cd *:*), Bash(wc *:*), Bash(npm run *:*), Bash(mvn *:*)
---

## Context

- Current branch: !`git branch --show-current`
- Recent commits (last 20): !`git log --oneline -20`

## Your Task

Audit all project documentation against the actual codebase to find anything that is outdated, missing, or incorrect. Work through every section below methodically.

---

### 0. Discover All Documentation Files

Find all `.md` files in the project that are NOT inside `node_modules/`, `target/`, or `.claude/commands/`. These are the project-owned documentation files to audit.

Known docs at time of writing (verify these still exist and check for new ones):
- `README.md` (root)
- `CLAUDE.md` (root)
- `/internal_docs/INSTRUCTIONS_COPY.md`
- `/internal_docs/RUNBOOK.md`

Also check for any new `.md` files at the project root, `frontend/`, or `backend/` level and include those if they exist.

---

### 1. Read All Documentation Files in Full

Read every project-owned documentation file completely before checking anything. You need the full picture before you can assess accuracy.

---

### 2. Check Tech Stack and Dependencies

- Read `frontend/package.json` and `backend/pom.xml`
- Verify documented dependencies match what is actually installed
- Check Node/Java/Maven version requirements match what the project uses
- Flag any dependencies that are documented but missing, or present but undocumented

---

### 3. Check Project Structure

- Compare the documented folder structures (frontend and backend) against the actual directory layout
- Flag any directories or key files that exist but are not documented, or are documented but do not exist
- Pay special attention to the frontend file/folder structure section and backend structure section

---

### 4. Check Database Schema

- Read the actual entity classes in the backend (`models/` or `entities/` directory)
- Read any migration files or schema SQL files if they exist
- Compare against the documented schema in INSTRUCTIONS_COPY.md
- Flag any columns, tables, or constraints that differ between docs and code

---

### 5. Check API Endpoints

- Read all controller classes in the backend
- Compare the actual endpoints (method, path, request/response types) against the documented API table in INSTRUCTIONS_COPY.md
- Flag any endpoints that exist in code but are not documented, or are documented but not implemented
- Check that the public vs protected endpoint list in the auth section matches the actual SecurityConfig

---

### 6. Check Auth and Security Configuration

- Read the SecurityConfig and JWT-related classes
- Verify the documented cookie configuration, token strategy, CORS settings, and public endpoints match the implementation
- Check password validation rules match what is documented

---

### 7. Check Architecture and Infrastructure

- Verify documented URLs, DNS records, and hosting providers match any configuration in the codebase (application.properties, vite config, environment examples)
- Check CORS allowed origins match documentation
- Verify the documented local development commands actually work with the current setup

---

### 8. Check Coding Conventions

- Spot-check a few files in each area (controllers, services, components, hooks) to see if the documented conventions are being followed
- This is not a full lint, just a sanity check that the documented patterns match reality
- Flag any conventions that the codebase has clearly moved away from

---

### 9. Report Findings

Print a clear report with two sections:

**Accurate and Up to Date**
- List sections/areas that are correct (brief, one line each)

**Needs Updating**
- For each issue found, state:
  - Which file and section is affected
  - What the docs say vs what the code actually does
  - Suggested fix

---

### 10. Apply Fixes

After presenting the report, apply all fixes to both files. Make the changes directly. Do not ask for confirmation on factual corrections (things that are provably wrong based on the code). If a fix involves a judgement call or a section marked [DISCUSSION], flag it to the user instead of changing it.

After making changes, print a summary of what was updated.