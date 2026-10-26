# Lessavio Web

React + TypeScript browser edition of the Lessavio desktop workspace. Preserves the desktop design, students, calendar (month/week), recurring lessons, payments, financial summaries, English/Russian/Ukrainian interfaces, Firebase authentication and opt-in analytics. At widths up to 800 px the sidebar becomes a five-tab bottom menu with safe-area support.

## Run

```sh
npm install
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Deploy the generated `dist/` directory to static HTTPS hosting.

## Data

Teaching data is stored in IndexedDB in this browser, separately for guest and Firebase accounts. It survives reloads. Clearing site data, private browsing, browser eviction or changing origin can remove or hide it: export JSON backups regularly in Settings. Desktop JSON backups can be imported using the same version-1 validation. Account sign-in does not synchronize teaching data between browsers or the desktop app. Guest data can be explicitly copied into an empty account workspace.

## Firebase

Copy `.env.example` to `.env` and provide the Firebase Web app configuration. Without it guest mode works and sign-in is disabled. Enable Email/Password and Google providers and authorize the deployment hostname in Firebase Authentication. Environment configuration is embedded at build time; never put service account credentials in VITE variables.

Analytics uses the same allowlisted events and parameters as desktop, with platform `web`. Consent defaults off and is stored per workspace. No student details or financial amounts are sent. Development never sends analytics. Real authentication and GA4 ingestion require configured Firebase and live verification.

## Browser differences

Reminders use the browser Notification API on HTTPS/localhost when permitted. The tab must stay open; background throttling and device sleep can delay delivery. Browsers without this API cannot enable reminders. Native SQLite, system tray/background services and installer integration do not apply to this edition. Initial loading requires a network connection; offline application installation/caching is not implemented. Work in one active tab per workspace to avoid competing edits.

## Source structure

```text
src/
  app/                  # Application entry, account lifecycle, global styles
  domain/               # Shared teaching data types, validation and balances
  features/
    analytics/          # Consent, event policy, transport and settings
    auth/               # Firebase auth API, session rules and account forms
    calendar/           # Calendar UI, recurrence and scheduling rules
    finance/            # Financial calculations and report UI
    reminders/          # Browser notification settings and scheduling hook
    students/           # Student colors and archive visibility rules
    workspace/          # Teaching workspace, navigation and workspace types
  infrastructure/
    firebase/           # Firebase client configuration
    storage/            # IndexedDB, repository, JSON backups and storage tests
  shared/
    i18n/               # Translation helpers and en/ru/uk catalogs
    ui/                 # Reusable Select and DateTimePicker controls
  tests/                # Tests covering business rules across features
  main.tsx              # React bootstrap
scripts/                # Translation validation
```

Keep feature-specific components in that feature's `components/`, pure rules and types in `model/`, external service calls in `api/`, and React hooks in `hooks/`. Shared UI must not depend on feature components. Use `infrastructure` for browser persistence and service configuration. The `app` layer composes the workspace and authentication flow. Cross-feature business tests live in `src/tests`; infrastructure tests stay next to the implementation. Import concrete modules directly rather than adding barrel exports for every folder.

### Local Google sign-in

Use the `http://localhost:<port>/` URL printed by `npm run dev`, rather than `127.0.0.1`. The existing Firebase project authorizes `localhost`; `127.0.0.1` is a different hostname. For deployment, add the actual hostname under Firebase Authentication → Settings → Authorized domains. Browser teaching data is scoped to the origin: export a backup before switching between `127.0.0.1` and `localhost` if the old address contains data.
