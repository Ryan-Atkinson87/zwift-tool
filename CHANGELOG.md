# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

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
