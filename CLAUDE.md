# Claude Usage Tracker

Two products that share parsing/stats logic:

- **PWA** (`/`) — paste usage text manually, visualize in browser
- **Chrome Extension** (`/extension/`) — auto-scrapes `claude.ai/settings/usage`, shows popup window with badge

## Architecture

### PWA

- **parser.js** — Extract % used, reset times from Claude usage page text
- **stats.js** — Calculate target % based on elapsed time, determine over/under/on-target status
- **renderer.js** — Build DOM: cards, stat rows, progress bars, legend with hit times
- **app.js** — Event handlers, sample data
- **styles.css** — Dark theme, responsive grid layout
- **sw.js** — Service worker for offline PWA support

### Chrome Extension (`/extension/`)

- **manifest.json** — MV3, permissions: storage/alarms/tabs/scripting/windows, host: claude.ai
- **background.js** — Service worker: opens popup window on click, polls via alarms every 5 min, caches text, sets badge
- **content.js** — Injected into claude.ai/settings/usage; polls DOM via MutationObserver, sends USAGE_TEXT message
- **window.js** — Popup window logic; reads cache or triggers content script, calls parseUsageText/renderResults
- **storage-adapter.js** — Wraps chrome.storage.local to match localStorage API
- **src/parser.js, src/stats.js, src/renderer.js** — Extension copies of shared logic (not imported from root)

## When Modifying

- Parsing logic → parser.js
- Math/calculations → stats.js
- DOM/rendering → renderer.js
- Styling → styles.css
- Event wiring → app.js
