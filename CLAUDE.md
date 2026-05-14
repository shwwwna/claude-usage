# Claude Usage Tracker

**Focus: Chrome Extension only** (`/extension/`) — auto-scrapes `claude.ai/settings/usage`, shows popup window with badge

(PWA archived for now)

## Chrome Extension Architecture

- **manifest.json** — MV3, permissions: storage/alarms/tabs/scripting/windows, host: claude.ai
- **background.js** — Service worker: opens popup window on click, polls via alarms every 5 min, caches text, sets badge
- **content.js** — Injected into claude.ai/settings/usage; polls DOM via MutationObserver, sends USAGE_TEXT message
- **window.js** — Popup window logic; reads cache or triggers content script, calls parseUsageText/renderResults
- **storage-adapter.js** — Wraps chrome.storage.local to match localStorage API
- **src/parser.js, src/stats.js, src/renderer.js** — Parsing, calculations, rendering logic

## When Modifying

- Parsing logic → src/parser.js
- Math/calculations → src/stats.js
- DOM/rendering → src/renderer.js
- Styling → window.css
- Event wiring → window.js, background.js, content.js
