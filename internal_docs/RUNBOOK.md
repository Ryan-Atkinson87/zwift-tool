# Release Runbook

## What this release delivers

This release ships the complete MVP of Zwift Tool: a web-based editor that lets Zwift cyclists upload, edit, and export `.zwo` workout files. Users can sign up, manage a library of reusable workout sections (blocks), bulk-replace sections across multiple workouts in one action, and download the results as `.zwo` or `.zip` files ready to load into Zwift.

---

## Issues requiring revision before work begins

None — all issues are ready to implement.

---

## Group 1 — Infrastructure and Authentication

**Rationale:** Everything else in the backlog depends on a deployed backend and a working auth flow; these eight issues must be complete and reviewed before any feature work can begin.

### #4 — Configure Cloudflare Pages deployment for frontend

Connect `/frontend` to Cloudflare Pages for auto-deployment on merge to main.

Acceptance criteria:
- [ ] Merge to main triggers a Cloudflare Pages build
- [ ] Build succeeds and deploys to `zwifttool.trivedev.uk`
- [ ] HTTPS is active on the custom domain
- [ ] Only changes to `/frontend` trigger a frontend build (path filter configured if available)

---

### #5 — Configure Railway deployment for backend

Connect `/backend` to Railway for auto-deployment on merge to main.

Acceptance criteria:
- [ ] Merge to main triggers a Railway build
- [ ] `GET api.zwifttool.trivedev.uk/health` returns 200 OK
- [ ] HTTPS is active on the custom domain
- [ ] All secrets are set via Railway dashboard, none hardcoded
- [ ] Only changes to `/backend` trigger a backend deploy (watch path configured)

---

### #6 — Configure CORS and cookie settings for cross-origin auth

Configure Spring Security CORS and HttpOnly cookie properties for cross-origin use.

Acceptance criteria:
- [ ] Requests from `zwifttool.trivedev.uk` are accepted
- [ ] Requests from other origins are rejected with 403
- [ ] Cookies are HttpOnly, SameSite=Strict, Secure, Domain=trivedev.uk
- [ ] Config is documented in code comments

---

### #7 — Implement JWT filter chain and token strategy

Implement access token (15 min) and refresh token (7 day) strategy with rotation collision handling.

Acceptance criteria:
- [ ] Access token issued as HttpOnly cookie on sign in
- [ ] Refresh token session stored in `user_sessions` table
- [ ] `POST /auth/refresh` issues new access and refresh tokens
- [ ] Old session record is replaced on each refresh
- [ ] Rotation collision edge case is handled
- [ ] Public endpoints are accessible without a token
- [ ] Protected endpoints return 401 without a valid token
- [ ] Filter chain order documented in code comments

---

### #8 — User can sign up with email and password

Backend `POST /auth/signup` + frontend sign-up modal with validation.

Acceptance criteria:
- [ ] User can submit email and password and receive a 201 response
- [ ] Password is hashed in the database, never stored in plain text
- [ ] Duplicate email returns a clear error message in the UI (409)
- [ ] Invalid email format is caught client-side before submission
- [ ] Password shorter than 8 characters is rejected with a clear error

---

### #9 — User can sign in with email and password

Backend `POST /auth/signin` + frontend sign-in modal. Invalid credentials return a generic 401 with no field distinction.

Acceptance criteria:
- [ ] Valid credentials result in HttpOnly cookies being set and user reaching the app
- [ ] Invalid credentials return a generic error message
- [ ] Error message does not distinguish between wrong email and wrong password
- [ ] Cookies are set with correct properties (HttpOnly, SameSite=Strict, Secure)

---

### #10 — User can sign out

`POST /auth/signout` clears both cookies server-side and deletes the session row.

Acceptance criteria:
- [ ] Both cookies are cleared after sign out
- [ ] Session record is deleted from `user_sessions`
- [ ] User is returned to signed-out state in the UI
- [ ] Subsequent requests with the old cookies are rejected

---

### #11 — Implement silent token refresh

Frontend intercepts 401, silently calls `POST /auth/refresh`, retries the original request. Shows sign-in modal if the refresh token is expired.

Acceptance criteria:
- [ ] Expired access token triggers a silent refresh attempt
- [ ] Original request is retried after successful refresh
- [ ] Failed refresh (expired session) shows the sign-in modal
- [ ] No visible interruption to the user when refresh succeeds

---

## Group 2 — Import, Workout Management, and Core Editor

**Rationale:** These issues build the central editing experience: uploading files, viewing and creating workouts, visualising them, and editing every type of interval. All depend on auth from Group 1 and must be complete together before the library and export features in Group 3 can be properly tested.

### #12 — User can upload one or more .zwo files

Frontend-only: file picker for `.zwo` files, client-side XML parsing, flat interval list display. Nothing written to the database at this stage.

Acceptance criteria:
- [ ] File picker accepts .zwo files only
- [ ] Multiple files can be selected at once
- [ ] Each file is parsed client-side and intervals displayed as a flat list
- [ ] Invalid files are rejected with a clear error message
- [ ] Valid files proceed to the section split step

