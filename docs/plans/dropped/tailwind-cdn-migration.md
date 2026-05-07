# Plan: Migrate vanilla CSS to Tailwind CSS via CDN

## Context

The app currently uses a hand-written `styles.css` (927 lines, dark theme). The goal is to replace it with Tailwind CSS loaded via CDN, keeping the same visual output. JavaScript files assign class names dynamically (renderer.js, alarm.js, history.js), so those classes must continue to exist — they'll live in a `@layer components` block instead of styles.css.

## Approach: Tailwind CDN + `@layer components` hybrid

Use the Tailwind Play CDN script. Download it locally (matching how `alpine.min.js` is bundled) for PWA offline support. Define all custom colors and values in a `tailwind.config` block in `<head>`. Keep all JS-referenced class names alive via `@layer components` using `@apply`. Convert HTML-only structural classes to inline Tailwind utilities.

**JS files (renderer.js, alarm.js, history.js, app.js) are NOT modified.** All their class names are preserved via `@layer components`.

---

## Implementation Steps

### 1. Download Tailwind Play CDN script locally
```
curl -sL https://cdn.tailwindcss.com -o tailwindcss.min.js
```
Place in project root alongside `alpine.min.js`.

### 2. Update `index.html` — replace stylesheet link with Tailwind
Replace:
```html
<link rel="stylesheet" href="styles.css" />
```
With:
```html
<script src="tailwindcss.min.js"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        base: '#0f0f11',
        surface: '#1c1c1f',
        surface2: '#26262a',
        border: '#2a2a2e',
        border2: '#3a3a3f',
        text: '#e8e8ed',
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
}
</script>
<style type="text/tailwindcss">
  /* === BASE LAYER === */
  @layer base {
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 24px; }
    body {
      @apply bg-base text-text flex flex-col items-center py-8 px-4 gap-6;
      min-height: 100vh;
    }
    h1 { @apply text-white font-semibold; font-size: 1.25rem; }
    textarea {
      @apply w-full bg-surface border border-border rounded-lg p-3 font-mono text-text resize-y;
      min-height: 210px;
      font-size: 0.75rem;
      transition: border-color 0.15s;
    }
    textarea:focus { @apply outline-none border-muted4; }
    button {
      @apply px-3 py-1 bg-surface2 text-muted1 rounded cursor-pointer;
      font-size: 0.75rem;
      border: 1px solid #3a3a3f;
      transition: background 0.15s, color 0.15s;
    }
    button:hover { @apply bg-border text-text; }

    /* data-attribute selectors — cannot be expressed as Tailwind utilities */
    body.session-hidden .card[data-type="session"] { display: none; }
    body.session-hidden .pacing-row[data-type="session"] { display: none; }
    body.session-hidden .suggestion-item[data-type="session"] { display: none; }
  }

  /* === COMPONENT LAYER (all JS-assigned class names) === */
  @layer components {
    /* Cards */
    .card {
      @apply bg-surface border border-border rounded-xl flex flex-col gap-3 p-4 w-full;
    }
    .card-title {
      @apply text-muted3 uppercase tracking-widest;
      font-size: 0.7rem;
    }

    /* Stat rows */
    .stat-row { @apply flex justify-between items-baseline; }
    .compact-meta-row { @apply flex gap-6 flex-wrap; }
    .compact-meta-cell { @apply flex items-baseline gap-1; }
    .stat-label { @apply text-muted2; font-size: 0.8rem; }
    .stat-value { @apply font-semibold tabular-nums; font-size: 1rem; }
    .stat-explainer { @apply text-muted4; font-size: 0.65rem; margin-top: -0.2rem; }

    /* Fraction values */
    .fraction-value { font-size: 0.85rem; }
    .frac-actual { @apply text-text; }
    .frac-sep { @apply text-muted5; font-size: 0.75rem; margin: 0 0.1rem; }
    .frac-target { @apply text-muted3; }

    /* Badges */
    .badge { @apply font-bold rounded; font-size: 0.7rem; padding: 0.15rem 0.5rem; }
    .badge-over { @apply bg-red-dark text-red-pale; }
    .badge-under { @apply bg-green-dark text-green-light; }
    .badge-on { @apply bg-indigo-dark text-indigo-light; }
    .badge-constrained { @apply bg-orange-dark text-orange-constrained; }

    /* Diff values */
    .diff-value { @apply tabular-nums; }
    .diff-over { @apply text-red-pale; }
    .diff-under { @apply text-green-light; }
    .diff-on { @apply text-indigo-light; }

    /* Progress bar */
    .bar-track {
      @apply relative w-full bg-border rounded;
      height: 12px;
    }
    .bar-track.unified { @apply overflow-visible; }
    .bar-target-fill {
      @apply absolute top-0 left-0 h-full rounded;
      background: hsla(0, 0%, 100%, 0.4);
      transition: width 0.4s ease;
    }
    .bar-actual-fill {
      @apply absolute top-0 left-0 h-full rounded mix-blend-screen;
      transition: width 0.4s ease;
    }
    .bar-actual-fill.status-under,
    .bar-actual-fill.status-on { background: rgba(34, 197, 94, 0.7); }
    .bar-actual-fill.status-over { background: rgba(239, 68, 68, 0.75); }

    .bar-target-marker {
      @apply absolute top-0 w-px;
      height: 100%;
      background: #a5b4fc;
      box-shadow: 0 0 4px #a5b4fc;
    }
    .bar-endpoint-dot {
      @apply absolute rounded-full;
      width: 14px; height: 14px;
      top: 50%; transform: translateY(-50%);
    }
    .bar-endpoint-dot.status-under,
    .bar-endpoint-dot.status-on { @apply bg-green-under; }
    .bar-endpoint-dot.status-over { @apply bg-red-over; }
    .bar-tick {
      @apply absolute top-0 h-full;
      width: 1px;
      background: rgba(255,255,255,0.35);
    }

    /* Bar legend */
    .bar-legend { @apply grid grid-cols-10 w-full; }
    .bar-legend-item { @apply flex flex-col items-center; }
    .bar-legend-item.legend-past { @apply line-through text-muted5; }
    .bar-legend-pct { @apply tabular-nums text-legend-bright; font-size: 0.6rem; }
    .bar-legend-date { @apply tabular-nums text-legend-mid; font-size: 0.55rem; }
    .bar-legend-left { @apply tabular-nums text-legend-dim; font-size: 0.5rem; }

    /* Sleep controls */
    .sleep-row { @apply flex items-center gap-2 text-muted3; font-size: 0.75rem; }
    .sleep-label { @apply text-muted4 whitespace-nowrap; }
    .sleep-select {
      @apply bg-surface border border-muted5 rounded text-muted2;
      font-size: 0.75rem; padding: 0.1rem 0.3rem;
    }
    .sleep-select:focus { @apply outline-none border-muted4; }
    .sleep-sep { @apply text-muted5; }

    /* Windows list */
    .windows-list { @apply flex flex-col gap-1; }
    .windows-header { @apply flex justify-between items-baseline; }
    .windows-total { @apply text-muted5; font-size: 0.65rem; }
    .windows-items { @apply flex flex-col; gap: 0.1rem; }
    .windows-day { @apply text-muted4 uppercase; font-size: 0.6rem; margin-top: 0.35rem; }
    .windows-item { @apply flex gap-2 text-muted1; font-size: 0.72rem; }
    .windows-item-sleep { @apply text-muted4; }
    .windows-num { @apply tabular-nums text-right; min-width: 1.2rem; }
    .windows-range { @apply flex-1 text-body-text font-medium; }
    .windows-range .windows-duration { @apply text-muted2; margin-left: 0.3em; }

    /* Suggestion section */
    .suggestion-section {
      @apply flex flex-col gap-3 p-4 rounded-xl border w-full;
      background: linear-gradient(135deg, #1e3a1f, #1c2a1f);
      border-color: #2d5a2d;
    }
    .suggestion-heading { @apply text-green-light uppercase tracking-widest; font-size: 0.75rem; }
    .suggestion-items { @apply flex flex-col gap-2; }
    .suggestion-item {
      @apply flex justify-between items-center p-2 rounded;
      background: rgba(134, 239, 172, 0.05);
    }
    .suggestion-item.suggestion-update {
      background: rgba(134, 239, 172, 0.1);
      border: 1px solid rgba(134, 239, 172, 0.2);
    }
    .suggestion-label { @apply text-muted2; font-size: 0.8rem; }
    .suggestion-value { @apply text-green-light uppercase; font-size: 0.85rem; }
    .suggestion-btn {
      @apply rounded cursor-pointer;
      padding: 0.3rem 0.7rem;
      background: #2d5a2d;
      color: #86efac;
      border: 1px solid #3a6a3a;
      font-size: 0.75rem;
    }
    .suggestion-btn:hover { background: #3a6a3a; }

    /* History */
    .history-empty { @apply text-muted3 text-center; font-size: 0.85rem; }
    .history-title { @apply text-indigo-light; font-size: 0.95rem; }
    .history-analysis { @apply text-muted3; font-size: 0.8rem; }
    .history-table { @apply font-mono w-full border-collapse; font-size: 0.8rem; }
    .history-table th { @apply text-muted3 text-left; border-bottom: 1px solid #2a2a2e; padding: 0.3rem 0.5rem; }
    .history-table td { @apply text-muted1; border-bottom: 1px solid #1c1c1f; padding: 0.3rem 0.5rem; }
    .history-btn-row { @apply flex gap-2 flex-wrap; }
    .btn-history {
      @apply bg-surface rounded cursor-pointer text-muted1;
      font-size: 0.78rem;
      padding: 0.3rem 0.7rem;
      border: 1px solid #2a2a2e;
    }
    .btn-history:hover { @apply bg-border; }
    .btn-history-clear { @apply text-red-light; border-color: #450a0a; }
    .btn-history-delete {
      @apply hidden text-red-light cursor-pointer;
      border-color: #3a1f1f;
      font-size: 0.75rem;
    }
    /* reveal delete button on row hover — parent hover, can't be Tailwind utility */
    .history-table tbody tr:hover .btn-history-delete { display: inline-block; }

    /* Session grouping */
    .history-sessions-container { @apply flex flex-col gap-6; }
    .history-session {
      @apply bg-surface rounded-lg p-3;
      border-left: 3px solid #6366f1;
    }
    .session-header {
      @apply flex justify-between items-center pb-2 mb-2;
      font-size: 0.85rem;
      border-bottom: 1px solid #2a2a2e;
    }
    .session-date { @apply text-indigo-light; }
    .session-duration { @apply text-muted3; font-size: 0.75rem; }

    /* Messages estimate */
    .msgs-estimate-block { @apply flex flex-col gap-1; }
    .msgs-estimate-list { @apply flex flex-col; gap: 0.2rem; }
    .msgs-estimate-row { @apply flex items-baseline gap-2; }
    .msgs-model-name { @apply text-muted3; font-size: 0.65rem; }
    .msgs-model-count { @apply text-muted1 tabular-nums; font-size: 0.65rem; }

    /* Alarm modal */
    .alarm-modal-overlay {
      @apply fixed inset-0 z-[9999] flex items-center justify-center;
      background: rgba(0,0,0,0.75);
      animation: alarm-pulse 1.2s ease-in-out infinite;
    }
    .alarm-modal {
      @apply bg-surface rounded-xl p-8 text-center max-w-sm w-full mx-4;
      border: 2px solid #e14b4b;
      box-shadow: 0 0 40px rgba(225, 75, 75, 0.4);
    }
    .alarm-modal-title { @apply text-white mb-3; font-size: 1.5rem; }
    .alarm-modal-body { @apply text-muted1 mb-6; font-size: 0.95rem; }
    .alarm-dismiss-btn {
      @apply bg-red-alarm text-white rounded cursor-pointer font-medium;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      border: none;
    }
    .alarm-dismiss-btn:hover { @apply bg-red-light; }

    /* Live clock */
    .live-clock { @apply text-center; letter-spacing: 0.02em; margin: 0.5rem 0; }
    .live-clock .clock-day { @apply text-muted3 font-medium; font-size: 2.5rem; }
    .live-clock .clock-time { @apply font-bold tabular-nums; font-size: 4.5rem; }
  }
</style>
```

