# Zwift Tool — Frontend Testing Strategy

## Overview

The Zwift Tool frontend uses **Vitest** for unit and integration tests, and **Playwright** for end-to-end (E2E) tests. The test suite targets the `frontend/src/` structure in the current Vite + React + TypeScript project.

## Running Tests

```bash
# Install dependencies first
cd frontend && npm install

# Run unit tests (single pass)
npm test

# Run unit tests with coverage report
npm run test:coverage

# Run E2E tests (requires a running dev server or CI)
npm run test:e2e
```

## Technology Stack

| Tool | Version | Purpose |
|---|---|---|
| Vitest | ^3.2 | Unit and integration test runner |
| @testing-library/react | ^16.3 | React component rendering and queries |
| @testing-library/user-event | ^14.6 | Simulated user interactions |
| @testing-library/jest-dom | ^6.6 | Custom DOM matchers |
| jsdom | ^26 | Browser DOM simulation |
| @vitest/coverage-v8 | ^3.2 | Code coverage via V8 |
| @playwright/test | ^1.52 | End-to-end browser testing |

## Test Structure

Tests are co-located with the source files they test, placed in `__tests__/` subdirectories.

```
frontend/src/
  utils/__tests__/          Unit tests for pure utility functions
  hooks/__tests__/          Unit tests for custom React hooks
  components/
    ui/__tests__/            Component tests for shared UI primitives
    auth/__tests__/          Component tests for auth modals
    workout/__tests__/       Component tests for workout editor components
    blocks/__tests__/        Component tests for block library components
    import/__tests__/        Component tests for the file import flow
frontend/e2e/               End-to-end test specs (Playwright)
```

## Coverage Thresholds

Coverage thresholds are enforced by Vitest and will fail the CI job if not met:

| Metric | Minimum |
|---|---|
| Statements | 70% |
| Branches | 70% |
| Functions | 70% |
| Lines | 70% |

The target is >90% statement coverage. Run `npm run test:coverage` to view the full report in `frontend/coverage/`.

## Test Categories

### Utility Tests (`src/utils/__tests__/`)

Pure function tests with no mocking required. Cover:
- `zwoParser` — XML parsing, all interval types, error cases
- `zoneColours` — zone derivation from %FTP, colour mapping
- `intervalExpander` — interval-to-bar expansion for all interval types
- `workoutStats` — duration formatting, total duration, normalised power
- `zonePresets` — preset defaults, `getZonePreset` lookup
- `editorDraft` — section block helpers, draft building
- `zwoExporter` — XML generation, special character escaping
- `paletteItems` — palette item construction with zone preset overrides

### Hook Tests (`src/hooks/__tests__/`)

Hook tests use `renderHook` from `@testing-library/react`. API modules are mocked with `vi.mock` to isolate hooks from network calls.

- `useAuth` — session restore, sign-in/sign-up/sign-out, session expiry
- `useBlocks` — block fetching, authentication gating, optimistic delete
- `useWorkout` — single workout fetch, stale response protection, `applyUpdate`
- `useWorkouts` — workout list fetch, `reload`, error handling
- `useWorkoutAutosave` — debounced save, `flush`, error state, coalescing
- `useZonePresets` — preset fetching, save/reset mutations, fallback defaults

### Component Tests (`src/components/`)

Component tests use `render` from `@testing-library/react` and `userEvent` for interactions. External API calls and complex hook dependencies are mocked.

- `Modal` — open/close states, backdrop click, Escape key, child rendering
- `SignInModal` — form fields, validation, server errors, submitting state
- `SignUpModal` — email/password validation, server errors, guest warning
- `WorkoutCard` — normal and select modes, delete confirmation flow
- `BlockCard` — section badges, delete confirmation, edit button, selection
- `FileUploader` — file upload, parse errors, multiple file handling

### End-to-End Tests (`e2e/`)

Playwright tests run against the full running application. They test guest-mode workflows without requiring the backend. Playwright locators are used exclusively — no Testing Library calls.

- Application shell rendering
- File import flow (valid and invalid files)
- Auth modal open/close/validation
- Example workout loading

## Mocking Strategy

- **API modules** (`src/api/`) are mocked wholesale with `vi.mock()` in hook and component tests so no real HTTP requests are made
- **Browser APIs** (`URL.createObjectURL`, `document.createElement`) are mocked where needed for download tests
- **Timers** are replaced with `vi.useFakeTimers()` in autosave tests to control debounce behaviour
- **No mocking of utilities or types** — utility functions are tested against their real implementations

## Writing New Tests

1. Co-locate the test file with the source file in a `__tests__/` subdirectory
2. Name the test file `<ComponentName>.test.tsx` or `<module>.test.ts`
3. Import from `vitest` explicitly (`import { describe, it, expect, vi } from 'vitest'`)
4. Use British English in test descriptions and comments
5. Use `@testing-library/user-event` (`userEvent.setup()`) for simulated user interactions
6. Use `screen` queries over `container.querySelector` where possible
7. Prefer `getByRole` and `getByLabelText` over `getByTestId` for accessible queries

## CI

Tests run in GitHub Actions on every push and pull request to `main` and `dev`. The pipeline has three frontend jobs:

1. **Frontend — Lint** (`npm run lint`)
2. **Frontend — Unit Tests (Coverage)** (`npm run test:coverage`)
3. **Frontend — E2E Tests** (`npm run test:e2e`)

All three must pass before a pull request can be merged.
