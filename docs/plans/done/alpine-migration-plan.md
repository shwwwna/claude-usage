# Alpine.js Migration Plan

**Goal:** Replace imperative DOM construction in `renderer.js` with declarative Alpine.js templates, reducing token consumption in AI coding sessions by ~609 lines of context.

**Motivation:** `renderer.js` is 884 lines of `createElement`/`appendChild` calls. Moving template logic to HTML attributes shrinks it to ~120 lines of pure computation helpers. HTML templates are 3-4x cheaper to read in an AI session than equivalent imperative JavaScript.

---

## Files to Modify

| File | Change |
|---|---|
| `renderer.js` | Remove 764 lines of DOM construction; keep only computation helpers |
| `index.html` | Add Alpine templates, `x-data="app()"` on root container |
| `app.js` | Register `Alpine.data('app', ...)`, migrate event handlers into component methods |
| `sw.js` | Bump cache version, add `alpine.min.js` to ASSETS |

**Create:** `/claude-usage/alpine.min.js` — download Alpine 3.x CDN build once, commit it locally for offline PWA support.

---

## Alpine Component Shape

Register in `app.js` before Alpine initializes:

```js
Alpine.data('app', () => ({
  parsed: null,
  sessionExponent: 0.55,
  weeklyExponent: 0.65,
  sleepStart: 22,
  sleepEnd: 7,
  historyEntries: [],

  get sessionCard() { /* computeStats + buildLegend */ },
  get weeklyCard() { /* computeStats + buildLegend */ },
  get sleepWindows() { /* calls build5hrWindows(this.sleepStart, this.sleepEnd) */ },
  get feasibility() { /* replaces updateFeasibilityRow() */ },
  get suggestions() { /* replaces renderSuggestion() logic */ },
  get chartHtml() { /* calls buildChartHTML(), returns SVG string */ },
  get recentSessions() { /* groupBySession().slice(-5).reverse() */ },

  run(raw) { /* parse + update this.parsed + this.historyEntries */ },
  applyPacing(key, value) { /* replaces Apply button handler */ },
  deleteEntry(ts) { /* replaces inline listener */ },
  confirmClear() { /* confirm() + clearHistory() */ },
  triggerImport() { /* this.$refs.fileInput.click() */ },
  handleImport(file) { /* importJSON().then(...) */ },
  handleExport() { /* exportJSON() */ },
  saveSleep() { /* localStorage for sleepStart/sleepEnd */ },

  init() { /* restore: last input, sleep prefs, alarm state, history */ }
}))
```

---

## Phase 1: Preparation

