# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
mvn spring-boot:run
```

Backend requires a `.env` file — copy `backend/.env.example` and fill in Neon DB credentials and JWT secret.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Spring Boot (Java 21, Maven)
- **Database**: Neon (serverless PostgreSQL)
- **Auth**: Spring Security, JWT in HttpOnly cookies with refresh token rotation
- **Hosting**: Cloudflare Pages (frontend), Railway (backend)

## Architecture

```
zwifttool.trive.uk       Cloudflare Pages (React + Vite + TypeScript)
    ↕ REST API
api.zwifttool.trive.uk   Railway (Spring Boot)
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