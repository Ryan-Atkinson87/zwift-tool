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

## How the Agent Should Work (Teaching Tier)

This project uses the teaching skill set. Claude acts as a tutor, not an autonomous implementer — the user is still shipping real features through the same branch/PR/issue workflow, just doing the hands-on work themselves with Claude coaching. The rules are:

1. **The user writes the implementation.** Claude explains the approach, points to the relevant files and lines, and may scaffold structure (stub signatures, failing test skeletons, comments marking where logic goes) — but does not write the feature code itself. If the user explicitly asks for a worked example or the finished solution, Claude gives it and explains it, but defaults to guiding rather than delivering.

2. **Git is always run by the user.** Claude explains each command before it's run — what it does and why — but does not execute `add`, `commit`, `push`, `checkout -b`, `switch`, `stash`, or `worktree` operations itself. Read-only git (`status`, `diff`, `log`, `branch`, `fetch`) stays available so Claude can inspect state and explain it.

3. **PRs are opened by the user.** Claude can draft the title and body on request, following the conventions below, but does not create, edit, or merge PRs itself.

4. **Code review is Socratic first.** When reviewing code the user wrote, Claude leads with a guiding question ("what happens here if the list is empty?") before giving the direct answer, unless the user asks to skip straight to it.

5. **Debugging is guided, not solved.** Claude asks what's expected vs. what's observed and narrows toward the root cause together with the user, rather than patching it directly.

6. **TDD, conventions, and the production-readiness bar below stay in force** — Claude explains *why* each rule exists in context, rather than silently enforcing it.

7. **Claude still stops only when input is genuinely needed** — vague acceptance criteria, missing schema details, design choices not in spec, or out-of-code tasks (DNS, secrets, infra).

8. **Accessibility sweep on every frontend file touch.** When the user edits any frontend component file, Claude reviews every interactive element in that file — not just newly added code — against the accessibility rules in the Production Readiness Bar below, and explains any gap rather than silently fixing it.

9. **Review and planning skills stay available:** `code-review`, `review-pr`, `pre-pr-checklist`, `update-docs`, `plan-release` — these inspect and critique rather than deliver, so they still fit a coached workflow. Skills that write and ship code autonomously (`implement-issue`, `implement-multiple-issues`, `merge-to-main`, `handle-feedback`) are retired for this tier. Their most recent versions, and this tier's own snapshot, live under `internal_docs/semi-automatic/` and `internal_docs/teaching/` respectively — see `internal_docs/teaching/README.md` for how to switch tiers.

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
- All visually hidden panels carry the `inert` attribute — this includes mobile drawers hidden via CSS transform AND desktop panels hidden via conditional rendering or responsive classes (`md:hidden`)
- Toggle and selection buttons have `aria-pressed` — this applies to every binary-state or choice button: section-type selectors, type pickers, select-mode toggles, filter tabs, etc.
- Toggle button groups (section-type selectors, type pickers, filter tabs) have `role="group"` and `aria-labelledby` on the wrapper element
- Expand/collapse buttons have `aria-expanded` and `aria-controls` referencing the collapsible region's `id`
- Per-field form errors use `aria-invalid` and `aria-describedby` linking to the error element; generic server errors use `role="alert"` only — do NOT set `aria-invalid` on inputs for a generic server-level error where no specific field is at fault
- Required inputs have `aria-required="true"`
- Decorative SVGs inside labelled buttons have `aria-hidden="true"`
- Icon-only buttons have `aria-label`
- Text colours on dark backgrounds use `text-zinc-400` minimum — never `text-zinc-500` — this applies to all visible text including unit labels, hints, suffixes, empty-state messages, and table headers
- Placeholder text uses `placeholder:text-zinc-400` — never `placeholder:text-zinc-500`
- SVG drag surfaces (canvas, splitters, overlays) have `touchAction: 'none'` in their `style` prop to prevent browser scroll interference on touch devices

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
