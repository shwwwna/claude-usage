# Claude Usage Tracker

A Chrome extension that automatically scrapes your usage stats from `claude.ai/settings/usage` and shows them in a popup window with a toolbar badge — no copy-pasting required.

The project focus is the extension only, under [`extension/`](extension/). (A PWA version has been archived.)

## Quick start

See [`extension/README.md`](extension/README.md) for installation and usage instructions.

## Architecture

- **manifest.json** — MV3 manifest (permissions: `storage`, `alarms`, `tabs`, `scripting`, `windows`; host: `claude.ai`)
- **background.js** — Service worker: opens the popup window, polls via alarms every 5 minutes, caches text, sets the badge
- **content.js** — Injected into `claude.ai/settings/usage`; watches the DOM via `MutationObserver`, sends usage text to the background script
- **window.html / window.js / window.css** — Popup window UI and logic; reads cached data or triggers the content script, then parses/renders it
- **storage-adapter.js** — Wraps `chrome.storage.local` to match the `localStorage` API
- **src/parser.js** — Parses raw usage text
- **src/stats.js** — Calculates usage targets/stats
- **src/renderer.js** — Renders results into the popup DOM

## Development

- Parsing logic → `extension/src/parser.js`
- Math/calculations → `extension/src/stats.js`
- DOM/rendering → `extension/src/renderer.js`
- Styling → `extension/window.css`
- Event wiring → `extension/window.js`, `extension/background.js`, `extension/content.js`
