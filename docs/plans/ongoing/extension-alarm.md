# Context

The web app (`src/alarm.js`) fires a session-reset alarm: modal, sound, title/favicon flash. The Chrome extension popup (`extension/window.html` + `extension/window.js`) doesn't have this. Goal: port the alarm into the extension.

## Approach

### 1. Copy and adapt `src/alarm.js` → `extension/src/alarm.js`

Two changes from the original:
- Audio path: `'../assets/Recover.mp3'` → `'assets/Recover.mp3'`
- Storage: replace `localStorage` with a local in-memory `_alarmEnabled` boolean (synced to `chrome.storage.local` on load and on toggle), so `isAlarmEnabled()` stays synchronous

### 2. Copy audio file

Copy `assets/Recover.mp3` → `extension/assets/Recover.mp3` so it's bundled with the extension.

### 3. `extension/window.html` changes

- Add alarm toggle button in the status bar: `<button id="btn-alarm-toggle">Alarm: off</button>`
- Add script tag before `window.js`: `<script src="src/alarm.js"></script>`

### 4. `extension/window.js` changes

- On DOMContentLoaded: read alarm state from `chrome.storage.local`, update button label
- After `processText` succeeds: call `scheduleSessionAlarm(Date.now() + parsed.session.hoursLeft * 3600 * 1000)`
- Alarm toggle click: call `setAlarmEnabled(!current)`, persist to `chrome.storage.local`, update label

## Files

| File | Change |
|---|---|
| `extension/src/alarm.js` | New — adapted from `src/alarm.js` |
| `extension/assets/Recover.mp3` | New — copy from `assets/Recover.mp3` |
| `extension/window.html` | Add button + script tag |
| `extension/window.js` | Load state, schedule alarm, wire toggle |

## Verification

1. Load extension in `chrome://extensions` (developer mode)
2. Extension window shows "Alarm: off" button in status bar
3. Toggle on → shows "Alarm: on"; state persists after close/reopen
4. Call `fireAlarm()` in extension window console → modal + sound fire
5. Dismiss button stops sound and closes modal