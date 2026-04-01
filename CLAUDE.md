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

Claude Code must never run git write commands: no `git add`, `git commit`, `git push`, `git merge`, `git checkout`, `git stash`, or `git rebase`. Only read-only git commands are allowed (`git status`, `git diff`, `git log`, `git branch`, `git fetch`, `git rev-list`).

When implementation is complete, hand off to the user:

1. Tell the user to stage their changes (`git add`)
2. Tell the user to review the diff (`git diff --staged`)
3. When asked, read the staged diff and write a commit message for the user to copy
4. Tell the user to commit (`git commit -m "..."`) and push

For merges, print the exact commands for the user to run rather than executing them.

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

This section defines the Java coding style for Zwift Tool. All backend code must follow these conventions. The goal is readable, self-documenting code that is consistent throughout the project and easy to follow for someone new to Java.

---

### Naming

| Thing | Convention | Example |
|---|---|---|
| Classes | PascalCase | `WorkoutService`, `BlockRepository` |
| Methods | camelCase | `getWorkoutById()`, `saveBlock()` |
| Variables | camelCase | `workoutId`, `blockContent` |
| Constants | UPPER_SNAKE_CASE | `MAX_TOKEN_EXPIRY_SECONDS` |
| Packages | lowercase, dot-separated | `uk.trive.zwifttool.services` |

**No abbreviations.** Use full, descriptive names. `sectionType` not `secType`. `workoutId` is acceptable because `Id` is a well-understood suffix, but do not shorten domain words.

---

### Javadoc

Every class and every public method must have a Javadoc comment. This is the Java equivalent of Python docstrings and serves the same purpose: it explains intent, not implementation. Use `@param` and `@return` tags on methods where they add clarity.

#### Class-level Javadoc

```java
/**
 * Handles all business logic for workout management, including saving,
 * updating, and bulk section replacement across multiple workouts.
 *
 * <p>All methods assume the caller has already verified authentication.
 * Authorisation checks (ownership) are enforced within this service.</p>
 */
@Service
public class WorkoutService {
    // ...
}
```

#### Method-level Javadoc

```java
/**
 * Replaces a specified section across multiple workouts using a saved block.
 *
 * <p>The existing section block is retained in the prev_ columns to support
 * single-step undo. The replacement is applied transactionally.</p>
 *
 * @param workoutIds  list of workout IDs to update
 * @param sectionType the section to replace (WARMUP, MAINSET, or COOLDOWN)
 * @param blockId     the saved block to use as the replacement
 * @param userId      the authenticated user's ID, used for ownership verification
 * @return a list of updated workout records
 * @throws WorkoutNotFoundException if any workout ID does not exist
 * @throws UnauthorisedException    if any workout belongs to a different user
 */
public List<Workout> bulkReplaceSection(
        List<UUID> workoutIds,
        SectionType sectionType,
        UUID blockId,
        UUID userId
) {
    // implementation
}
```

---

### Inline Comments

Inline comments must explain **why**, not what. If the code itself is clear, no comment is needed. Write a comment only when:

- A decision was made that is not obvious from the code
- A Zwift-specific format rule is being followed
- A workaround or edge case is being handled

```java
// Good: explains a non-obvious format requirement
// Zwift requires PowerLow before PowerHigh even on cooldowns, which ramp down
interval.setPowerLow(endPercent);
interval.setPowerHigh(startPercent);

// Bad: restates what the code already says clearly
// Set the duration to 600 seconds
block.setDuration(600);
```

Do not leave commented-out code in the codebase. Remove it or track it in a GitHub issue.

---

### Class Structure

Order the contents of every class as follows:

1. Static constants
2. Instance fields
3. Constructors (if not handled by Lombok)
4. Public methods
5. Private/helper methods

---

### Lombok

Use Lombok to eliminate boilerplate on entity and DTO classes. Do not write getters, setters, or constructors by hand where Lombok annotations can handle them.

