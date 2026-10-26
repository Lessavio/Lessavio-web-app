# Functional review — 26 October 2026

Reviewed: Lessavio Web 0.1.0 and desktop source 0.5.2, on macOS. This is a functional audit, not a claim that every platform or production integration is certified. No production accounts were created and no production emails were sent. All teaching records entered during the review were synthetic, using separate localhost ports and a separate native QA identifier.

## Summary

- Web: 39 TypeScript/storage/business-rule tests passed; production build passed; 337 translation keys audited in each language.
- Desktop: 36 TypeScript/business-rule tests and 9 Rust tests passed; production frontend build passed; 327 translation keys audited in each language.
- Total: 84 automated tests passed.
- Production dependency audits: zero known vulnerabilities reported for both projects (`npm audit --omit=dev`). This does not cover the Rust dependency advisory database.
- Both Vite builds warn about a JavaScript chunk larger than 500 kB. Builds succeed; performance on slower mobile hardware was not benchmarked.
- One confirmed data-loss scenario in concurrent web workspace saves. One confirmed error-message quality issue. Two native confirmation paths require device verification.

## Findings

### P1 — concurrent web tabs can overwrite each other's teaching data (confirmed)

Location: `src/infrastructure/storage/browserDatabase.ts`, `saveWorkspace`, lines 34–36.

The repository replaces the entire workspace with `store.put(workspace, scope)`. There is no expected revision check, single-writer lock or other conflict detection. IndexedDB serializes the writes, but it cannot detect that the second write was built from a stale snapshot.

Reproduction used the actual repository functions with fake-indexeddb, not real teaching data:

1. Save an empty workspace.
2. Load it twice, representing two open tabs.
3. Add student A to snapshot 1 and save.
4. Add student B to snapshot 2 and save.
5. Reload: only student B remains. Observed result: expected 2 students, actual 1.

The README already asks users to work in one active tab, but the application does not enforce that restriction. Until addressed, simultaneous editing of the same workspace in multiple tabs is unsafe. A robust fix should detect stale revisions transactionally or enforce one writer per workspace, with a clear recovery/reload UI. Broadcast-only refresh is insufficient to make read-modify-write operations atomic.

### Native confirmation paths — unresolved compatibility risk (source review, not reproduced in native UI)

Desktop `src/App.tsx` line 188 uses `window.confirm` before removing an erroneous payment. Desktop `src/components/Account.tsx` line 10 uses it before copying guest data into an empty account workspace. The same browser confirmation approach had previously been replaced for recurring-series cancellation because it did not work reliably in the desktop WebView.

These two remaining actions need native verification or conversion to the existing in-app confirmation pattern. I could not establish their behavior on this machine: computer-control access to the separate QA app was denied by macOS. This is a compatibility risk, not a newly reproduced runtime failure. The SQLite copy operation itself passes the native tests, including protection against overwriting a nonempty target.

### P3 — invalid backup exposes a raw JSON parser error (confirmed)

Location: web `src/infrastructure/storage/workspaceRepository.ts`, line 26.

Importing a file containing `{ invalid JSON` displays `Expected property name or '}' in JSON at position 2 (line 1 column 3)`. Existing students, lessons and balances remain intact, and no restore confirmation appears. Data protection works; the error should instead be a translated, user-facing backup validation message.

## Executed browser scenarios