---

### #13 — User can define section boundaries on import

Draggable dividers to define warm-up end and cool-down start. On confirmation, `POST /workouts` saves the structured workout.

Acceptance criteria:
- [ ] Dividers are draggable and snap to interval boundaries
- [ ] Warm-up and cool-down can be omitted (dividers moved to start or end)
- [ ] Main set cannot be empty
- [ ] On confirmation, workout is saved to the database with correct section structure
- [ ] Nothing is written to the database before the user confirms

---

### #14 — User can view a list of their saved workouts

`GET /workouts` + workout list in the left panel with name, last updated, and draft indicator.

Acceptance criteria:
- [ ] List shows all saved workouts for the signed-in user
- [ ] Draft workouts are visually distinguished
- [ ] Clicking a workout loads it into the editor
- [ ] Empty state shown if no workouts exist

---

### #15 — User can create a new blank workout

New workout button creates a blank draft via `POST /workouts` with a default name and an empty main set.

Acceptance criteria:
- [ ] New workout button creates a blank workout
- [ ] Workout is saved to the database as a draft immediately
- [ ] User can begin adding blocks to the main set

---

### #16 — User can edit workout name, author, and description

Inline editable fields for name, author, and description. Changes auto-save on blur via `PUT /workouts/{id}`.

Acceptance criteria:
- [ ] Name, author, and description are editable inline
- [ ] Changes are auto-saved without requiring a save button
- [ ] Updated values are reflected in the workout list

---

### #17 — Implement auto-save and single undo

Debounced auto-save on every interval change. Previous block ID stored in `prev_*_block_id` columns. Undo swaps current back to previous; one level only.

Acceptance criteria:
- [ ] Every interval change triggers an auto-save within a short debounce window
- [ ] Previous block ID is stored before overwriting
- [ ] Undo restores the previous state correctly
- [ ] Undo is disabled when there is no previous state
- [ ] Undo works independently for each section (warmup, mainset, cooldown)

---

### #18 — Workout is displayed as a bar chart in three labelled sections

Bar chart where width = duration, height = %FTP, colour = Zwift zone. Three labelled sections. Total duration and TSS displayed below.

Acceptance criteria:
- [ ] Each interval renders as a bar with correct relative width and height
- [ ] Bar colour matches the Zwift zone for that power level
- [ ] Three sections are clearly labelled
- [ ] Y-axis expands if any interval exceeds 140% FTP
- [ ] Total duration is shown in hh:mm format
- [ ] TSS is shown as a rounded integer

---

### #19 — Implement Zwift zone colour mapping

Utility functions `getZoneForPower(ftpPercent)` and `getColourForZone(zone)` used throughout the editor and bar chart.

Acceptance criteria:
- [ ] Zone is correctly derived from %FTP for all standard ranges
- [ ] Colour is correctly returned for each zone
- [ ] Bar chart uses these utilities consistently
- [ ] Values outside the standard range are handled gracefully

---

### #20 — User can add interval blocks via zone presets

Zone preset buttons (zones 1-5) add a SteadyState block with default duration and %FTP. Defaults reflect any user customisations from #25.

Acceptance criteria:
- [ ] Each zone has a preset button
- [ ] Clicking a preset adds a block with correct default values
- [ ] Added block is immediately editable
- [ ] Preset defaults reflect any user customisations

---

### #21 — User can add Ramp, IntervalsT, and Free Ride blocks

Block type selector for Ramp, IntervalsT, and Free Ride, each with appropriate input fields and visualisation.

Acceptance criteria:
- [ ] All three block types can be added to any section
- [ ] Each type shows the correct input fields
- [ ] Ramp blocks are visualised with a gradient
- [ ] IntervalsT blocks are visualised showing the on/off pattern
- [ ] Free Ride blocks are visually distinct

---

### #22 — User can edit duration, power, and cadence on any block

Inline editor on click. Duration in mm:ss, power as %FTP, cadence in RPM (optional). Changes trigger auto-save.

Acceptance criteria:
- [ ] Duration, power, and cadence are editable on all block types
- [ ] Duration input accepts minutes and seconds
- [ ] Power input is in %FTP
- [ ] Cadence is optional and can be left blank
- [ ] Changes trigger auto-save

---

### #23 — User can reorder and delete blocks within a section

Drag to reorder within a section. Delete button per block. Both trigger auto-save. Main set cannot be emptied.

Acceptance criteria:
- [ ] Blocks can be dragged to reorder within their section
- [ ] Blocks cannot be dragged between sections
- [ ] Delete button removes a block from the section
- [ ] Reorder and delete both trigger auto-save
- [ ] Deleting the last block in main set is prevented

---

### #24 — User can add text events to intervals

Add text events (Zwift coach messages) with a time offset from workout start and a message string. Shown as markers on the timeline. Included in export.

Acceptance criteria:
- [ ] Text events can be added with a time offset and message
- [ ] Text events are shown as markers on the timeline
- [ ] Text events can be edited and deleted
- [ ] Text events are included in the exported .zwo file at the correct time offset