```java
/**
 * Represents a saved workout block. Blocks marked as library blocks are
 * surfaced in the user's block library browser. Non-library blocks are
 * created automatically during import and deleted with their parent workout.
 */
@Data
@Builder
@Entity
@Table(name = "blocks")
public class Block {

    @Id
    @GeneratedValue
    private UUID id;

    private UUID userId;
    private String name;
    private String description;

    @Enumerated(EnumType.STRING)
    private SectionType sectionType;

    @Column(columnDefinition = "jsonb")
    private String content;

    private Integer durationSeconds;
    private Integer intervalCount;
    private boolean isLibraryBlock;
    private Instant createdAt;
}
```

Preferred Lombok annotations:

| Annotation | When to use |
|---|---|
| `@Data` | Entity and DTO classes (getters, setters, equals, hashCode, toString) |
| `@Builder` | Classes that need to be constructed with a fluent builder pattern |
| `@RequiredArgsConstructor` | Service and controller classes (injects final fields via constructor) |
| `@Slf4j` | Any class that needs logging |

---

### Controllers

Use `ResponseEntity<T>` in all controller methods with explicit HTTP status codes. Do not rely on Spring to infer the status.

```java
/**
 * Returns all library blocks belonging to the authenticated user,
 * ordered by creation date descending.
 *
 * @param userId the authenticated user's ID, resolved from the JWT by Spring Security
 * @return HTTP 200 with the block list, or HTTP 204 if the user has no library blocks
 */
@GetMapping("/blocks")
public ResponseEntity<List<BlockResponse>> getLibraryBlocks(
        @AuthenticationPrincipal UUID userId
) {
    List<BlockResponse> blocks = blockService.getLibraryBlocks(userId);

    return blocks.isEmpty()
        ? ResponseEntity.noContent().build()
        : ResponseEntity.ok(blocks);
}
```

---

### Services

Services contain all business logic. They must not contain SQL or HTTP-specific code. Keep methods short and single-purpose. If a method is getting long, extract private helper methods with clear names.

```java
/**
 * Retrieves a workout by ID, verifying it belongs to the requesting user.
 *
 * @param workoutId the ID of the workout to retrieve
 * @param userId    the authenticated user's ID
 * @return the matching workout
 * @throws WorkoutNotFoundException if no workout exists with the given ID
 * @throws UnauthorisedException    if the workout belongs to a different user
 */
public Workout getWorkout(UUID workoutId, UUID userId) {
    Workout workout = workoutRepository.findById(workoutId)
        .orElseThrow(() -> new WorkoutNotFoundException(workoutId));

    if (!workout.getUserId().equals(userId)) {
        throw new UnauthorisedException("Workout does not belong to this user.");
    }

    return workout;
}
```

---

### Exceptions

Throw named, descriptive exceptions from services. Do not return nulls or boolean success flags. Catch and handle exceptions centrally using a `@ControllerAdvice` global exception handler, not in individual controllers.

```java
/**
 * Thrown when a requested workout cannot be found in the database.
 */
public class WorkoutNotFoundException extends RuntimeException {

    public WorkoutNotFoundException(UUID workoutId) {
        super("No workout found with ID: " + workoutId);
    }
}
```

```java
/**
 * Thrown when an authenticated user attempts to access a resource
 * that belongs to a different user.
 */
public class UnauthorisedException extends RuntimeException {

    public UnauthorisedException(String message) {
        super(message);
    }
}
```

The global handler maps these to HTTP responses:

```java
/**
 * Handles application exceptions globally and maps them to appropriate
 * HTTP responses. All error responses follow the same JSON structure.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(WorkoutNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleWorkoutNotFound(WorkoutNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(UnauthorisedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorised(UnauthorisedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse(ex.getMessage()));
    }
}
```

---

### Logging

