# Chrome Extension: Claude Usage Tracker

Convert the existing PWA into a Chrome extension that reads usage data directly from
`https://claude.ai/settings/usage` — no copy-paste required.

**Scope:** Personal use only. No Web Store publishing. Load unpacked locally.

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

1. User opens the extension popup (or it auto-refreshes every 5 min via alarms).
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
├── background.js          # Service worker: auto-refresh scheduling via chrome.alarms
├── src/
│   ├── parser.js          # Copied from PWA (unchanged)
│   ├── stats.js           # Copied from PWA (unchanged)
│   ├── renderer.js        # Copied from PWA (unchanged)
│   ├── history.js         # Copied from PWA (unchanged)
│   └── alarm.js           # Copied from PWA (unchanged)
├── styles/
│   └── popup.css          # Adapted from styles.css (max-width for popup)
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

All core logic files are **copied verbatim** from the PWA. Changes are isolated to the
three new entry points. When the PWA changes, re-copy the relevant files manually.

---

## manifest.json (MV3)

```json
{
  "manifest_version": 3,
  "name": "Claude Usage Tracker",
  "version": "1.0.0",
  "description": "Track Claude session and weekly usage without copy-pasting",
  "permissions": ["storage", "alarms", "tabs", "scripting"],
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

Note: `scripting` permission is required for `chrome.scripting.executeScript` in popup.js.

---

## content.js — DOM scraping strategy

The usage page is React-rendered. `document_idle` fires after initial parse but React
hydration may still be in progress, meaning the usage numbers might not be in the DOM yet.

### Hydration-safe scraping

```js
// content.js
(function() {
  const TIMEOUT_MS = 8000;
  const POLL_INTERVAL_MS = 300;

  function hasUsageData(text) {
    return /current\s+session/i.test(text) && /\d+%\s+used/i.test(text);
  }

  function tryExtract() {
    const main = document.querySelector('main') || document.body;
    const text = main.innerText;
    if (hasUsageData(text)) {
      chrome.runtime.sendMessage({ type: 'USAGE_TEXT', text });
      return true;
    }
    return false;
  }

  if (tryExtract()) return;

  // React hasn't hydrated yet — poll until data appears or timeout
  const start = Date.now();
  const observer = new MutationObserver(() => {
    if (tryExtract()) {
      observer.disconnect();
    } else if (Date.now() - start > TIMEOUT_MS) {
      observer.disconnect();
      chrome.runtime.sendMessage({ type: 'USAGE_ERROR', reason: 'timeout' });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
```

Start with `innerText` scraping (Option A). The parser already handles flexible text
formats and section anchoring. Option B (targeted DOM element extraction) is a fallback
if false positives appear in the parser — implement only if needed.

---

## popup.html

Identical to `index.html` minus:
- The `<textarea>` input section
- The paste/clear/open-usage buttons
- The service worker registration script tag

Add instead:
- A status bar: "Last updated: 2 min ago" + manual "Refresh" button
- An "Open usage page" link for when the extension can't reach the page
- An error state for when scraping times out

Set `max-width: 420px` on the popup container (Chrome popup default sizing).

---

## popup.js — wiring

```js
// popup.js (simplified flow)
document.addEventListener('DOMContentLoaded', async () => {
  // First, show cached data immediately so the popup feels instant
  const cached = await getCachedData();
  if (cached) {
    processText(cached.text);
    showLastUpdated(cached.timestamp);
  }

  // Then attempt a live refresh if the usage tab is open
  const [tab] = await chrome.tabs.query({ url: 'https://claude.ai/settings/usage' });

  if (tab) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    chrome.runtime.onMessage.addListener(({ type, text, reason }) => {
      if (type === 'USAGE_TEXT') {
        processText(text);
        cacheData(text);
        showLastUpdated(Date.now());
      } else if (type === 'USAGE_ERROR') {
        if (!cached) showError(`Could not read usage data: ${reason}`);
      }
    });
  } else if (!cached) {
    showOpenPagePrompt();
  }
});

function processText(text) {
  const parsed = parseUsageText(text);
  applySuggestedPacing(parsed);
  renderResults(parsed);
  renderSuggestion(parsed);
  saveEntry({ ... });
  renderHistory(loadHistory());
}
```

`chrome.storage.local` replaces `localStorage`. Both share a similar key/value API —
`history.js` needs a thin async adapter since `chrome.storage.local` is async.

---

## background.js — auto-refresh (Phase 2)

Every 5 minutes, the service worker wakes up, finds any open `claude.ai/settings/usage`
tab, injects the content script, and caches the result. The popup then reads from cache
on open, making it feel instant even if no tab is active.

```js
// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('refresh', { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'refresh') return;
  const [tab] = await chrome.tabs.query({ url: 'https://claude.ai/settings/usage' });
  if (!tab) return;
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
});

// Cache incoming data from content script
chrome.runtime.onMessage.addListener(({ type, text }, sender, sendResponse) => {
  if (type !== 'USAGE_TEXT') return;
  chrome.storage.local.set({ cachedText: text, cachedAt: Date.now() });
  // Update badge with session %
  const match = text.match(/(\d+)%\s+used/i);
  if (match) {
    chrome.action.setBadgeText({ text: `${match[1]}%` });
    chrome.action.setBadgeBackgroundColor({ color: '#4a9eff' });
  }
});
```

The badge shows the current session % at a glance without opening the popup.

---

## Storage migration

| Current (PWA)         | Extension                          |
|-----------------------|------------------------------------|
| `localStorage` (sync) | `chrome.storage.local` (async)     |
| Same key names        | Same key names                     |

`history.js` needs a thin async adapter — wrap `get`/`set` calls in Promises that
resolve via the `chrome.storage.local` callback. Keep the adapter in `popup.js` or
a small `storage-adapter.js` shim so `history.js` stays unchanged.

PWA history stays in `localStorage`; it does not carry over automatically. The existing
JSON export/import buttons cover manual migration if needed.

---

## Parsing validation

Before shipping, verify `parseUsageText()` works against the real `innerText` of
`claude.ai/settings/usage`. Key phrases the parser anchors on:

- `"Current session"` heading → `sessionMatch`
- `"Weekly limits"` heading → `weeklyMatch`
- `"Resets in X hr Y min"` for session reset time
- `"Resets Fri 5:59 AM"` (day + time) for weekly reset time

To validate: open the usage page, open DevTools console, run
`copy(document.querySelector('main').innerText)`, paste into the PWA's textarea.
If the dashboard renders correctly, the content script will work as-is.

---

## What does NOT change

- All calculation logic (`stats.js`) — zero changes.
- All rendering logic (`renderer.js`) — zero changes.
- History, export/import — zero changes.
- Visual design — same CSS with a popup-width cap added.

---

## Implementation phases

### Phase 1 — MVP (manual trigger)
- `manifest.json` + `popup.html` + `popup.js` + `content.js`
- Hydration-safe Option A text scraping (MutationObserver retry)
- `chrome.storage.local` async adapter for `history.js`
- Popup shows dashboard when `claude.ai/settings/usage` tab is open
- Falls back to last cached data when tab is closed
- Status bar showing "Last updated: X min ago"

### Phase 2 — Auto-refresh + badge
- `background.js` with `chrome.alarms` polling every 5 minutes
- Badge on extension icon showing current session %
- Popup loads instantly from cache; live fetch runs in background

### Phase 3 — Polish
- Icons in all required sizes (16, 48, 128)
- Verify parsing against real page `innerText`
- README with load-unpacked instructions

---

## Known risks

1. **React hydration delay** — Handled by the MutationObserver retry in `content.js`.
   Timeout after 8s and surface an error state in the popup.

2. **DOM structure changes** — `innerText` scraping is resilient to HTML changes but
   depends on visible label text staying the same. If Anthropic renames "Current session"
   or "Weekly limits", update the parser regexes.

3. **CSP on `claude.ai`** — Content scripts are injected by the browser, not the page,
   so the page's CSP does not block them. `chrome.runtime.sendMessage` is also CSP-exempt.

4. **Tab not open** — The popup gracefully degrades to showing cached data. If no cache
   exists, it shows a prompt to open the usage page.