- [ ] **1.1** Download `alpine@3.14.x/dist/cdn.min.js` → commit as `alpine.min.js`
- [ ] **1.2** `sw.js`: bump cache to `'claude-usage-v4'`, add `alpine.min.js` + remaining JS/CSS to ASSETS
- [ ] **1.3** `app.js`: remove dead `buildSleepOptions()` and the `['sleep-start','sleep-end']` wiring loop (they run before selects exist — they've never worked)

## Phase 2: Wire Alpine (app.js)

- [ ] **2.1** Register `Alpine.data('app', () => ({...}))` — move `sessionExponent`, `weeklyExponent`, `lastParsed` into component state
- [ ] **2.2** Move `run()`, slider handlers, `applySuggestedPacing()` into component methods
- [ ] **2.3** Move `DOMContentLoaded` init into Alpine `init()` hook
- [ ] **2.4** Add `x-data="app()"` to root container in `index.html`
- [ ] **2.5** Add `<script defer src="alpine.min.js"></script>` to `index.html` after `app.js`

## Phase 3: Replace Renderer Functions with Templates

### 3.1 Results Cards (replaces `renderResults`, `buildCard`, `buildUnifiedBar`, `statRow`)

Move to static HTML in `index.html` with:
- `x-show="parsed && parsed.session"` / `x-show="parsed && parsed.weekly"` on card containers
- `x-bind:class` for status badge classes
- `x-bind:style` for bar fill widths: `'width:' + clamp(card.sessionCard.actualPct) + '%'`
- `x-for="t in [10,20,30,40,50,60,70,80,90]"` for bar ticks
- `buildLegend()` stays in JS; render via `x-html="sessionCard.legendHtml"`

### 3.2 Sleep & Windows Card (replaces `buildSleepAndWindowsCard`, `build5hrWindows`)

Move entire card to static HTML:
```html
<div class="card" x-show="parsed">
  <select x-model.number="sleepStart" @change="saveSleep()">
    <template x-for="h in 24" :key="h-1">
      <option :value="h-1" x-text="hourLabel(h-1)"></option>
    </template>
  </select>
  <!-- similar for sleepEnd -->
  <template x-for="(w, i) in sleepWindows" :key="i">
    <div :class="w.asleep ? 'windows-item windows-item-sleep' : 'windows-item'">
      <span x-text="w.num"></span>
      <span x-text="fmtTime(w.start) + '–' + fmtTime(w.end)"></span>
    </div>
  </template>
</div>
```

`sleepWindows` getter calls `build5hrWindows(sleepStart, sleepEnd)`. Alpine reactivity auto-updates when selects change. **Also fixes pre-existing bug:** sleep preferences were never restored across page loads because the selects were created after `buildSleepOptions()` ran.

**Signature change for `build5hrWindows`:** Accept `sleepStart`, `sleepEnd` as params instead of reading DOM via `getSleepHours()`. Delete `getSleepHours()`.

### 3.3 Feasibility Row (replaces `updateFeasibilityRow`)

Add `feasibility` computed getter to component. In HTML:
```html
<div x-show="feasibility.constrained">
  Reachable: <span x-text="feasibility.reachablePct + '%'"></span>
</div>
```

### 3.4 Suggestion Panel (replaces `renderSuggestion`)

`suggestions` getter returns `[{key, type, actualPct, suggested, label, shouldUpdate}]`. In HTML:
```html
<template x-for="s in suggestions" :key="s.key">
  <div :data-type="s.type.toLowerCase()">
    <span x-text="s.type + ' (' + fmt(s.actualPct) + '% used)'"></span>
    <span x-text="s.label"></span>
    <button x-show="s.shouldUpdate" @click="applyPacing(s.key, s.suggested)">Apply</button>
  </div>
</template>
```

### 3.5 History Panel (replaces `renderHistory`, `buildHistoryTable`, `buildHistoryButtons`)

- `recentSessions` getter: `groupBySession(this.historyEntries).slice(-5).reverse()`
- `x-for` over sessions + entries in HTML
- `@click="deleteEntry(e.ts)"` replaces inline listeners
- `<input type="file" x-ref="fileInput" @change="handleImport(...)">` replaces `_fileInput` singleton
- Export/Import/Clear as `@click` methods on static buttons

### 3.6 SVG Chart (replaces `buildChart`)

Modify `buildChart` → `buildChartHTML(entries)` returning SVG string. In HTML:
```html
<div x-html="chartHtml"></div>
```
SVG is valid as `innerHTML`. Removes the last `appendChild` from the flow.

## Phase 4: Clean Up renderer.js

- [ ] **4.1** Delete: `renderResults`, `buildCard`, `statRow`, `buildUnifiedBar`, `buildSleepAndWindowsCard`, `renderSuggestion`, `renderHistory`, `buildHistoryTable`, `buildHistoryButtons`, `updateFeasibilityRow`, `getSleepHours`, global state declarations (`sessionExponent`, `weeklyExponent`, `lastParsed`), `_fileInput` singleton
- [ ] **4.2** Keep (~120 lines):
  - `buildLegend(totalHours, hoursLeft, exponent, actualPct)` → returns HTML string
  - `buildChartHTML(entries)` → returns SVG string
  - `build5hrWindows(hoursLeft, resetMs, sleepStart, sleepEnd)` → returns array
  - `countAwakeWindows(resetMs, sessionStartMs, sleepStart, sleepEnd)` → returns count
  - `isWindowAsleep(...)` → internal helper
  - `fmtTime(date)`, `fmt(n)` → formatters, exposed on Alpine component
- [ ] **4.3** Update `CLAUDE.md`: note Alpine.js, new renderer.js role

---

## Estimated Impact

| File | Before | After | Delta |
|---|---|---|---|
| `renderer.js` | 884 | ~120 | -764 |
| `index.html` | 220 | ~420 | +200 |
| `app.js` | 253 | ~200 | -53 |
| `sw.js` | 28 | ~35 | +7 |
| `alpine.min.js` | 0 | 1 (minified) | +1 |
| **Net** | **1,385** | **~776** | **-609** |

---

## Load Order (index.html scripts)

```
parser.js → stats.js → history.js → alarm.js → app.js → alpine.min.js (defer)
```

`Alpine.data('app', ...)` must be registered in `app.js` before Alpine initializes. The `defer` ensures Alpine runs after DOM parsing and after all preceding scripts.

---

## What Does NOT Migrate

- `parser.js` — pure parsing logic, no DOM
- `stats.js` — pure math, no DOM
- `history.js` — pure storage logic, no DOM
- `alarm.js` — timing + audio, out of scope
- Static collapsible content blocks (Best Practices, Pricing) — already static HTML
