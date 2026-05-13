# Hand-off: Pre-build Tailwind CSS for Chrome Extension

## Problem
The extension currently uses `tailwindcss.min.js` (Tailwind JIT CDN) which logs a warning at runtime:
```
cdn.tailwindcss.com should not be used in production. To use Tailwind CSS in production, 
install it as a PostCSS plugin or use the Tailwind CLI
```

This warning appears in the browser console but doesn't affect functionality. However, it signals the extension should use pre-built CSS instead.

## Solution: Extract CSS Once, Use Static File

### Current Setup (window.html)
- Line 7: `<script src="tailwindcss.min.js"></script>` 
- Lines 8–62: `<script>tailwind.config = { ... }</script>`
- Lines 64–337: `<style type="text/tailwindcss">` with Tailwind directives (@layer, @apply)

### Target Setup
1. Remove `tailwindcss.min.js` script tag entirely
2. Remove runtime `tailwind.config` script
3. Replace `<style type="text/tailwindcss">` with `<link rel="stylesheet" href="extension.css">`
4. Generate `extension/extension.css` once using Tailwind CLI or npm

### Step-by-Step Implementation

#### 1. Create `extension/tailwind.config.js`
Extract the config from window.html into a proper Tailwind config file:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './window.html',
    './popup.html',
    './src/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        base: '#0f0f11',
        surface: '#1c1c1f',
        surface2: '#26262a',
        border: '#2a2a2e',
        border2: '#3a3a3f',
        text: '#e8e8ed',
        // ... (copy all custom colors from window.html lines 13–42)
        muted1: '#ccc',
        muted2: '#aaa',
        muted3: '#888',
        muted4: '#666',
        muted5: '#555',
        'red-over': '#ef4444',
        'red-light': '#f87171',
        'red-pale': '#fca5a5',
        'red-dark': '#450a0a',
        'red-alarm': '#e14b4b',
        'green-under': '#22c55e',
        'green-light': '#86efac',
        'green-dark': '#052e16',
        'green-mid': '#2d5a2d',
        'indigo-accent': '#6366f1',
        'indigo-light': '#a5b4fc',
        'indigo-dark': '#1e1b4b',
        'indigo-green': '#1e3a1f',
        'orange-constrained': '#fdba74',
        'orange-dark': '#451a03',
        'legend-bright': '#e0e7ff',
        'legend-mid': '#c7d2fe',
        'legend-dim': '#8891c9',
        'body-text': '#d8d8e8',
      },
      fontSize: { base: '24px' },
      fontFamily: {
        mono: ['SF Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      gridTemplateColumns: {
        10: 'repeat(10, minmax(0, 1fr))',
      },
      animation: {
        'alarm-pulse': 'alarm-pulse 1.2s ease-in-out infinite',
      },
      keyframes: {
        'alarm-pulse': {
          '0%, 100%': { backgroundColor: 'rgba(0,0,0,0.75)' },
          '50%': { backgroundColor: 'rgba(80,0,0,0.85)' },
        },
      },
    },
  },
  plugins: [],
}
```

#### 2. Create `extension/input.css`
Extract all Tailwind directives from the `<style type="text/tailwindcss">` block:

```css
/* === BASE LAYER === */
@layer base {
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 24px; }
  body {
    @apply bg-base text-text flex flex-col items-center py-8 px-4 gap-6;
    min-height: 100vh;
  }
  h1 { @apply text-white font-semibold; font-size: 1.25rem; }
  button {
    @apply px-3 py-1 bg-surface2 text-muted1 rounded cursor-pointer;
    font-size: 0.75rem;
    border: 1px solid #3a3a3f;
  }

  body.session-hidden .card[data-type="session"] { display: none; }
  body.session-hidden .pacing-row[data-type="session"] { display: none; }
  body.session-hidden .suggestion-item[data-type="session"] { display: none; }
}

/* === COMPONENT LAYER === */
@layer components {
  /* Cards */
  .card {
    @apply bg-surface border border-border rounded-xl flex flex-col gap-3 p-4 w-full;
  }
  .card-title {
    @apply text-muted3 uppercase tracking-widest;
    font-size: 0.7rem;
  }
  
  /* ... (copy remaining @apply rules from window.html lines 96–336) ... */
  
  /* Pacing cards bullets */
  .grid.grid-cols-4 > div ul li::before {
    content: '→ ';
    color: #6366f1;
    font-weight: 600;
    margin-right: 0.3rem;
  }

  /* Status / error */
  .status-bar { @apply flex justify-between items-center text-muted3; font-size: 0.75rem; gap: 1rem; }
  .status-time { @apply text-muted4; }
  .error-message { @apply text-red-light; font-size: 0.8rem; }
  .open-page-prompt { @apply text-muted2; font-size: 0.85rem; }
}

@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### 3. Build CSS (via npm or CLI)
Once Tailwind is installed locally or globally:

```bash
cd extension
npx tailwindcss -i input.css -o extension.css --minify
```

This generates `extension/extension.css` containing all necessary styles.

#### 4. Update `window.html` and `popup.html`
Replace:
```html
<script src="tailwindcss.min.js"></script>
<script>
  tailwind.config = { ... }
</script>
<style type="text/tailwindcss">
  ...
</style>
```

With:
```html
<link rel="stylesheet" href="extension.css">
```

#### 5. Remove `tailwindcss.min.js` from extension
Delete the bundled minified file—no longer needed.

#### 6. Update `manifest.json` (if needed)
Ensure no manifest entries reference `tailwindcss.min.js`.

### Verification
- Open `window.html` in a browser: styles should apply, no Tailwind warning.
- Open the Chrome extension popup: same visual result, no warning.
- Extension loads successfully without any console warnings.

### Why This Works
- Static CSS is more performant (no runtime JIT compilation).
- Eliminates the CDN warning entirely.
- Same visual output; no behavior changes.
- Smaller runtime footprint (no `tailwindcss.min.js` file to load).

### Files to Modify
- `extension/window.html` — replace script tags with CSS link
- `extension/popup.html` — same replacement
- Create `extension/tailwind.config.js` — config extraction
- Create `extension/input.css` — Tailwind directives extraction
- Create `extension/extension.css` — generated by CLI

### Optional: Add to .gitignore
```
extension/extension.css
```

So the CSS is rebuilt fresh on each build (though for simplicity, you can commit it too).
