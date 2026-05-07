# Claude Usage Tracker Extension

A Chrome extension that automatically reads your Claude usage data from `https://claude.ai/settings/usage` without copy-pasting.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension` folder from this repository
5. The extension icon appears in your toolbar

## Usage

1. Open `https://claude.ai/settings/usage` in a Chrome tab
2. Click the extension icon in your toolbar
3. The popup shows your session and weekly usage with targets and status

**Auto-refresh (Phase 2):** The extension polls the usage page every 5 minutes and caches results. The popup loads instantly from cache.

## Features

- **Phase 1 (MVP):** Manual refresh from popup. Shows cached data when tab is closed.
- **Phase 2:** Auto-refresh every 5 minutes via service worker. Badge shows session % at a glance.
- **Phase 3:** Validated DOM scraping, full styling, production-ready.

## How it works

1. Content script (`content.js`) injects into the usage page
2. Extracts usage text from the DOM (hydration-safe with MutationObserver)
3. Sends text to popup via `chrome.runtime.sendMessage`
4. Popup runs the same parser/stats/renderer pipeline as the PWA
5. Background service worker caches data and updates badge every 5 minutes

## Architecture

```
extension/
├── manifest.json          # MV3 manifest
├── popup.html             # Popup UI
├── popup.js               # Popup logic, entry point
├── content.js             # DOM scraper, injected into usage page
├── background.js          # Service worker, auto-refresh + badge
├── storage-adapter.js     # Chrome storage wrapper
├── src/
│   ├── parser.js          # Parse usage text (copied from PWA)
│   ├── stats.js           # Calculate targets (copied from PWA)
│   └── tailwindcss.min.js # Styling
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

## Permissions

- `https://claude.ai/*` — Read the usage page
- `storage` — Cache data in `chrome.storage.local`
- `alarms` — Periodic auto-refresh every 5 minutes
- `tabs` — Find the open usage tab
- `scripting` — Inject content script

## Debugging

Open DevTools in the extension popup (`Inspect popup`) or the background service worker (`Service workers` section in `chrome://extensions/`).

Content script errors appear in the DevTools console of the usage page tab.

## Known limitations

- Requires the usage page tab to be open (or recently open for cached data)
- DOM structure changes on `claude.ai` require updating parser regexes
- CSP on Claude's site doesn't block content scripts (browser-injected)