Use `@Slf4j` (from Lombok) for logging. Log at `INFO` for significant actions, `DEBUG` for detail, `WARN` for recoverable problems, and `ERROR` for failures that need attention.

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkoutService {

    public Workout saveWorkout(WorkoutRequest request, UUID userId) {
        log.info("Saving new workout for user {}", userId);
        // ...
    }
}
```

Do not log sensitive data such as passwords, tokens, or email addresses.

---

### Security: JWT Filter Chain

The JWT filter chain order and configuration must be documented with inline comments when built. This is a requirement, not optional. Example:

```java
// 1. Disable session creation - we use stateless JWT auth, not server-side sessions
// 2. Disable CSRF for API endpoints - protected by SameSite cookie and CORS instead
// 3. Apply JWT filter before UsernamePasswordAuthenticationFilter
// 4. Permit public endpoints: /auth/signup, /auth/signin, /auth/refresh
// 5. Require authentication for all other endpoints
```

---

### General Rules

- British English in all Javadoc, comments, and log messages
- No em dashes - use commas, colons, or full stops instead
- No hardcoded secrets anywhere in the codebase - all secrets via environment variables
- No commented-out code committed to the repository
- Delete unused imports - IntelliJ will flag these automatically
- One class per file

## Frontend Coding Conventions

This section defines the coding style for the Zwift Tool frontend. All React, TypeScript, and Tailwind code must follow these conventions. The goal is consistent, readable code that is easy to follow for someone who knows React but is newer to TypeScript and Tailwind.

---

### TypeScript

TypeScript adds types to JavaScript. The compiler catches type mismatches before the code runs, which eliminates an entire class of bugs that would otherwise only surface at runtime.

#### Always declare types explicitly

Do not rely on TypeScript to infer types for function parameters or return values. Declare them.

```typescript
// Bad - no declared types
async function getWorkout(id) {
    const response = await fetch(`/workouts/${id}`)
    return response.json()
}

// Good - types declared, intent is clear
async function getWorkout(id: string): Promise<Workout> {
    const response = await fetch(`/workouts/${id}`)
    return response.json()
}
```

#### Define an interface or type for every data shape

Every object that comes from the API or is passed between components must have a declared interface. Define these in `src/types/` and import them where needed.

```typescript
// src/types/workout.ts

export interface Workout {
    id: string
    name: string
    author: string | null
    description: string | null
    warmupBlock: Block | null
    mainsetBlock: Block
    cooldownBlock: Block | null
    isDraft: boolean
    createdAt: string
    updatedAt: string
}

export interface Block {
    id: string
    name: string
    description: string | null
    sectionType: SectionType
    content: IntervalContent[]
    durationSeconds: number
    intervalCount: number
    isLibraryBlock: boolean
}

// Use a union type for fixed sets of string values rather than a plain string
export type SectionType = 'WARMUP' | 'MAINSET' | 'COOLDOWN'
```

#### Prefer `interface` for object shapes, `type` for unions and aliases

```typescript
// interface for objects
interface WorkoutCardProps {
    workout: Workout
    onSelect: (id: string) => void
}

// type for unions and aliases
type SectionType = 'WARMUP' | 'MAINSET' | 'COOLDOWN'
type WorkoutId = string
```

#### Never use `any`

`any` disables TypeScript's type checking entirely. If the type is genuinely unknown, use `unknown` and narrow it before use.

---

### React Components

#### Functional components only

All components are functions. No class components.

```typescript
// Every component follows this pattern
export function WorkoutCard({ workout, onSelect }: WorkoutCardProps) {
    return (
        <div>
            <h2>{workout.name}</h2>
        </div>
    )
}
```

#### Named exports, not default exports

Named exports are consistent and make imports easier to search and refactor.

```typescript
// Good
export function WorkoutCard() { ... }
export function BlockLibrary() { ... }

// Avoid
export default function WorkoutCard() { ... }
```

#### Define a Props interface for every component

Declare props at the top of the file, immediately before the component. Name it `Props` if the file contains one component, or `WorkoutCardProps` if the file contains multiple.

```typescript
interface Props {
    workout: Workout
    isSelected: boolean
    onSelect: (id: string) => void
}

