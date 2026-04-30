# UX Improvements: Paste Button, Layout Reorder, Dedup History

## Context

Three coordinated UX improvements to reduce friction when using the tracker:
1. A paste button that auto-fills the textarea from clipboard
2. Results displayed before suggestion (more important info first)
3. History deduplication to prevent redundant rows from repeated pastes

---

## 1. Paste Button with Clipboard Detection

**Where:** `index.html` btn-row, `app.js` event handler

Add a "Paste" button between "⬡ Open Claude Usage" and "Clear". On click, call `navigator.clipboard.readText()` and set `textarea.value` to the result, then trigger `run()`.

If clipboard access is denied or unavailable, the button does nothing (silent fail — no error shown, since the user can still paste manually).

**Files changed:**
- `index.html` — add `<button id="btn-paste">Paste</button>` in `.btn-row`
- `app.js` — add click handler for `btn-paste`

---

## 2. Reorder Layout: Results Before Suggestion

**Where:** `index.html`

Move `<div class="results" id="results"></div>` to appear immediately after `<div id="error"></div>`, before `<div id="suggestion"></div>` and the pacing controls.

New order:
1. `.input-area`
2. `#error`
3. `#results`
4. `#suggestion`
5. `.pacing-controls`
6. `.pacing-tips`
7. `#history-panel`

**Files changed:**
- `index.html` — reorder divs only, no logic changes

---

## 3. Deduplicate History on Save

**Where:** `history.js` → `saveEntry()`

Before pushing a new entry, compare its data fields to the most recent entry in history. If all four fields match (`sessionPct`, `weeklyPct`, `sessionHoursLeft`, `weeklyHoursLeft`), skip the save.

```
function saveEntry(entry) {
  const history = loadHistory();
  const last = history[history.length - 1];
  if (last &&
      last.sessionPct === entry.sessionPct &&
      last.weeklyPct === entry.weeklyPct &&
      last.sessionHoursLeft === entry.sessionHoursLeft &&
      last.weeklyHoursLeft === entry.weeklyHoursLeft) return;
  // existing save logic...
}
```

**Files changed:**
- `history.js` — `saveEntry()` only

---

## Verification

1. Open app, paste usage text — results appear above suggestion
2. Click "Paste" button — clipboard content fills textarea and results render
3. Paste same text again — history panel shows no new duplicate row
4. Clear and paste different text — new history entry appears
