# Zwift Tool - Project Instructions

## Overview

Zwift Tool is a web-based workout editor for Zwift cyclists, built under the Trive brand. It lets users load, edit, and export Zwift workout files (.zwo format), with a saved block library for reusing warm-ups, main sets, and cool-downs across multiple workouts in bulk.

- **URL:** zwifttool.trivedev.uk
- **Status:** In Development
- **Brand:** Trive (trivedev.uk)

---

## Confirmation Status

Sections and decisions in these instructions are marked as follows:

- **[CONFIRMED]** - decided and locked in, build to this
- **[DISCUSSION]** - direction agreed in principle but detail not yet locked down, do not build to this without checking first

If something is not marked, treat it as confirmed unless it touches backend, auth, database, or infrastructure, in which case treat it as discussion.

---

## Goals

- Demonstrate clean, polished full-stack web development
- Gain visibility through the Zwift community (Reddit r/Zwift, Zwift forums, LinkedIn)
- Build something genuinely useful that fills gaps left by existing tools
- Keep scope tight enough to ship as a side project alongside Aquasense
- Serve as a LinkedIn-visible AI-assisted development build

---

## Background: The Problem Being Solved

Zwift workout files use the `.zwo` format, which is XML. They live at `Documents/Zwift/Workouts/[ZwiftID]/` on Windows and Mac. Users who build many custom workouts often end up with the same warm-up or cool-down repeated across dozens of files. Changing them requires editing each file individually. No existing tool addresses bulk editing or block reuse.

Existing competitors (zwofactory.com, zwiftworkout.com) offer visual editors but are utilitarian in design and do not support saved reusable blocks or bulk replacement across multiple files.

---

## Toolchain and Workflow [CONFIRMED]

| Tool | Role |
|---|---|
| claude.ai (this project) | Planning, discussion, decision-making, drafting content, updating Notion and instructions |
| Notion | Source of truth for tasks, decisions, and project notes |
| GitHub | Code repository, issue tracking, project board |
| Claude Code | Reads GitHub issues, writes and verifies code, creates issues, keeps instructions updated |

### Workflow Loop

```
claude.ai
  Plan features and architecture, discuss options, make decisions
  Update Notion pages and task databases to reflect decisions
  Draft GitHub issue content (title, description, acceptance criteria)
        |
        v
Claude Code
  Reads issues from GitHub
  Verifies scope and flags anything unclear
  Writes code, raises PRs, marks issues done
  Updates claude.ai project instructions when decisions change during build
        |
        v
claude.ai
  Reviews progress, plans next set of issues
  Updates Notion and instructions as needed
```

### Notion Structure

Notion is the running source of truth for all planning. The Zwift Tool workspace contains:

- **MVP Plan: Workout Editor** - historical reference only, superseded by User Stories database
- **User Stories** - all user stories, MVP and future, with Area, Phase, Status, and Confirmed columns
- **Technical Tasks** - non-user-facing technical work, MVP and future, with Area, Phase, Status, and Confirmed columns
- **Frontend** - confirmed frontend stack, layout, hosting, DNS, coding conventions
- **Backend** - confirmed backend stack, API endpoints, local dev, deployment
- **Database** - confirmed schema, design notes, future work
- **Authorisation** - confirmed auth approach, CORS, public endpoints, password rules
- **Infrastructure** - confirmed hosting overview, full DNS table
- **Deployment Tasks** - deployment task database

---

## Core Concept: Three-Section Workout Structure [CONFIRMED]

Every workout in Zwift Tool is treated as three distinct, labelled, swappable sections:

