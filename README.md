# Zwift Tool

A web-based workout editor for Zwift cyclists. Load, edit, and export Zwift workout files (`.zwo` format), with a saved block library for reusing warm-ups, main sets, and cool-downs across multiple workouts in bulk.

**Live at:** [zwifttool.trivedev.uk](https://zwifttool.trivedev.uk) *(in development)*
**Brand:** [Trive](https://trivedev.uk)

---

## The Problem

Zwift workout files are XML. Users who build many custom workouts often end up with the same warm-up or cool-down repeated across dozens of files. Changing them means editing every file individually. No existing tool addresses bulk editing or block reuse.

---

## What It Does

Zwift Tool treats every workout as three distinct, swappable sections:

- **Warm-Up** - optional
- **Main Set** - mandatory
- **Cool-Down** - optional

All editing, saving, and bulk replacement operates at the section level.

### Core Features (MVP)

- Upload one or more `.zwo` files and define section boundaries on import
- Visual bar chart display: width = duration, height = %FTP, colour = Zwift zone
- Edit any interval in any section - duration, power, cadence, text events
- Save any section to a private block library and reuse it across workouts
- Bulk-replace the same section across multiple saved workouts in one action
- Export as a single `.zwo` file or multiple workouts as a `.zip`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | Spring Boot (Java 21, Maven) |
| Database | Neon (serverless Postgres) |
| Auth | Spring Security, JWT, HttpOnly cookies |
| Frontend hosting | Cloudflare Pages |
| Backend hosting | Railway |

---

## Status

In active development. Issues and project board track current progress.

Planned MVP scope:

- [x] Repository setup
- [x] Backend scaffolding and database schema
- [ ] Authentication (sign up, sign in, sign out)
- [ ] Workout upload and section split flow
- [ ] Workout visualisation (bar chart, three sections)
- [ ] Interval editing
- [ ] Block library
- [ ] Bulk section replacement
- [ ] Export (single file and zip)

---

## Architecture

```
zwifttool.trivedev.uk       Cloudflare Pages (React + Vite + TypeScript)
api.zwifttool.trivedev.uk   Railway (Spring Boot)
                         Neon (serverless Postgres)
```

The frontend and backend communicate exclusively via REST API. Auth is handled server-side using short-lived JWTs in HttpOnly cookies with refresh token rotation.

---

## Local Development

Requirements: Node 20+, Java 21, Maven

```bash
# Frontend
cd frontend
npm install
npm run dev        # runs at localhost:5173

# Backend
cd backend
export $(grep -v '^#' .env | xargs) && mvn spring-boot:run   # runs at localhost:8080
```

Backend requires a `.env` file. Copy `backend/.env.example` and fill in Neon DB credentials and JWT secret.

---

## Contributing

Not open for contributions at this stage. Issues and feedback welcome.

---

## Licence

MIT