export function WorkoutCard({ workout, isSelected, onSelect }: Props) {
    return (
        <div
            onClick={() => onSelect(workout.id)}
            className={`p-4 rounded-lg cursor-pointer ${
                isSelected ? 'bg-zinc-700' : 'bg-zinc-800'
            }`}
        >
            <p className="text-sm font-medium text-white">{workout.name}</p>
        </div>
    )
}
```

#### One component per file

Each file exports one primary component. The filename matches the component name exactly.

```
WorkoutCard.tsx  ->  export function WorkoutCard()
BlockLibrary.tsx ->  export function BlockLibrary()
```

Small sub-components used only within a file may be defined in the same file without exporting them.

#### JSDoc on all exported components and hooks

This is the equivalent of Javadoc and Python docstrings. Every exported component and hook must have a JSDoc comment describing its purpose.

```typescript
/**
 * Displays a single workout as a clickable card in the workout list panel.
 * Highlights when selected and calls onSelect with the workout ID on click.
 */
export function WorkoutCard({ workout, isSelected, onSelect }: Props) {
    // ...
}

/**
 * Fetches and manages the list of saved workouts for the authenticated user.
 * Handles loading and error states. Re-fetches when the user saves or deletes a workout.
 */
export function useWorkouts() {
    // ...
}
```

#### Inline comments

Same rule as the backend: comment the why, not the what. Only add a comment where the reason for a decision is not obvious from the code itself.

```typescript
// Good: explains a non-obvious constraint
// Zwift zones are indexed 1-5, so subtract 1 when mapping to the array
const zone = zonesArray[block.zone - 1]

// Bad: restates what the code says
// Map over the blocks array
const blockElements = blocks.map(block => <BlockCard block={block} />)
```

---

### File and Folder Structure

Group files by feature, not by type. All files related to workouts live together, not scattered across a flat components folder.

```
src/
  components/
    workout/
      WorkoutCanvas.tsx      -- central bar chart display
      WorkoutCard.tsx        -- card in the workout list panel
      SectionDivider.tsx     -- draggable divider used on import
    blocks/
      BlockLibrary.tsx       -- right panel block browser
      BlockCard.tsx          -- individual block in the library
      BlockPreview.tsx       -- expanded block preview
    auth/
      SignInModal.tsx
      SignUpModal.tsx
    ui/
      Button.tsx             -- shared button component
      Modal.tsx              -- shared modal wrapper
  hooks/
    useWorkouts.ts           -- workout list state and fetching
    useBlocks.ts             -- block library state and fetching
    useAuth.ts               -- auth state and session management
  types/
    workout.ts               -- Workout, Block, SectionType interfaces
    auth.ts                  -- User, AuthState interfaces
  api/
    workouts.ts              -- fetch wrappers for /workouts endpoints
    blocks.ts                -- fetch wrappers for /blocks endpoints
    auth.ts                  -- fetch wrappers for /auth endpoints
  utils/
    zwoParser.ts             -- client-side .zwo XML parsing
    zwoExporter.ts           -- .zwo XML generation for export
    tssCalculator.ts         -- TSS and duration calculations
```

---

### API Layer

All fetch calls live in `src/api/`. Components and hooks never call `fetch` directly. This keeps network logic in one place and makes it easy to find and change.

```typescript
// src/api/workouts.ts

/**
 * Fetches all saved workouts for the authenticated user.
 * Returns an empty array if the user has no saved workouts.
 *
 * @throws Error if the request fails or the user is not authenticated
 */
