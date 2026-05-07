# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.2.0] - 2026-05-07

### Added

- Responsive three-panel layout that stacks vertically on mobile and tablet (#145)
- Responsive header that prevents overflow and wraps controls on small screens (#146)
- Focus trap, `aria-dialog`, and focus restoration across all modals (#147)
- Touch targets increased to 44×44px minimum for all icon-only buttons (#149)
- `aria-live` regions to announce loading and error states to screen readers (#151)
- Mobile side-tab navigation for the workouts and blocks panels
- Section splitter skipped for multi-file imports to streamline the flow (#153)
- Screen-reader-only `<h1>` to establish a correct heading hierarchy (#181)
- `aria-required` on all required form inputs (#186)
- `aria-pressed` on `BlockCard` selection state inside `BulkReplaceModal` (#188)

### Fixed

- Colour contrast improved across placeholder text, disabled states, and links to meet WCAG 2.1 AA (#148)
- `WorkoutCanvas` and `SectionSplitter` SVG now scales responsively on small screens (#150)
- `BlockCard` replaced `role="button"` div with a semantic `<button>` element (#152)
- 403 responses in the API client now trigger a token refresh and automatic retry (#154)
- Scroll jump when selecting a workout from the library (#156)
- Header and footer hidden behind iOS browser chrome on mobile, resolved by switching to `h-dvh`
- Text selection and drag reliability issues on the workout canvas on mobile
- Icon-only buttons (Save, Replace, Undo) now displayed correctly on mobile
- Boundary handle drag target restricted to the grab capsule above the bars
- Palette drag dropping prematurely due to `pointercancel` events on touch devices
- Touch conflicts between the workout canvas and the interval palette on mobile
- Pull-to-refresh browser gesture triggering a full page reload in the editor
- Editor state now restored after an accidental page reload
- `CreateBlockModal` converted to use the shared `Modal` for focus trap and consistent a11y (#175)
- `IntervalPalette` items now keyboard-accessible (#176)
- Auth form field errors associated with their inputs via `aria-describedby` (#177)
- `BlockCard` icon buttons raised to `text-zinc-300` to meet WCAG 1.4.11 non-text contrast (#178)
- Placeholder text contrast raised to `zinc-400` across all modals (#179)
- Mobile Save, Replace, and Undo buttons enlarged to the 44×44px touch target minimum (#180)
- Muted text raised from `text-zinc-500` to `text-zinc-400` for WCAG 1.4.3 contrast (#182)
- Panel collapse buttons aligned to the `text-zinc-400` muted-text baseline (#183)
- `BarInlineOverlay` trash buttons enlarged to the 44×44px touch target minimum (#184)
- `WorkoutCard` delete button enlarged to the 44×44px touch target minimum (#185)
- Auth modal inputs gained `focus:ring-offset` for a clearly visible focus ring (#187)

### Security

- Backend now fails fast at startup if `CORS_ALLOWED_ORIGIN` is empty rather than booting with a permissive default (#190)

## [1.1.0] - 2026-04-19

### Added

- Normalised power (NP) and intensity factor (IF) displayed in the editor, calculated live as FTP is typed (#107)
- Trive Dev branding applied across the application, including favicon and footer (#135)
- Privacy policy page (#133)
- Vitest unit test suite and Playwright E2E tests, with GitHub Actions CI workflow (#77)
- Automated `.zwo` import/export round-trip test fixture and assertion (#81)

### Fixed

- Duplicate workout name clash on import now prompts the user to rename, replace, or skip (#84)
- FTP percentage decimal precision lost on `.zwo` import due to integer rounding (#106)
- `.zwo` export included an XML declaration that Zwift does not expect; removed (#80)
- Several `.zwo` export field mapping errors identified by the round-trip test (#80)
- NullPointerException in workout delete when warm-up or cool-down block is absent (#79)
- Workout fetch for bulk replace and multi-file export now batched correctly to avoid request limits (#70)
- ZwiftToolApplicationTests context load failure caused by missing bean configuration (#45)
- Suppressed spurious Spring Security dev-mode password warning (#78)