### 3. Convert HTML-only structural classes in `index.html` to Tailwind utilities

| Old class | Tailwind replacement |
|---|---|
| `input-area` | `flex flex-col gap-2 w-full max-w-[960px]` |
| `btn-row` | `flex gap-2 flex-wrap` |
| `results` | `flex flex-col gap-4 w-full max-w-[960px]` |
| `pacing-controls` | `flex flex-col gap-3 w-full max-w-[960px]` |
| `pacing-row` | `flex items-center gap-3 text-muted3` (inline style: font-size 0.75rem) |
| `pacing-row label` | inline `min-width: 9rem` style |
| `pacing-row span` | inline `min-width: 8rem; color: #a5b4fc` style |
| `pacing-tips` | `w-full max-w-[960px] mt-4` |
| `tips-grid` | `grid grid-cols-4 gap-4` |
| `tip-card` | `flex flex-col gap-2 p-4 rounded-xl border border-border bg-gradient-to-br from-surface to-base` |
| `tip-level` | `text-indigo-light uppercase tracking-wide` (font-size 0.85rem) |
| `tip-description` | `text-muted3 italic` (font-size 0.75rem) |
| `tip-list` | `flex flex-col gap-1 list-none text-muted2` (font-size 0.75rem) |
| `best-practices-reference` / `pricing-reference` | `w-full max-w-[960px] mt-4` |
| `toggle-btn` | `w-full py-3 bg-surface border border-muted5 rounded text-muted2 text-left cursor-pointer hover:bg-surface2` |
| `reference-content` | `p-6 bg-surface border border-muted5 rounded mt-1` |
| `pricing-grid` | `grid gap-4` with `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` |
| `pricing-card` | `p-4 bg-surface2 border border-border2 rounded-lg flex flex-col gap-3` |
| `pricing-model` | `text-text` (font-size 1rem) |
| `pricing-cost` | `text-muted2 italic` (font-size 0.85rem) |
| `pricing-details` | `flex flex-col gap-2` |
| `pricing-metric` | `flex justify-between items-baseline` (font-size 0.9rem) |
| `metric-label` | `text-muted2 flex-1` |
| `metric-value` | `text-legend-mid font-medium` |
| `section-group` | `grid gap-4` with auto-fit grid |
| `info-block` | `p-4 bg-surface2 border border-border2 rounded-lg` |
| `block-title` | `text-text mb-2` (font-size 0.95rem) |
| `practices-list` / `avoid-list` | keep as-is or convert to Tailwind with `@layer components` pseudo-element styles |
| `#error` | `w-full max-w-[960px] text-red-light` (font-size 0.8rem; min-height: 1.2rem) |

### 4. Update `sw.js`
- Remove `'/claude-usage/styles.css'` from ASSETS
- Add `'/claude-usage/tailwindcss.min.js'` to ASSETS
- Bump cache version: `claude-usage-v4` → `claude-usage-v5`

### 5. Delete `styles.css`

---

## Critical Files

- [index.html](../../index.html) — primary change: replace `<link>` with Tailwind script + config + `<style type="text/tailwindcss">`; convert HTML class attributes
- [styles.css](../../styles.css) — deleted at the end
- [sw.js](../../sw.js) — update ASSETS array and cache version
- renderer.js, alarm.js, history.js — **no changes needed**

---

## Verification

1. Open `index.html` in browser (via dev server or file://) — confirm dark background, card layout, buttons render correctly
2. Paste sample Claude usage text — verify cards render with proper badge colors (red/green/indigo)
3. Check progress bars appear with correct overlay blending
4. Toggle alarm button — confirm alarm modal pulses with red animation
5. Open history panel — verify table, session grouping, and delete button reveal on hover still work
6. Toggle "Session hidden" — verify session cards disappear (data-attribute selector working)
7. Verify app works offline after initial load (service worker caches tailwindcss.min.js)
