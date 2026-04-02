---
description: Review an issue against project instructions, coding conventions, and industry standards
argument-hint: <issue-number>
allowed-tools: Read, Glob, Grep, Bash(gh issue view:*), Bash(gh issue list:*)
---

## Context

- Issue number: $ARGUMENTS
- Issue details: !`gh issue view $ARGUMENTS --repo Ryan-Atkinson87/zwift-tool`

## Your task

You are performing a pre-implementation review of a GitHub issue. Your goal is to surface anything that is incorrect, incomplete, inconsistent, or below standard before any code is written. Be direct and specific. Do not praise issues that are fine — only call out genuine concerns.

Work through each section below in order and print a heading for each one.

---

### Step 1 — Load reference material

Read both of the following files before proceeding. Do not skip this step.

- `/internal_docs/INSTRUCTIONS_COPY.md` — project instructions: confirmed architecture, schema, domain model, API contracts, auth strategy
- `/CLAUDE.md` — coding conventions for both the Java backend and the React/TypeScript frontend

---

### Step 2 — Issue summary

Print a one-paragraph summary of what the issue is asking for. Include the issue number, title, area labels, and type label.

---

### Step 3 — Review against project instructions

Compare the issue content (title, description, tasks, acceptance criteria) against `INSTRUCTIONS_COPY.md`.

Check for:
- **Contradictions:** does anything in the issue conflict with a confirmed decision in the instructions? Flag any direct conflict with the relevant section name.
- **Scope drift:** does the issue ask for something that is out of scope for MVP, or that contradicts the confirmed tech stack, architecture, or domain model?
- **Missing context:** does the issue reference a concept or component that the instructions clarify further? If so, note what the instructions say and whether the issue omits or misrepresents it.
- **Schema or API mismatches:** if the issue involves database tables or API endpoints, verify column names, data types, endpoint paths, and HTTP methods match what is confirmed in the instructions exactly.
- **Domain model alignment:** check that the issue uses correct domain terminology (e.g. block, section, SectionType values, workout structure) consistent with the instructions.

Print each finding under a sub-heading. If nothing is wrong in a category, skip it — do not print "no issues found" for every item.

---

### Step 4 — Review against coding conventions

Compare the issue's implied implementation approach against the conventions in `CLAUDE.md`.

For backend issues, check:
- Is the proposed structure consistent with the layered architecture (controllers, services, repositories)?
- Are exception types named and thrown correctly (named exceptions, global handler)?
- Does the issue imply anything that would require hardcoded secrets, direct SQL in services, or HTTP logic outside controllers?
- Would the acceptance criteria be satisfiable using the correct Lombok annotations, ResponseEntity pattern, and Javadoc requirements?

For frontend issues, check:
- Does the issue imply components, hooks, or API calls that would conform to the naming, export, and file structure conventions?
- Would the acceptance criteria result in `any` types, default exports, inline fetch calls, or other convention violations if implemented naively?
- Is there anything that would be better addressed as a hook, API function, or shared UI component rather than inline logic?

For both:
- Would the acceptance criteria as written be testable and verifiable — or are they vague enough that two developers could implement them differently and both claim to pass?

Print each finding. If the issue is well-aligned with conventions, say so briefly and move on.

---

### Step 5 — Review against industry standards

Assess the issue against relevant industry best practices for the area(s) it covers.

Consider:
- **Security:** does the issue involve auth, tokens, cookies, passwords, or user data? Are there standard security controls missing from the acceptance criteria (e.g. token expiry, hashing, SameSite, HttpOnly, input validation)?
- **REST design:** if the issue involves API endpoints, do the paths, methods, and status codes follow REST conventions? Are there obvious missing cases (e.g. no 404 for missing resource, no 403 for ownership violation)?
- **Data integrity:** if the issue involves database writes, are transactions, foreign key constraints, and null handling addressed?
- **Error handling:** does the issue account for failure cases, or does it only describe the happy path?
- **Idempotency:** for PUT/DELETE endpoints, is idempotency addressed?
- **Performance:** are there any obvious N+1 queries, missing indexes, or unbounded result sets that should be flagged?

Print each finding. Focus on genuine gaps — do not invent concerns for well-covered issues.

---

### Step 6 — Summary verdict

Print a short verdict in one of three categories:

- **Ready to implement** — no significant issues found
- **Minor concerns** — issues are noted above but do not block implementation; proceed with awareness
- **Needs revision** — one or more issues should be resolved before implementation begins

List any action items clearly if the verdict is "Minor concerns" or "Needs revision". For each action item state whether it is for the issue author to fix (update issue) or for the implementer to handle (handle during build).