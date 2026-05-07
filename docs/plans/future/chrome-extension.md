# Chrome Extension: Claude Usage Tracker

Convert the existing PWA into a Chrome extension that reads usage data directly from
`https://claude.ai/settings/usage` — no copy-paste required.

## Goal

A browser action popup that automatically scrapes the usage page DOM and renders the
full dashboard (session card, weekly card, sleep/windows card, suggested pacing, history).

---

## How it works today (PWA)

1. User visits `claude.ai/settings/usage` and manually copies the page text.
2. Pastes it into the textarea in the PWA.
3. `parseUsageText()` (parser.js) extracts percentages and reset times from raw text.
4. `computeStats()` (stats.js) calculates target % and status.
5. `renderer.js` builds and renders the cards.

## How it will work (extension)

1. User opens the extension popup (or it auto-refreshes).
2. A content script injected into `claude.ai/settings/usage` reads the live DOM.
3. Extracted data is passed to the popup via `chrome.runtime.sendMessage`.
4. The popup runs the same parser → stats → renderer pipeline, with no textarea needed.

---

## File Structure

```
chrome-extension/
├── manifest.json          # MV3 manifest
├── popup.html             # Popup shell (reuses styles from the PWA)
├── popup.js               # Popup entry: receives data, runs renderer pipeline
├── content.js             # Content script: scrapes the usage page DOM
├── background.js          # Service worker: optional auto-refresh scheduling
├── src/
│   ├── parser.js          # Unchanged from PWA
│   ├── stats.js           # Unchanged from PWA
│   ├── renderer.js        # Unchanged from PWA (minus textarea wiring)
│   ├── history.js         # Unchanged from PWA
│   └── alarm.js           # Unchanged from PWA
├── styles/
│   └── popup.css          # Adapted from styles.css (max-width for popup)
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

All core logic files (`parser.js`, `stats.js`, `renderer.js`, `history.js`, `alarm.js`)
are copied verbatim. Changes are isolated to the three new entry points.

---

## manifest.json (MV3)

```json
{
  "manifest_version": 3,
  "name": "Claude Usage Tracker",
  "version": "1.0.0",
  "description": "Track Claude session and weekly usage without copy-pasting",
  "permissions": ["storage", "alarms", "tabs"],
  "host_permissions": ["https://claude.ai/*"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/icon-16.png", "48": "icons/icon-48.png" }
  },
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["https://claude.ai/settings/usage"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "icons": { "48": "icons/icon-48.png", "128": "icons/icon-128.png" }
}
```

---

## content.js — DOM scraping strategy

The usage page renders server-side React. The text layout matches what `parseUsageText()`
already handles. Two scraping options, in preference order:

### Option A — innerText scrape (simplest, most resilient)

```js
// content.js
(function() {
  const main = document.querySelector('main') || document.body;
  const text = main.innerText;
  chrome.runtime.sendMessage({ type: 'USAGE_TEXT', text });
})();
```

`parseUsageText()` already handles flexible text formats and section anchoring
(`/current\s+session/i`, `/weekly\s+limits?/i`). No changes to parser.js needed
if the page's innerText contains the same phrases.

### Option B — targeted DOM extraction (fallback if text layout changes)

Locate the specific elements that hold the percentage and reset time values by
their visible label text or proximity. More brittle to DOM changes but more precise.

Start with Option A. Switch to Option B only if the page structure causes false
positives in the parser.

---

## popup.html

Identical to `index.html` minus:
- The `<textarea>` input section
- The paste/clear/open-usage buttons
- The service worker registration script tag

Add instead:
- A status bar: "Last updated: 2 min ago" + "Refresh" button
- An "Open usage page" link for when the extension can't reach the page

Set `max-width: 420px` on the popup container (Chrome popup default sizing).

---

## popup.js — wiring

```js
// popup.js (simplified flow)
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ url: 'https://claude.ai/settings/usage' });

  if (tab) {
    // Page is open — inject content script and request data
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    chrome.runtime.onMessage.addListener(({ type, text }) => {
      if (type !== 'USAGE_TEXT') return;
      processText(text);
    });
  } else {
    // Page not open — show prompt to open it, or use cached last input
    const last = loadLastInput();
    if (last) processText(last);
    else showOpenPagePrompt();
  }
});

function processText(text) {
  try {
    const parsed = parseUsageText(text);
    applySuggestedPacing(parsed);
    renderResults(parsed);
    renderSuggestion(parsed);
    saveLastInput(text);
    saveEntry({ ... });
    renderHistory(loadHistory());
  } catch (err) {
    showError(err);
  }
}
```

`chrome.storage.local` replaces `localStorage`. Both share a simple key/value API,
so `history.js` needs a thin adapter or a flag to switch storage backends.

---

## background.js — auto-refresh (optional phase 2)

Use `chrome.alarms` to wake up every N minutes and trigger a content script injection
on any open `claude.ai/settings/usage` tab. The result is cached in `chrome.storage.local`
and the popup reads it on open, making it feel instant even without the tab active.

---

## Storage migration

| Current (PWA)         | Extension                          |
|-----------------------|------------------------------------|
| `localStorage`        | `chrome.storage.local`             |
| Same key names        | Same key names (no data migration) |

The extension popup shares the same origin namespace as its storage, so no conflict.
PWA history stays in the browser's `localStorage`; it does not carry over automatically
(export/import via the existing JSON buttons covers this if needed).

---

## Parsing validation

Before shipping, verify `parseUsageText()` works against the real `innerText` output of
`claude.ai/settings/usage`. The key phrases the parser anchors on:

- `"Current session"` heading → `sessionMatch`
- `"Weekly limits"` heading → `weeklyMatch`
- `"Resets in X hr Y min"` for session reset time
- `"Resets Fri 5:59 AM"` (day + time) for weekly reset time

If the page uses different casing or phrasing, update the regexes in `parser.js`.

---

## What does NOT change

- All calculation logic (`stats.js`) — zero changes.
- All rendering logic (`renderer.js`) — zero changes.
- History, alarms, export/import — zero changes.
- Visual design — same CSS with a popup-width cap added.

---

## Implementation phases

### Phase 1 — MVP (manual trigger)
- manifest.json + popup.html + popup.js + content.js
- Option A text scraping
- `chrome.storage.local` adapter for history.js
- Popup shows dashboard when claude.ai/settings/usage tab is open
- Falls back to last cached input when tab is closed

### Phase 2 — Auto-refresh
- background.js with `chrome.alarms` polling every 5 minutes
- Badge on extension icon showing current session %
- Popup loads instantly from cache

### Phase 3 — Distribution
- Icons in all required sizes
- Chrome Web Store listing
- README with install instructions
- Consider Firefox compatibility (MV3 is largely cross-browser)

---

## Open questions

1. Does `claude.ai/settings/usage` require login-gated navigation to load?
   The content script only runs on that exact URL, so auth is handled by the user's
   existing session — no credentials needed in the extension.

2. Does React hydration delay mean `document_idle` fires before the usage numbers
   are in the DOM? If so, the content script needs a MutationObserver or a short
   `setTimeout` retry before reading `innerText`.

3. Should the popup open the usage page automatically if no tab is found?
   Could use `chrome.tabs.create` — but ask first, since it's disruptive.
