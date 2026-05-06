# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Instructions

Full project instructions, including database schema, domain model detail, and API contracts, are maintained in `/internal_docs/INSTRUCTIONS_COPY.md`. Read this file when starting any issue or when you need context beyond what is in this file.

## Project Overview

Zwift Tool is a web-based workout editor for Zwift cyclists. It parses `.zwo` files (Zwift's XML workout format), lets users edit intervals, and manages a block library for reusing sections (warm-up, main set, cool-down) across multiple workouts in bulk.

## Local Development

Requirements: Node 20+, Java 21, Maven

```bash
# Frontend (localhost:5173)
cd frontend
npm install
npm run dev

# Backend (localhost:8080)
cd backend
export $(grep -v '^#' .env | xargs) && mvn spring-boot:run
```

Backend requires a `.env` file — copy `backend/.env.example` and fill in all values (DB credentials, JWT secret, CORS origin, cookie settings). Environment variables are loaded into the shell before Maven runs; Spring Boot resolves them directly via `${DB_URL}` etc. in `application.properties`.

## Git Workflow

Claude must not run git write commands (`git add`, `git commit`, `git push`, `git merge`, `git checkout`, `git stash`, `git rebase`) unless a skill explicitly instructs Claude to handle git operations as part of its workflow. Read-only commands are always permitted: `git status`, `git diff`, `git log`, `git branch`, `git fetch`, `git rev-list`.

### Branch and PR rules

- Feature branches are named `<type>/issue-<number>-<short-description>` (type: `feat`, `fix`, `chore`) and branch from `dev` — e.g. `feat/issue-42-zone-preset-editor`
- All PRs target the `dev` branch — never `main`
- The user reviews and merges PRs to `dev`
- `main` is promoted from `dev` exclusively via the `/merge-to-main` skill, which asks for explicit confirmation before each push to a protected branch

When implementation is complete and no skill has taken over git, Claude provides the commit message and list of changed files for the user to stage, commit, and push.

## GitHub Integration

- **PR base branch:** `dev` — all feature PRs target `dev`, never `main`
- **Draft PRs:** open as draft by default; mark ready when all checks pass
- **PR title format:** `[#<issue-number>] <imperative description>` (e.g. `[#42] Add zone preset editor`)
- **Auto-close issues:** PR body must include `Closes #<issue-number>`
- **GitHub Project board:** run `gh project list` to find the project number; skills update issue status (Backlog → In Progress → In Review) when configured

## Issue Conventions

- **Issue body must include:** a short description, a bulleted **Tasks** list, and a checkbox **Acceptance criteria** list
- **Type labels drive the conventional commit prefix:**
  - `type: bug` → `fix:`
  - `type: technical` / `type: chore` → `chore:`
  - `type: user-story` / `type: feature` → `feat:`
  - default → `feat:`
- **Area labels:** `area: backend`, `area: frontend`, `area: docs`, `area: infrastructure`

## Build and Verification Commands

Skills reference this table to know which commands to run. Run only the suites relevant to the changed areas.

| Step | Command | Working directory |
|---|---|---|
| Frontend lint | `npm run lint` | `frontend/` |
| Frontend build | `npm run build` | `frontend/` |
| Frontend typecheck | `npx tsc --noEmit` | `frontend/` |
| Frontend tests | `npm test -- --run` | `frontend/` |
| Backend compile | `mvn compile -q` | `backend/` |
| Backend tests | `mvn test` | `backend/` |
| Backend full verify | `mvn verify` | `backend/` |

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Spring Boot (Java 21, Maven)
- **Database**: Neon (serverless PostgreSQL)
- **Auth**: Spring Security, JWT in HttpOnly cookies with refresh token rotation
- **Hosting**: Cloudflare Pages (frontend), Railway (backend)

## Architecture

```
zwifttool.trivedev.uk       Cloudflare Pages (React + Vite + TypeScript)
    ↕ REST API
api.zwifttool.trivedev.uk   Railway (Spring Boot)
    ↕ JDBC
                         Neon (serverless Postgres)
```

Frontend and backend communicate exclusively via REST API. Auth is entirely server-side.

## Core Domain Model

Every workout is divided into exactly three sections:
- **Warm-Up** (optional)
- **Main Set** (mandatory)
- **Cool-Down** (optional)

All editing, saving, and bulk replacement operates at the section level. Users can save sections to a private block library and bulk-replace the same section across multiple workouts in one action.

## Workout File Format

Zwift workouts use `.zwo` files — XML format. Intervals have properties: duration (seconds), power (%FTP), cadence (RPM), and optional text events. The UI displays workouts as a bar chart where width = duration and height = %FTP, coloured by Zwift zone.

## Java Coding Conventions

Full conventions (naming, Javadoc, Lombok, controllers, services, exceptions, logging, security) are in `/internal_docs/JAVA_CONVENTIONS.md`.

## Frontend Coding Conventions

Full conventions (TypeScript, React components, file structure, API layer, Tailwind, accessibility, hooks) are in `/internal_docs/FRONTEND_CONVENTIONS.md`.

## How the Agent Should Work (Semi-Automatic Tier)

This project uses the semi-automatic skill set. The rules are:

1. **The agent owns implementation and PR creation.** Once a plan is confirmed, it creates branches, commits, pushes, opens PRs, and updates issue state.

2. **The agent does not push to `dev` or `main` automatically.** `/merge-to-main` is the only skill permitted to push to protected branches, and it requires explicit user confirmation before each push.

3. **The agent does not merge PRs automatically.** The user reviews and merges.

4. **The agent stops only when input is genuinely needed** — vague acceptance criteria, missing schema details, design choices not in spec, or out-of-code tasks (DNS, secrets, infra).

5. **Sub-agents handle parallel work and protect context.** PR review spawns up to 3–5 parallel agents (backend, frontend, security, accessibility, responsiveness).

6. **TDD when sensible.** Write a failing test first for new logic with clear criteria. Skip TDD for trivial changes (config, docs, small fixes).

7. **Tests are sacred.** A failing test is a hard stop. Pre-existing failures are noted in the PR body but not silently fixed unless directly related to the change.

## Production Readiness Bar

Every PR must meet this bar before opening. The `pre-pr-checklist` and `review-pr` skills enforce it.

**All changes:**
- No secrets in code, commits, or logs
- Every external call has explicit success and failure paths — no swallowed errors
- No devDependencies imported at runtime
- `.env.example` updated for any new environment variable
- Names convey intent; comments explain *why* not *what*

**Frontend changes:**
- New data-driven screens have loading, empty, error, and populated states
- All `fetch` calls use `credentials: 'include'`
- No hardcoded API URLs — use environment variables
- No tokens in `localStorage` or `sessionStorage`
- Destructive actions confirm before firing
- All interactive elements have visible focus rings — buttons and inputs use the full ring pattern (`focus:ring-2 focus:ring-offset-1 focus:ring-offset-zinc-900`), not a border colour change alone
- All interactive elements meet the 44×44px touch target minimum (`min-w-11 min-h-11`)
- All modals use shared `Modal.tsx` — no hand-rolled dialogs
- Off-screen panels and drawers carry the `inert` attribute when not visible
- Toggle and selection buttons have `aria-pressed`
- Per-field form errors use `aria-invalid` and `aria-describedby` linking to the error element; generic server errors use `role="alert"` only
- Required inputs have `aria-required="true"`
- Decorative SVGs inside labelled buttons have `aria-hidden="true"`
- Icon-only buttons have `aria-label`
- Text colours on dark backgrounds use `text-zinc-400` minimum — never `text-zinc-500`
- Placeholder text uses `placeholder:text-zinc-400` — never `placeholder:text-zinc-500`

**Backend changes:**
- Every new request body validated (JSR-380 annotations or manual validation)
- New endpoints accepting credentials are rate-limited
- Uncaught errors surface with enough context to debug
- New environment variables documented and added to `.env.example`

## Workflow Checkpoints
When executing multi-step workflows or skills that define checkpoints, STOP and wait for explicit user confirmation at each checkpoint. Never run through review → planning → implementation → final checks without pausing.

## Dependency Verification
Before importing any npm package (e.g. heroicons, icon libraries), verify it exists in package.json. If not present, use inline SVGs or existing utilities rather than assuming availability.

## Build Verification
After code edits, always run the relevant verification: `mvn verify` for Java backend changes, and `npm run lint && npm run build` for frontend changes. Report the result before handing off a commit message.

## Input Controls
When editing numeric/text input components, use uncontrolled or loosely-controlled patterns that permit intermediate invalid states (empty string, partial numbers) during typing. Validate on blur, not on every keystroke. Avoid API saves on keystroke that steal focus.