---

### #25 — User can customise zone preset defaults

User can edit default duration and %FTP per zone. %FTP hard-blocked outside valid zone range. Database row only created on deviation from system defaults.

Acceptance criteria:
- [ ] User can edit default duration and %FTP for each zone
- [ ] %FTP cannot be set outside the valid range for the zone
- [ ] Custom defaults are used when adding new blocks via preset buttons
- [ ] Database row is only created when the user deviates from system defaults
- [ ] Resetting to default removes the custom row

---

## Group 3 — Block Library, Bulk Edit, and Export

**Rationale:** These issues build on top of the complete editor from Group 2. The library features require working workouts to save from, bulk edit requires a working library to pull blocks from, and export requires complete workout data — so all depend on Groups 1 and 2 being stable.

### #26 — User can save a section to the block library

Save to library button on each section. Prompts for name and optional description. `POST /blocks` with `is_library_block = true`. Pre-computes `duration_seconds` and `interval_count`.

Acceptance criteria:
- [ ] Each section has a save to library button
- [ ] User is prompted for a name (required) and description (optional)
- [ ] Saved block appears in the library panel immediately
- [ ] `is_library_block` is set to true

---

### #27 — User can browse and preview saved blocks in the library panel

Right panel shows library blocks filtered by section type. Each block shows name, description, duration, and interval count. Clicking shows a preview.

Acceptance criteria:
- [ ] Library panel shows blocks filtered by section type
- [ ] Each block shows name, description, duration, and interval count
- [ ] Clicking a block shows a preview
- [ ] Only `is_library_block = true` blocks are shown
- [ ] Empty state shown if no blocks exist for a section type

---

### #28 — User can replace a section with a saved library block

Replace button per section (or drag from library). Confirmation before replacing. `PUT /workouts/{id}` updates the block ID and stores the previous for undo.

Acceptance criteria:
- [ ] User can replace any section with a library block
- [ ] Confirmation is shown before replacing
- [ ] Replacement is reflected immediately in the bar chart
- [ ] Auto-save triggers after replacement
- [ ] Previous section is stored for undo

---

### #29 — User can create a block independently in the library

New block button in the library panel. User selects section type and builds the block using the same editor tools. `POST /blocks` with `is_library_block = true`.

Acceptance criteria:
- [ ] User can create a new library block from scratch
- [ ] Section type is selected at creation time
- [ ] All interval editing tools are available
- [ ] Block is saved to library and appears in the panel

---

### #30 — User can delete a saved library block

Delete option per library block. Confirmation before deletion. Workouts currently using the block are not affected.

Acceptance criteria:
- [ ] Delete option available on each library block
- [ ] Confirmation prompt before deletion
- [ ] Deleted block no longer appears in the library panel
- [ ] Workouts that used the block are not affected

---

### #31 — User can select multiple saved workouts for bulk editing

Checkbox multi-select on the workout list. Selected count shown. Bulk actions toolbar appears on multi-select.

Acceptance criteria:
- [ ] User can select multiple workouts using checkboxes
- [ ] Selected count is shown clearly
- [ ] Bulk actions toolbar appears on multi-select
- [ ] Workouts can be deselected individually or all cleared

---

### #32 — User can bulk-replace a section across multiple workouts

With multiple workouts selected, user picks a section type and library block. Preview, confirm, then `POST /workouts/bulk-replace`. Returns a zip of updated `.zwo` files.

Acceptance criteria:
- [ ] User can select a section type and library block for bulk replacement
- [ ] Preview shows which workouts will be affected and how
- [ ] Confirmation required before applying
- [ ] All selected workouts are updated in the database
- [ ] Previous block IDs are stored for undo on each workout
- [ ] Zip of updated .zwo files is returned on completion

---

### #33 — User can export a single workout as a .zwo file

`GET /workouts/{id}/export` generates a valid `.zwo` XML file. All interval types serialised correctly. Text events included.

Acceptance criteria:
- [ ] Export produces a valid .zwo XML file
- [ ] File is named after the workout
- [ ] All interval types are correctly serialised to XML
- [ ] Text events are included at the correct time offsets
- [ ] Warm-up and cool-down are omitted from the XML if the section is empty
- [ ] File downloads in the browser

---

### #34 — User can export multiple workouts as a .zip file

`POST /workouts/export` accepts a list of workout IDs and returns a zip of `.zwo` files. Duplicate workout names handled.

Acceptance criteria:
- [ ] Multiple workouts can be selected for export
- [ ] Each workout produces a valid .zwo file inside the zip
- [ ] Zip downloads in the browser
- [ ] Filenames inside the zip are based on workout names
- [ ] Duplicate workout names are handled (e.g. by appending a number)

---

## Review checkpoint

After each group is complete, review the following before starting the next group:

- All acceptance criteria checked off for every issue in the group
- No regressions in related areas
- Code reviewed against conventions in CLAUDE.md