export async function fetchWorkouts(): Promise<Workout[]> {
    const response = await fetch('/workouts', {
        credentials: 'include', // required for HttpOnly cookie auth
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch workouts: ${response.status}`)
    }

    return response.json()
}

/**
 * Saves a new workout and returns the saved record with its assigned ID.
 *
 * @param workout the workout data to save
 */
export async function saveWorkout(workout: WorkoutRequest): Promise<Workout> {
    const response = await fetch('/workouts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workout),
    })

    if (!response.ok) {
        throw new Error(`Failed to save workout: ${response.status}`)
    }

    return response.json()
}
```

Always pass `credentials: 'include'` on every request. This is required for the HttpOnly auth cookies to be sent cross-origin to `api.zwifttool.trivedev.uk`.

---

### Tailwind CSS

Tailwind provides utility classes that are applied directly in JSX. There are no separate CSS files for component styling.

#### Class ordering

Apply classes in a consistent order so any component is easy to scan:

1. Layout (`flex`, `grid`, `flex-col`, `items-center`, `justify-between`)
2. Sizing (`w-full`, `h-12`, `max-w-md`)
3. Spacing (`p-4`, `px-3`, `py-2`, `m-2`, `gap-3`)
4. Colour (`bg-zinc-900`, `text-white`, `border-zinc-700`)
5. Typography (`text-sm`, `font-medium`, `tracking-wide`, `truncate`)
6. Borders and radius (`rounded-lg`, `border`, `border-zinc-700`)
7. Effects and state (`shadow`, `opacity-50`, `hover:bg-zinc-700`, `transition`)

#### Break long class strings across lines

```typescript
// Short enough to stay on one line
<button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500">
    Save
</button>

// Too long for one line - break it and use a template literal
<div
    className={`
        flex items-center justify-between
        w-full px-4 py-3
        bg-zinc-800 border border-zinc-700
        rounded-lg cursor-pointer
        hover:bg-zinc-700 transition-colours
    `}
>
```

#### Conditional classes

Use a template literal for simple conditions. For multiple conditions, use the `clsx` library.

```typescript
// Simple condition - template literal is fine
<div className={`px-4 py-2 rounded ${isSelected ? 'bg-zinc-700' : 'bg-zinc-800'}`}>

// Multiple conditions - use clsx for readability
import clsx from 'clsx'

<div className={clsx(
    'px-4 py-2 rounded transition-colours',
    isSelected && 'bg-zinc-700 border-indigo-500',
    !isSelected && 'bg-zinc-800 border-zinc-700',
    isDisabled && 'opacity-50 cursor-not-allowed',
)}>
```

#### Spacing scale reference

Tailwind uses a 4px base unit. Use this scale consistently rather than mixing arbitrary values.

| Class | Size |
|---|---|
| `1` | 4px |
| `2` | 8px |
| `3` | 12px |
| `4` | 16px |
| `6` | 24px |
| `8` | 32px |
| `12` | 48px |
| `16` | 64px |

---

### Hooks

Custom hooks extract stateful logic out of components. Any logic involving `useState`, `useEffect`, or API calls belongs in a hook, not directly in a component.

```typescript
// src/hooks/useWorkouts.ts

/**
 * Manages the list of saved workouts for the authenticated user.
 * Fetches on mount and exposes save and delete actions that keep
 * the local state in sync with the backend.
 */
export function useWorkouts() {
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchWorkouts()
            .then(setWorkouts)
            .catch(() => setError('Failed to load workouts.'))
            .finally(() => setIsLoading(false))
    }, [])

    return { workouts, isLoading, error }
}
```

Hook files are named `use` + the thing they manage: `useWorkouts.ts`, `useBlocks.ts`, `useAuth.ts`.

---

### General Rules

- British English in all comments, JSDoc, and user-facing copy
- No em dashes - use commas, colons, or full stops instead
- No `any` type anywhere in the codebase
- No inline `fetch` calls in components or hooks - use the `src/api/` layer
- Always pass `credentials: 'include'` on API requests
- Named exports only - no default exports from component files
- One primary component per file
- JSDoc on every exported component, hook, and API function
- No commented-out code committed to the repository