| Area | Web | Desktop browser preview |
| --- | --- | --- |
| First run and local guest mode | Passed | Passed |
| Profile creation | Passed, persisted | Passed, preview is intentionally in memory |
| Student creation, subject, fractional price, selected color | Passed, 450.50 UAH, color 2 | Passed, 300 UAH, color 3 |
| Search filter | Nonmatching filter hides the student; clearing restores it | Not separately exercised |
| Single lesson creation | Passed, price inherited from student | Passed, price inherited from student |
| Overlapping single lesson | Blocked with visible error | Covered by shared business tests; not repeated in UI |
| Marking lesson completed | Passed, balance debited 450.50 | Passed, balance debited 300 |
| Payment and financial totals | 500 received − 450.50 earned = 49.50 credit | 350 received − 300 earned = 50 credit |
| Recurring lessons | Tuesday, 4-week range: preview and creation produce 4 occurrences | Rule generation/editing covered by automated tests; not separately created in this UI session |
| Calendar | Month and week display checked | Navigation shell and business rules covered; drag-and-drop not verified |
| Date picker Close | Closes and stays closed | Shared implementation; not repeated in UI |
| Cancel upcoming series | In-app confirmation works; all 4 future occurrences cancelled | Covered by business tests; not repeated in UI |
| Archive student | Active count becomes 0; finance still retains completed lesson/payment and 49.50 credit | Archive visibility covered by business tests |
| Backup export | Actual downloaded JSON: 1 student, 5 lessons, 1 completed, 4 cancelled, 50000 minor-unit payment total | Disabled in browser preview by design |
| Backup restore | Confirmation shows 1 student and 5 lessons; restore succeeds | Native dialog not verified |
| Invalid backup | Rejected; existing data remains; raw parser message noted above | Validator covered by tests; native picker not verified |
| Browser reload | Profile, student, lesson status and account session retained | Preview data is intentionally not durable; SQLite durability covered by Rust tests |
| Languages | English UI exercised; all en/ru/uk catalogs audited | English, Ukrainian and Russian settings switched successfully; all catalogs audited |
| Mobile | Actual 390 px iframe viewport: bottom menu visible, five sections, Finances navigation works | Desktop UI has a native minimum width; mobile not applicable |
| Google button | Present only in web | Absent from desktop welcome and email forms |

The mobile check is a narrow browser viewport, not a physical iPhone/Android test. Native browser UI permission prompts, keyboard behavior and safe-area insets on real devices remain unverified.

## Authentication checks (official Firebase Auth Emulator)

The official Firebase CLI ran only the Auth emulator for `demo-lessavio` at `127.0.0.1:9099`. Separate dev-server environment overrides targeted that emulator; production environment files were not changed.

- Web: email/password registration succeeded, account workspace opened, profile was saved, reset-email request returned success, sign-out returned to welcome, wrong password showed a translated error and released the button, correct sign-in reopened the saved profile, reload retained the signed-in session.
- Desktop browser preview: signed in to the same emulator account used by web, correctly opened an independent empty teaching workspace, signed out, and registered a separate desktop test account successfully.
- No actual email verification link was followed; real mail delivery and real password-reset links were not tested.
- Real Google OAuth in the web app was not completed; no Google identity was selected. Desktop Google auth is intentionally removed in 0.5.2.
- Native packaged Firebase persistence and the native networking/CSP path were not established by these browser emulator checks.

## Automated coverage

Business tests cover exact monetary amounts, payment/earned separation, carried balances, recurrence limits, weekly/biweekly phase, overlap rejection, DST gaps/ambiguities, calendar month bounds, series edits preserving history, moving occurrences between students, archiving and color validation, malformed backups, auth account scopes and stale transitions, analytics consent revocation and event allowlists.

Rust tests cover SQLite migration and rollback, workspace isolation, backup snapshots, explicit guest copying without target overwrite, atomic revisions/tombstones, and reminder eligibility/deduplication migration.

These automated checks do not simulate actual notification delivery, real OAuth, native dialogs or an installer upgrade.

## Native QA attempt and remaining release checks

A debug native QA build was compiled and launched using identifier `com.lessavio.functional-qa`, product name `Lessavio QA`, and a separate localhost frontend. The regular application's identifier and user database were not changed. A temporary app bundle was prepared in `/private/tmp/Lessavio Functional QA.app` solely for UI access. The computer-use tool returned `Computer Use permissions are not granted`, so native UI automation could not proceed.

Still required before describing 0.5.2 as fully release-verified:

- Native payment deletion and guest-copy confirmation dialogs.
- Native backup save/open dialogs and a full import/export cycle.
- Notification permission, actual delivery, minimized-app and sleep behavior; also real mobile browser notifications for web.
- Native session persistence and real Firebase email/verification/reset behavior.
- Web Google OAuth with a user-controlled test identity on the deployed authorized domain.
- Calendar drag-and-drop completion and touch-device editing.
- macOS installer upgrade, Intel/Apple Silicon installation and Windows installation/runtime checks.
- Production GA4 ingestion after explicit consent. Development intentionally uses a no-network analytics adapter.
- Resolution or enforced single-tab protection for the confirmed web concurrent-write issue.

No application behavior was changed as part of this audit. Existing source edits from the 0.5.2 preparation were preserved. Temporary UI fixtures and review-owned servers/emulator are removed or stopped at teardown; no release was published.
