# Architecture Quick Reference

## Modules (V6.1.1 Baseline)

| Module | Approx Line | Role |
|--------|-------------|------|
| **CONSTANTS** | ~223 | Version, storage prefix `pa_`, thresholds (`BIG_LOSS_THRESHOLD_BB: 40`, `MAX_STORAGE_MB: 4`), defaults |
| **Utils** | ~238 | debounce, formatTime, escapeHtml, safeFixed, Base64, dropdown, initToggleGroup, parseGGHandHistory, checkStorageQuota |
| **Store** | ~477 | localStorage CRUD with `pa_` prefix. Types: settings, timerState, standup, log_*, sessions, handReviews, weeklyReviews, tiltLogs. Old `pokerAssistantData` auto-migration. `importAll()` is incremental merge. |
| **App** | ~505 | Main controller. Owns `sound`/`vibrateOn` prefs, `confirmDelete`, `init()` bootstrapper, unified input auto-select |
| **App.Timer** | ~660 | Pomodoro timer with long-break, skip-break, daily log, phase persistence |
| **App.Odds** | ~703 | Pot odds, MDF, SPR, geometric sizing, implied odds, sizing cheat-sheet |
| **App.TiltRescue** | ~787 | 30s emergency overlay (breathing + quotes + tilt log) |
| **App.DataSync** | ~796 | Clipboard import/export (Base64 JSON), CSV export |
| **App.Review** | ~835 | Session CRUD (with edit), hand review CRUD (with edit + GG import overlay), weekly review (with edit + cross-week trend), profitChart rendering |

## 5 Most Important Rules

1. **Single file, IIFE only** — Everything lives in `index.html`. No ES6 modules (`import`/`export`), no external deps. `file://` protocol forbids modules.
2. **`pa_` prefix on all localStorage keys** — Never touch localStorage without it. Old data from key `pokerAssistantData` is auto-migrated on first load.
3. **Dual-scenario runtime** — Same code runs under `file://` (offline, no SW/notifications) and `https://` (Netlify, SW + notifications). Always guard SW/notification code with protocol checks.
4. **Store.importAll() is incremental merge** — Importing data **adds** new records, never overwrites existing ones. settings/timerState/standup are always kept from local.
5. **All user data in HTML must pass `Utils.escapeHtml()`** — Direct string concatenation of user input into HTML is forbidden. All floats displayed via `Utils.safeFixed()`.
