# Claude Usage Tracker Extension

A Chrome extension that automatically reads your Claude usage data from `https://claude.ai/settings/usage` without copy-pasting.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension` folder from this repository
5. The extension icon appears in your toolbar

## Usage

1. Open `https://claude.ai/settings/usage` in a Chrome tab (or let the extension open it for you)
2. Click the extension icon in your toolbar to open the popup window
3. The popup shows your session and weekly usage with targets and status

The extension polls the usage page every 5 minutes via a background alarm and caches the results, so the popup loads instantly from cache. The toolbar badge shows session usage % at a glance.

## How it works

1. Clicking the extension icon opens a popup window (`window.html`)
2. The content script (`content.js`) is injected into the usage page and extracts usage text from the DOM (hydration-safe via `MutationObserver`)
3. Usage text is sent to the background service worker via `chrome.runtime.sendMessage`
4. The popup window reads cached data (or triggers a fresh scrape) and runs it through the parser/stats/renderer pipeline
5. The background service worker (`background.js`) caches data and updates the badge every 5 minutes

## Architecture

```
extension/
├── manifest.json          # MV3 manifest
├── window.html             # Popup window UI
├── window.js                # Popup window logic, entry point
├── window.css                # Popup window styling
├── content.js               # DOM scraper, injected into usage page
├── background.js            # Service worker, auto-refresh + badge
├── storage-adapter.js        # Chrome storage wrapper
├── src/
│   ├── parser.js           # Parse usage text
│   ├── stats.js            # Calculate targets
│   └── renderer.js         # Render results into the popup DOM
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
- `windows` — Open the popup as its own window

## Debugging

Open DevTools in the popup window (`Inspect`) or the background service worker (`Service workers` section in `chrome://extensions/`).

Content script errors appear in the DevTools console of the usage page tab.

## Known limitations

- Requires the usage page tab to be open (or recently open for cached data)
- DOM structure changes on `claude.ai` require updating parser regexes
- CSP on Claude's site doesn't block content scripts (browser-injected)
