# GENIUS ADMIN PREMIUM — 5.2.0

Production-oriented React + Vite + Capacitor architecture for GENIUS BIOLOGY.

## Architecture

```text
src/
├── app/
│   └── App.jsx                  # App Shell / orchestration
├── components/
│   └── ui.jsx                  # shared mobile UI primitives
├── screens/
│   ├── core.jsx                # login, dashboard, students, groups, schedule
│   ├── operations.jsx          # attendance, Student 360, cards, sessions, finance forms, exams, books
│   ├── finance.jsx             # finance, reports, notifications, activity
│   ├── settings.jsx            # security, backup, Drive, promotion, dictionaries, archive
│   └── index.js
├── engines/
│   ├── attendance/
│   ├── books/
│   ├── exams/
│   ├── finance/
│   ├── notifications/
│   ├── search/
│   ├── session/
│   ├── students/
│   └── backup/
├── services/
│   ├── backup/
│   ├── googleDrive/
│   ├── notifications/
│   ├── scanner/
│   ├── whatsapp/
│   └── security.js
├── db/
│   ├── db.js
│   └── repositories/
├── hooks/
├── utils/
└── tests/
```

`App.jsx` is now an orchestration/App Shell layer. Domain calculations are routed through engines rather than duplicated inside screens.

## Data guarantees

- IndexedDB `DB_VERSION = 5`.
- `paymentAllocations` and `outbox` stores are part of the schema.
- Backup envelope contains app identifier, backup format, app version, schema version, timestamp, academic year and SHA-256 checksum.
- Restore validates the envelope/checksum before replacing data and keeps an in-memory pre-restore snapshot for rollback on transaction failure.
- Monthly charges are generated through the finance service and respect student discounts.
- Every normal write creates a local outbox record (`PENDING`) for future sync integration without making cloud connectivity a runtime dependency. No cloud sync backend is claimed in this release; Google Drive remains backup-only by design.

## Connected engines

- Student 360 → `engines/students/engine.js`
- Exam statistics/ranking → `engines/exams/engine.js`
- Book inventory → `engines/books/engine.js`
- Attendance seeding/statistics → `engines/attendance/engine.js`
- Session lifecycle → `engines/session/engine.js`
- Payment allocation → `engines/finance/ledger.js`
- Notification rules → `engines/notifications/rules.js`
- Academic promotion → `engines/students/promotion.js`
- Global search → `engines/search/engine.js`
- Backup/checksum → `engines/backup/index.js`

## Native / Android

- Capacitor fullscreen + safe-area handling.
- Status Bar overlay.
- Keyboard configuration.
- Haptics.
- Filesystem + native share.
- Local notifications.
- Native ML Kit QR / Code128 scanning adapter.
- Android 35 CI target.
- Branding assets included under `public/branding` and `resources/`.

## Google Drive

Google Drive is **backup-only**. The Google Identity script is loaded lazily only when the Drive screen is opened, so normal Offline First operation does not require Google connectivity.

Flow:

`Connect → OAuth token → GENIUS ADMIN BACKUPS folder → upload verified JSON → list backups → restore verified backup`

Tokens are kept in memory and are not persisted to IndexedDB.

## Validation / verification

Run locally after dependencies are installed:

```bash
npm install
npm run verify
```

Android debug:

```bash
npm run cap:debug
```

Android release (requires the project's signing configuration in Android Studio/Gradle):

```bash
npm run cap:release
```

The GitHub Actions Android workflow now runs tests before the web build and APK assembly.

## Important release note

This repository intentionally does **not** contain a generated `android/` directory or a production signing keystore. `npx cap add android` / `npx cap sync android` creates the native project, and the release signing credentials must remain outside source control.
