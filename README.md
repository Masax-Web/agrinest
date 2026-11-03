# AGRI-NEST — Build & Platform Packaging

Quick start for packaging the existing web app into a PWA and native shells using Capacitor.

Prerequisites
- Node.js (16+)
- For Android: Android Studio + SDK
- For iOS: Xcode on macOS

Local web preview
```
npm install
npm run build:web
npm run start
```

Open `http://localhost:8080` — you land on the role picker. Sign in, register, or tap a role card to enter with a sample account. Data persists in your browser via `localStorage` (orders, listings, spray diary, wallet).

Prepare web assets (copies `app/` → `www/`)
```
npm run build:web
```

If npm is not available, use the PowerShell fallback:
```
powershell -ExecutionPolicy Bypass -File tools/build-web-ps.ps1
```

Initialize Capacitor (one-time)
```
npm run cap:init
npx cap add android    # run on a machine with Android SDK
npx cap add ios        # run on macOS with Xcode
```

Build & run
- Android: open `android/` in Android Studio and run.
- iOS: open `ios/App/App.xcworkspace` in Xcode and run (macOS only).

Notes
- Native builds require platform tooling (Android Studio / Xcode) and signing keys.
- This repository prepares the web assets and Capacitor configuration. Plugins and native integrations should be added per feature requirements (camera, geolocation, push).

Authentication setup, Google OAuth callback configuration, and the staging-first rollout checklist are documented in [docs/authentication.md](./docs/authentication.md).

The farmer Loan Spending planner stores plans and expense notes in browser storage, separately per signed-in account on that device. It does not connect to lender accounts, move or restrict money, or make credit decisions. The supplied notebook describes synthetic training data; until its model artifact and schema are reviewed and evaluated, model predictions are intentionally disabled. Voluntary feedback exports are manual aggregate CSV downloads; they are not training-ready, do not upload data, and do not train a model automatically.