# Claude Usage Tracker

Progressive web app that visualizes Claude API usage against time-based targets.

## Architecture

- **parser.js** — Extract % used, reset times from Claude usage page text
- **stats.js** — Calculate target % based on elapsed time, determine over/under/on-target status
- **renderer.js** — Build DOM: cards, stat rows, progress bars, legend with hit times
- **app.js** — Event handlers, sample data
- **styles.css** — Dark theme, responsive grid layout
- **sw.js** — Service worker for offline PWA support

## Input Format

Text must contain:
- Session: `74% used` + `Resets in 1 hr 30 min`
- Weekly: `65% used` + `Resets Fri 5:59 AM`

Parser is lenient with formatting (case-insensitive, flexible time formats).

## When Modifying

- Parsing logic → parser.js
- Math/calculations → stats.js
- DOM/rendering → renderer.js
- Styling → styles.css
- Event wiring → app.js

Keep files focused. Don't add comments unless behavior is non-obvious.
