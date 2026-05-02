# Claude Usage Tracker — History & Analysis

**Date:** 2026-04-24
**Scope:** Personal use, single browser, no backend

---

## Context

The app currently has no memory. Every page reload loses your data, and there's no way to see whether your Claude usage is trending up, down, or holding steady over time. This spec adds localStorage-based history with export/import, a simple SVG trend chart, and a rolling analysis line — plus targeted code cleanup to keep the codebase lean.

---

## Architecture

### New file: `history.js`
All history logic lives here. `app.js` calls it after a successful parse. Nothing else touches localStorage directly.

**Storage keys:**
- `"claude-usage-history"` — JSON array of entry objects, max 200, oldest pruned first
- `"claude-usage-last-input"` — raw textarea string from last valid parse

**Entry shape:**
```json
{
  "ts": 1714000000000,
  "sessionPct": 74,
  "weeklyPct": 65,
  "sessionHoursLeft": 1.5,
  "weeklyHoursLeft": 48
}
```

**Exported functions:**
- `saveEntry(entry)` — appends, prunes to 200, persists
- `loadHistory()` — returns array sorted oldest-first
- `exportJSON()` — triggers browser download of full history as `.json`
- `importJSON(file)` — reads File object, merges by `ts`, re-persists
- `clearHistory()` — wipes storage key
- `analyzeHistory(entries)` — returns `{ sessionAvg7d, weeklyAvg7d, sessionTrend, weeklyTrend }` where trend is `"up" | "down" | "flat"`

### Modified files
- `app.js` — call `saveEntry()` and `saveLastInput()` after valid parse; restore textarea on load; add config object; remove dead clock interval; debounce input handler (300ms)
- `stats.js` — no changes needed; `analyzeHistory` lives in history.js
- `renderer.js` — add `renderHistory(entries)` function that builds history panel; extract DOM helpers to flatten nesting
- `index.html` — add `<script src="history.js">` before `app.js`; add history panel placeholder `<div id="history-panel">`
- `styles.css` — add styles for history panel, table, chart, export/import buttons

---

## Features

### Auto-save
After every valid parse, call `saveEntry()` silently. No user action required. Also save the raw textarea text to `"claude-usage-last-input"`.

### Textarea restore
On `DOMContentLoaded`, if `"claude-usage-last-input"` exists, populate the textarea and trigger a parse. User sees their last session immediately on reload.

### History panel
Collapsible `<details>` element below the results section. Default: collapsed.

Contains:
1. **Analysis line** — "7-day avg: session 68%, weekly 71% — session trending up, weekly flat"
2. **SVG trend chart** — `viewBox="0 0 400 120"` with `width: 100%` via CSS (responsive), two polylines (session=indigo, weekly=green), X=date, Y=0–100%. No axes labels except start/end dates below the chart. Dots at each data point.
3. **Table** — last 10 entries, columns: Date/Time | Session % | Weekly %. Compact, monospace font, no actions per row.
4. **Buttons row** — "Export JSON" | "Import JSON" | "Clear history" (destructive, styled subdued)

### Export
`exportJSON()` creates a Blob from the full history array, triggers `<a download="claude-usage-history.json">`. No confirmation needed.

### Import
File input (hidden, triggered by button click). On file select, call `importJSON(file)`. Merges by `ts` (no duplicates). Re-renders history panel after merge. No confirmation needed.

### Clear history
Calls `clearHistory()` only after `confirm("Clear all history? This can't be undone.")`. Re-renders panel to empty state after.

---

## Code Cleanup (alongside feature work)

| Item | Location | Change |
|------|----------|--------|
| Magic numbers | `app.js` | Move `SESSION_WINDOW_HOURS=5`, `WEEKLY_WINDOW_HOURS=168`, suggestion thresholds into a `const CONFIG = {}` at top of file |
| Dead clock interval | `app.js` ~L72 | Delete `setInterval` targeting `#live-clock` (element doesn't exist) |
| Debounce | `app.js` | Wrap input handler in 300ms debounce |
| Flatten renderer | `renderer.js` | Extract card-row builder and progress-bar builder into named helpers |

---

## Verification

1. Paste valid usage text → check localStorage key `claude-usage-history` in DevTools → entry appears
2. Reload page → textarea repopulates, results render automatically
3. Paste 3–4 more entries with different values → open history panel → table shows entries, chart shows lines, analysis line shows averages
4. Click Export → `.json` file downloads with correct entries
5. Clear history → confirm dialog → panel shows empty state
6. Import the exported file → entries reappear, no duplicates
7. Import the same file twice → entry count doesn't grow (dedup by exact `ts` value)
8. Resize to mobile width → history panel doesn't overflow