- **Warm-Up** (maps to Zwift's `<Warmup>` XML tag) - optional
- **Main Set** (maps to the main `<workout>` blocks: SteadyState, Ramp, IntervalsT, FreeRide) - mandatory
- **Cool-Down** (maps to Zwift's `<Cooldown>` XML tag) - optional

All editing, saving, and bulk replacement operates at the section level. This structure is enforced on export.

---

## MVP User Stories [CONFIRMED]

Full user stories are tracked in the Notion User Stories database. A summary of confirmed MVP scope by area:

**Authentication:** sign up, sign in, sign out

**Loading and Saving:** upload one or more .zwo files, auto-save to account on upload, view saved workouts list, open saved workout for editing, auto-save on changes, single undo to revert last save

**Creating Workouts:** create a new blank workout, edit name, author, and description

**Visualisation:** bar chart display where width = duration, height = %FTP (0-140% default, expanding if exceeded), colour = Zwift zone; three labelled sections; total duration and TSS

**Interval Editing:** add blocks via zone presets (see below), add Ramp/IntervalsT/Free Ride blocks, edit duration/power/cadence, reorder and delete blocks, add text events, edit zone preset defaults (hard-blocked from exceeding zone range)

**Block Library:** save any section to library with name and optional description, create sections independently, browse by section type, preview blocks, replace a section with a saved block, all blocks private to account

**Bulk Editing:** select multiple saved workouts, replace a section across all using a saved block, preview before confirming

**Export:** single .zwo file, multiple workouts as .zip

---

## Zone Presets [CONFIRMED]

Zwift uses a 5-zone model. Preset defaults:

| Zone | Name | Default %FTP | Default Duration | %FTP Range |
|---|---|---|---|---|
| 1 | Active Recovery | 50% | 10 min | < 60% |
| 2 | Endurance | 68% | 20 min | 60-75% |
| 3 | Tempo | 83% | 15 min | 76-90% |
| 4 | Threshold | 98% | 8 min | 91-105% |
| 5 | VO2 Max | 113% | 2 min | 106-120% |

Users can edit default duration and %FTP per zone. %FTP is hard-blocked from being set outside the valid range for that zone. A zone_presets row is only written to the database when a user deviates from system defaults.

---

## Import Flow [CONFIRMED]

Imported .zwo files are not parsed into sections automatically. The import flow is:

1. User uploads a .zwo file
2. Frontend parses the XML client-side and displays all intervals as a flat list
3. User drags dividers to define section boundaries (warm-up end, cool-down start)
4. Warm-up and cool-down are optional; main set is mandatory
5. On confirmation, frontend sends the structured workout to the backend to save as active
6. Nothing is written to the database until the user confirms the section split

---

## Tech Stack

### Frontend [CONFIRMED]

| Layer | Technology | Notes |
|---|---|---|
| Framework | React + Vite + TypeScript | Component-based, suits block editing model |
| Styling | Tailwind CSS | Utility-first, clean modern UI |
| Hosting | Cloudflare Pages | Free tier, auto-deploy from GitHub on merge to main |

Build command: `npm run build`
Output directory: `dist`

### Backend [CONFIRMED]

| Layer | Technology | Notes |
|---|---|---|
| Framework | Spring Boot (Java 21, Maven) | Consistent with Aquasense |
| Hosting | Railway (Hobby plan, ~$5/month) | Auto-deploys from GitHub on merge to main |

### Database [CONFIRMED]

| Layer | Technology | Notes |
|---|---|---|
| Database | Neon | Serverless Postgres, generous free tier, no sleep issues, connects via JDBC |

### Auth [CONFIRMED]

| Layer | Technology | Notes |
|---|---|---|
| Auth | Spring Security + JWT | Custom implementation, HttpOnly cookies, no third-party auth provider |

---

## Architecture [CONFIRMED]

```
zwifttool.trivedev.uk       Cloudflare Pages (React/Vite/TS, static)
api.zwifttool.trivedev.uk   Railway (Spring Boot backend)
dev.zwifttool.trivedev.uk   Cloudflare Tunnel -> Pi 5 (dev/integration testing only)
                         Neon (Postgres, managed cloud)
```

### DNS (Cloudflare)

| Record | Type | Points to | Status |
|---|---|---|---|
| zwifttool.trivedev.uk | CNAME | Cloudflare Pages project | CONFIRMED |
| api.zwifttool.trivedev.uk | CNAME | Railway deployment URL | CONFIRMED |
| dev.zwifttool.trivedev.uk | CNAME | Cloudflare Tunnel (Pi 5, dev/integration testing only) | CONFIRMED |

---

## Database Schema [CONFIRMED]

```sql
users (
  id            UUID PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
)

user_identities (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,  -- 'local' | 'google' | 'strava' | 'apple' | 'email_otp'
  provider_sub    TEXT NOT NULL,  -- provider's unique ID for this user
  password_hash   TEXT,           -- only populated for provider = 'local'
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_sub)
)

user_sessions (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  refresh_token   TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
)

workouts (
  id                      UUID PRIMARY KEY,
  user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  author                  TEXT,
  description             TEXT,
  warmup_block_id         UUID REFERENCES blocks(id),
  mainset_block_id        UUID REFERENCES blocks(id) NOT NULL,
  cooldown_block_id       UUID REFERENCES blocks(id),
  prev_warmup_block_id    UUID REFERENCES blocks(id),
  prev_mainset_block_id   UUID REFERENCES blocks(id),
  prev_cooldown_block_id  UUID REFERENCES blocks(id),
  is_draft                BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
)

blocks (
  id               UUID PRIMARY KEY,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  section_type     TEXT NOT NULL,  -- 'WARMUP' | 'MAINSET' | 'COOLDOWN'
  content          JSONB NOT NULL,
  duration_seconds INTEGER,
  interval_count   INTEGER,
  is_library_block BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
)

zone_presets (
  id                UUID PRIMARY KEY,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  zone              INTEGER NOT NULL,  -- 1-5
  duration_seconds  INTEGER NOT NULL,
  ftp_percent       INTEGER NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
)

-- Indexes on foreign key columns (PostgreSQL does not index FK columns automatically)
CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_blocks_user_id ON blocks(user_id);
CREATE INDEX idx_workouts_user_id ON workouts(user_id);
CREATE INDEX idx_zone_presets_user_id ON zone_presets(user_id);

-- Trigger function to keep updated_at current on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER workouts_set_updated_at
    BEFORE UPDATE ON workouts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Schema Notes

- `users` and `user_identities` separate the canonical user record from auth credentials. This supports multiple sign-in methods per user without a schema migration later.
- `user_sessions` stores refresh tokens server-side. The HttpOnly cookie holds a session ID; the backend looks it up and validates expiry before issuing a new access token.
- Intervals stored as JSONB in `content` on blocks. .zwo XML is generated at export time.
- `duration_seconds` and `interval_count` on blocks are pre-computed at save time for preview performance.
- `is_draft` on workouts: blank new workouts start as drafts. Draft workouts are deleted after 7 days of inactivity based on `updated_at`. The `workouts_set_updated_at` trigger keeps this column current automatically.
- `is_library_block`: blocks auto-created during import are not surfaced in the library. Non-library blocks are deleted when their parent workout is deleted.
- Undo works by swapping current block IDs back to the previous block ID columns.
- `zone_presets`: a row is only created when a user deviates from system defaults.
- All `user_id` foreign keys use `ON DELETE CASCADE`. Deleting a user removes all their associated identities, sessions, workouts, blocks, and zone presets.
- FK columns on `user_identities`, `user_sessions`, `blocks`, `workouts`, and `zone_presets` are explicitly indexed. PostgreSQL does not create these automatically.

---

## Authorisation [CONFIRMED]

Spring Boot handles all authentication. JWTs are issued by the backend and stored in HttpOnly cookies. JavaScript cannot read HttpOnly cookies, which means XSS attacks cannot steal tokens.

### Cookie Configuration

- `HttpOnly`: true
- `SameSite`: Strict
- `Domain`: trivedev.uk - allows cookies to be sent across subdomains (zwifttool.trivedev.uk to api.zwifttool.trivedev.uk)
- `Secure`: true - HTTPS only

### Token Strategy

- **Access token:** short-lived JWT, expires in 15 minutes, stored in an HttpOnly cookie
- **Refresh token:** expires in 7 days, stored in a separate HttpOnly cookie as a session ID
- When the access token expires, the frontend calls `/auth/refresh` silently; the backend validates the session and issues a new access token
- On sign out, both cookies are cleared server-side

### Refresh Token Rotation [CONFIRMED]

Every time a new access token is issued, the refresh token is also rotated. The old session record in `user_sessions` is replaced with a new one. Claude Code must handle the rotation collision edge case (two concurrent requests arriving with the same refresh token) using a short grace window or a last-used timestamp check.

### CORS [CONFIRMED]

- Permitted origin: `https://zwifttool.trivedev.uk` only
- Credentials allowed: true (required for cookies to work cross-origin)
- All other origins rejected

### Public vs Protected Endpoints [CONFIRMED]

The following endpoints are public and require no access token:

- `POST /auth/signup`
- `POST /auth/signin`
- `POST /auth/refresh`

All other endpoints require a valid access token. The JWT filter chain must enforce this and must be documented in code comments when built.

### Password Requirements [CONFIRMED]

- Minimum 8 characters
- No maximum length
- No complexity rules for MVP (uppercase, symbols, etc. not required)

### Multi-Provider Design

The schema is designed to support multiple auth providers from day one. Only email/password (`provider = 'local'`) is built for MVP. Future providers: `google`, `strava`, `apple`, `email_otp`. A single user can have multiple identities resolving to the same `users` row.

### CSRF Protection

Spring Security CSRF protection is disabled. Two controls make CSRF attacks impossible without tokens:

1. **SameSite=Strict cookies:** the browser will not attach cookies on any cross-site request, so a malicious origin cannot trigger an authenticated call.
2. **Strict CORS:** the API rejects requests from any origin other than `zwifttool.trivedev.uk`, so any cross-site request is rejected at the preflight stage.

Adding CSRF tokens would introduce complexity with no security benefit given these controls.

### JWT Filter Chain

Implementation detail owned by Claude Code during the auth build. The filter chain order and configuration must be documented in code comments when built.

---

## Backend Structure [CONFIRMED]

Standard layered architecture, consistent with Aquasense.

```
src/
  main/
    java/
      controllers/
      services/
      repositories/
      models/
    resources/
      application.properties
```

Key dependencies: Spring Web, Spring Security, Spring Data JPA, PostgreSQL Driver, Lombok

### Environment Variables

All secrets via environment variables, never hardcoded. Set in the Railway dashboard.

- `DB_URL`
- `DB_USER`
- `DB_PASS`
- `JWT_SECRET`

### Local Development

Both the frontend and backend run locally on your laptop during regular development:

- Frontend: `npm run dev` starts the Vite dev server at `localhost:5173`
- Backend: `export $(grep -v '^#' .env | xargs) && mvn spring-boot:run` starts Spring Boot at `localhost:8080`. Environment variables are loaded from `backend/.env` into the shell before Maven runs; Spring Boot resolves them via `${DB_URL}` etc. in `application.properties`. When running from IntelliJ, set the four variables in the run configuration instead.
- Frontend talks to the backend via localhost. No Pi, no tunnel, no network required.
- No Docker needed for MVP.

**Database environments:** Two Neon branches keep development completely isolated from production:

| Branch | Used by | Connection string set in |
|---|---|---|
| `main` | Railway (production) | Railway environment variables dashboard |
| `dev` | Local development on laptop | Local environment variables (`DB_URL`) |

The `dev` branch is created from `main` in the Neon dashboard. It has its own connection string and is entirely isolated. Test data and work-in-progress changes never touch the production database. Neon branching is included on the free tier at no extra cost.

For integration testing (frontend and backend over a real HTTPS connection), use `dev.zwifttool.trivedev.uk` via the Cloudflare Tunnel to the Pi 5. This is not required for regular development.

### Deployment

- Railway auto-deploys from GitHub on merge to main.
- No staging environment for MVP.

---

## Key API Endpoints [CONFIRMED]

| Method | Path | Description |
|---|---|---|
| POST | /auth/signup | Create account |
| POST | /auth/signin | Sign in, sets HttpOnly cookies |
| POST | /auth/signout | Sign out, clears HttpOnly cookies |
| POST | /auth/refresh | Issue new access token using session cookie |
| GET | /blocks | Get all library blocks for authenticated user |
| POST | /blocks | Save a new block |
| PUT | /blocks/{id} | Update a saved block |
| DELETE | /blocks/{id} | Delete a saved block |
| GET | /workouts | Get all workouts for authenticated user |
| POST | /workouts | Save a new workout |
| PUT | /workouts/{id} | Update a workout |
| DELETE | /workouts/{id} | Delete a workout |
| POST | /workouts/bulk-replace | Bulk replace a section across multiple workouts, returns zip |

---

## Frontend Layout [CONFIRMED]

Three-panel layout, desktop-first:

- **Left panel:** Loaded file list (for bulk replace mode with multiple files)
- **Centre panel:** Workout canvas - visual bar chart split into three labelled sections
- **Right panel:** Block library browser, filtered by section type with block preview

Modal-based auth flow (sign up, sign in, sign out). Session managed via HttpOnly cookies set by the backend.

---

## .zwo File Format Reference [CONFIRMED]

```xml
<workout_file>
  <n>Workout Name</n>
  <author>Author</author>
  <description>Description</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="600" PowerLow="0.40" PowerHigh="0.75"/>
    <SteadyState Duration="1200" Power="0.88"/>
    <IntervalsT Repeat="5" OnDuration="60" OffDuration="60" OnPower="1.10" OffPower="0.55"/>
    <Ramp Duration="300" PowerLow="0.75" PowerHigh="1.0"/>
    <FreeRide Duration="600"/>
    <Cooldown Duration="300" PowerLow="0.75" PowerHigh="0.40"/>
    <textevent timeoffset="60" message="Keep it steady"/>
  </workout>
</workout_file>
```

Power values are expressed as a fraction of FTP (e.g. 0.88 = 88% FTP). Duration is in seconds.

---

## Coding Conventions [CONFIRMED]

- British English in all UI copy and code comments
- No em dashes anywhere - use commas, colons, or full stops instead
- Consistent with Aquasense Spring Boot conventions where applicable
- All secrets via environment variables, never hardcoded
- Git branching: feature branches merged to main via PR; main auto-deploys to Cloudflare Pages and Railway

---

## Out of Scope for MVP [CONFIRMED]

- Zwift effort rating
- Public block library and block sharing
- Bulk upload without saving workouts first
- Full version history beyond single undo
- Mobile layout
- TrainingPeaks or Intervals.icu integration
- AI-assisted workout generation
- Social login (Google, Strava, Apple, email OTP)
- `.erg` file format support

---

## Open Questions

- Confirm Railway auto-detects Maven JAR without a Dockerfile, or provide one (Claude Code to resolve during initial deploy)
- Enable Cloudflare WAF rules on api.zwifttool.trivedev.uk once live? (post-launch decision)
- Block library JSON export/import for backup and sharing - MVP or post-MVP?
- GitHub MCP connector for claude.ai: check periodically whether this becomes available

---

## Success Criteria

1. User can sign up and sign in
2. User can upload one or more .zwo files and define section boundaries on import
3. Workout is displayed clearly in three labelled sections as a bar chart
4. User can edit any interval in any section
5. User can save a section to the block library
6. User can bulk-replace the same section across multiple saved workouts
7. Updated files download as a zip
8. App is live at zwifttool.trivedev.uk