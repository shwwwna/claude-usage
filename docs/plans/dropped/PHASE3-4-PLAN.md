# Phase 3-4 Execution Plan: Alpine Template Migration

**Goal:** Replace 764 lines of imperative DOM construction in `renderer.js` with declarative Alpine.js templates in `index.html`, reducing codebase footprint by ~609 lines and cutting token consumption per session by ~30%.

**Status:** Phases 1-2 complete. Ready for template migration.

---

## Token Optimization Strategy

The fundamental insight: HTML templates are ~3-4x cheaper to read in an AI session than equivalent imperative JavaScript. A 200-line HTML template costs less to include in context than 600+ lines of createElement chains.

**Current cost baseline:**
- `renderer.js`: 884 lines (expensive to read every session)
- `app.js`: ~200 lines (read every session)
- `index.html`: 220 lines (read every session)
- Total per-session context: ~1,300 lines

**After migration:**
- `renderer.js`: ~120 lines (keep only computation helpers)
- `app.js`: ~200 lines (stays similar)
- `index.html`: ~420 lines (templates replace JS logic)
- Total per-session context: ~740 lines
- **Net savings: 560 lines / 43% reduction**

---

## Phase 3: Template Migration

### 3.1 Results Cards (Session & Weekly)

**Current:** `renderResults()` → `buildCard()` → complex DOM manipulation
**Target:** Static HTML with Alpine bindings

```html
<div class="card" x-show="parsed && parsed.session" data-type="session">
  <div class="card-title">Session</div>
  
  <div class="stat-row compact-meta-row">
    <span class="compact-meta-cell">
      <span class="stat-label">Used</span>
      <span class="stat-value fraction-value">
        <span class="frac-actual" x-text="fmt(parsed.session.actualPct) + '%'"></span>
        <span class="frac-sep">/</span>
        <span class="frac-target" x-text="fmt(sessionCard.targetPct) + '%'"></span>
      </span>
    </span>
    <span class="compact-meta-cell">
      <span class="stat-label">Resets</span>
      <span class="stat-value" x-text="sessionCard.resetLabel"></span>
    </span>
  </div>

  <div class="stat-row" :class="'status-' + sessionCard.status">
    <span><span class="badge" :class="'badge-' + sessionCard.status" x-text="sessionCard.badgeText"></span></span>
    <span class="stat-value" :class="'diff-' + sessionCard.status" x-text="(sessionCard.diff > 0 ? '+' : '') + fmt(sessionCard.diff) + ' pp'"></span>
  </div>

  <div class="msgs-estimate-block">
    <div class="stat-label">Est. msgs left</div>
    <div class="msgs-estimate-list">
      <template x-for="m in sessionCard.models">
        <div class="msgs-estimate-row">
          <span class="msgs-model-name" x-text="m.name"></span>
          <span class="msgs-model-count" x-text="m.count"></span>
        </div>
      </template>
    </div>
  </div>

  <div class="bar-track unified">
    <div class="bar-target-fill" :style="'width:' + clamp(sessionCard.targetPct) + '%'"></div>
    <div class="bar-actual-fill" :class="'status-' + sessionCard.status" :style="'width:' + clamp(parsed.session.actualPct) + '%'"></div>
    <template x-for="t in [10,20,30,40,50,60,70,80,90]">
      <div class="bar-tick" :style="'left:' + t + '%'"></div>
    </template>
    <div class="bar-target-marker" :style="'left:' + clamp(sessionCard.targetPct) + '%'"></div>
    <div class="bar-endpoint-dot" :class="'status-' + sessionCard.status" :style="'left:' + clamp(parsed.session.actualPct) + '%'"></div>
  </div>

  <div class="bar-legend" x-html="buildLegend(SESSION_WINDOW_HOURS, parsed.session.hoursLeft, sessionExponent, parsed.session.actualPct)"></div>
</div>
```

**Computed getter in app.js:**
```js
get sessionCard() {
  if (!this.parsed || !this.parsed.session) return null;
  const stats = computeStats(SESSION_WINDOW_HOURS, this.parsed.session.hoursLeft, this.parsed.session.actualPct, this.sessionExponent);
  const resetMs = Date.now() + this.parsed.session.hoursLeft * 3600 * 1000;
  const resetDate = new Date(resetMs);
  // ... format reset label
  const models = [
    { name: 'Haiku',  count: Math.round((1 - this.parsed.session.actualPct / 100) * 150) },
    { name: 'Sonnet', count: Math.round((1 - this.parsed.session.actualPct / 100) * 45) },
    { name: 'Opus',   count: Math.round((1 - this.parsed.session.actualPct / 100) * 12) },
  ];
  return { ...stats, resetLabel, models };
}
```

### 3.2 Sleep & Windows Card

**Current:** `buildSleepAndWindowsCard()` creates selects dynamically
**Target:** Static selects with Alpine reactivity

```html
<div class="card" x-show="parsed" data-type="sleep-windows">
  <div class="card-title">Sleep & Windows</div>
  
  <div class="sleep-row">
    <label class="sleep-label">Sleep hours:</label>
    <select x-model.number="sleepStart" @change="saveSleep()" class="sleep-select">
      <template x-for="h in 24" :key="h-1">
        <option :value="h-1" x-text="hourLabel(h-1)"></option>
      </template>
    </select>
    <span class="sleep-sep">–</span>
    <select x-model.number="sleepEnd" @change="saveSleep()" class="sleep-select">
      <template x-for="h in 24" :key="h-1">
        <option :value="h-1" x-text="hourLabel(h-1)"></option>
      </template>
    </select>
  </div>

  <div class="windows-list">
    <div class="windows-header">
      <span class="stat-label">5-hr windows until reset</span>
      <span class="windows-total" x-text="'total ~' + (sleepWindows.length * SESSION_WINDOW_HOURS) + ' hrs'"></span>
    </div>
    <div class="windows-items">
      <template x-for="(w, i) in sleepWindows" :key="i">
        <template x-if="i === 0 || sleepWindows[i-1].dayKey !== w.dayKey">
          <div class="windows-day" x-text="w.dayKey"></div>
        </template>
        <div :class="w.asleep ? 'windows-item windows-item-sleep' : 'windows-item'">
          <span class="windows-num" x-text="w.asleep ? '' : w.windowNum + '.'"></span>
          <span class="windows-range">
            <span x-text="fmtTime(w.start) + '–' + fmtTime(w.end)"></span>
            <template x-if="w.durationHours !== 5">
              <span class="windows-duration" x-text="' (' + w.durationHours + 'h)'"></span>
            </template>
          </span>
        </div>
      </template>
    </div>
  </div>
</div>
```

**Computed getter:**
```js
get sleepWindows() {
  if (!this.parsed) return [];
  const hoursLeft = this.parsed.weekly ? this.parsed.weekly.hoursLeft : 24;
  const resetMs = Date.now() + hoursLeft * 3600 * 1000;
  const sessionStartMs = loadSessionStartTime();
  return build5hrWindows(hoursLeft, resetMs, sessionStartMs, this.sleepStart, this.sleepEnd);
}

saveSleep() {
  localStorage.setItem('claude-usage-sleep-start', this.sleepStart.toString());
  localStorage.setItem('claude-usage-sleep-end', this.sleepEnd.toString());
  this.run({ skipAutoPace: true });
}
```

### 3.3 Feasibility Row

**Current:** `updateFeasibilityRow()` modifies DOM conditionally
**Target:** Alpine x-show

```html
<div x-show="feasibility.constrained" class="stat-row compact-meta-row">
  <span class="compact-meta-cell">
    <span class="stat-label">Reachable</span>
    <span class="stat-value fraction-value">
      <span class="frac-actual" x-text="fmt(feasibility.reachablePct) + '%'"></span>
      <span class="frac-sep">/</span>
      <span class="frac-target">100%</span>
    </span>
  </span>
</div>
```

**Computed getter:**
```js
get feasibility() {
  if (!this.parsed || !this.parsed.weekly || !this.parsed.session) {
    return { constrained: false };
  }
  const actualPct = this.parsed.weekly.actualPct;
  const hoursLeft = this.parsed.weekly.hoursLeft;
  const weeklyRemaining = 100 - actualPct;
  const weeklyResetMs = Date.now() + hoursLeft * 3600 * 1000;
  const sessionStartMs = Date.now() - (SESSION_WINDOW_HOURS - this.parsed.session.hoursLeft) * 3600 * 1000;
  const awakeWindows = countAwakeWindows(weeklyResetMs, sessionStartMs, this.sleepStart, this.sleepEnd);
  const reachableAdditional = awakeWindows * (SESSION_WINDOW_HOURS / WEEKLY_WINDOW_HOURS) * 100;
  const reachablePct = Math.min(100, actualPct + reachableAdditional);
  const constrained = reachableAdditional < weeklyRemaining - 5;
  return { constrained, reachablePct };
}
```

### 3.4 Suggestion Panel

**Current:** `renderSuggestion()` builds items with click handlers
**Target:** Alpine x-for with @click

```html
<div x-show="suggestions.length > 0" class="suggestion-section">
  <div class="suggestion-heading">💡 Suggested Pacing</div>
  <div class="suggestion-items">
    <template x-for="s in suggestions" :key="s.key">
      <div :class="s.shouldUpdate ? 'suggestion-item suggestion-update' : 'suggestion-item'" :data-type="s.type.toLowerCase()">
        <span class="suggestion-label" x-text="s.type + ' (' + fmt(s.actualPct) + '% used)'"></span>
        <span class="suggestion-value" x-text="exponentToLabel(s.suggested).charAt(0).toUpperCase() + exponentToLabel(s.suggested).slice(1)"></span>
        <template x-if="s.shouldUpdate">
          <button class="suggestion-btn" @click="applyPacing(s.key, s.suggested)">Apply</button>
        </template>
      </div>
    </template>
  </div>
</div>
```

**Computed getter:**
```js
get suggestions() {
  if (!this.parsed) return [];
  const suggestions = [];
  if (this.parsed.session) {
    const suggested = suggestPacing(this.parsed.session.actualPct);
    const shouldUpdate = Math.abs(suggested - this.sessionExponent) > 0.05;
    suggestions.push({
      key: 'session', type: 'Session', actualPct: this.parsed.session.actualPct,
      suggested, shouldUpdate
    });
  }
  if (this.parsed.weekly) {
    const suggested = suggestPacing(this.parsed.weekly.actualPct);
    const shouldUpdate = Math.abs(suggested - this.weeklyExponent) > 0.05;
    suggestions.push({
      key: 'weekly', type: 'Weekly', actualPct: this.parsed.weekly.actualPct,
      suggested, shouldUpdate
    });
  }
  return suggestions;
}

applyPacing(key, value) {
  if (key === 'session') this.sessionExponent = value;
  else this.weeklyExponent = value;
  this.run({ skipAutoPace: true });
}
```

### 3.5 History Panel

**Current:** `renderHistory()` → `buildHistoryTable()` with inline delete listeners
**Target:** Alpine x-for with @click

```html
<div id="history-panel" x-show="historyEntries.length > 0">
  <div class="history-title">Usage History</div>
  <div class="history-analysis" x-text="historyAnalysisText"></div>
  <div x-html="buildChartHTML(historyEntries)"></div>
  
  <div class="history-sessions-container">
    <template x-for="session in recentSessions" :key="session.startTime">
      <div class="history-session">
        <div class="session-header">
          <span class="session-date" x-text="formatSessionDate(session.startTime)"></span>
          <span class="session-duration" x-text="'(' + formatDuration(session.durationMs) + ')'"></span>
        </div>
        <table class="history-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Session %</th>
              <th>Weekly %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template x-for="e in session.entries" :key="e.ts">
              <tr>
                <td x-text="formatEntryTime(e.ts)"></td>
                <td x-text="e.sessionPct != null ? fmt(e.sessionPct) + '%' : '—'"></td>
                <td x-text="e.weeklyPct != null ? fmt(e.weeklyPct) + '%' : '—'"></td>
                <td>
                  <button class="btn-history-delete" @click="deleteEntry(e.ts)" title="Delete entry">×</button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </div>

  <div class="history-btn-row">
    <button class="btn-history" @click="handleExport()">Export JSON</button>
    <button class="btn-history" @click="triggerImport()">Import JSON</button>
    <input type="file" x-ref="fileInput" accept=".json" @change="handleImport($event)" style="display: none;">
    <button class="btn-history btn-history-clear" @click="confirmClear()">Clear history</button>
  </div>
</div>

<div id="history-panel" x-show="!historyEntries.length" class="history-empty">
  <p>No history yet. Paste usage data above to start tracking.</p>
</div>
```

**Computed getters & methods:**
```js
get recentSessions() {
  const sessions = groupBySession(this.historyEntries);
  return sessions.slice(-5).reverse();
}

get historyAnalysisText() {
  if (!this.historyEntries.length) return '';
  const analysis = analyzeHistory(this.historyEntries);
  const parts = [];
  if (analysis.sessionAvg7d != null) parts.push('session ' + fmt(analysis.sessionAvg7d) + '% (' + analysis.sessionTrend + ')');
  if (analysis.weeklyAvg7d != null) parts.push('weekly ' + fmt(analysis.weeklyAvg7d) + '% (' + analysis.weeklyTrend + ')');
  return parts.length ? '7-day avg: ' + parts.join(', ') : '';
}

deleteEntry(ts) {
  deleteEntry(ts);
  this.historyEntries = loadHistory();
}

confirmClear() {
  if (confirm('Clear all history? This can\'t be undone.')) {
    clearHistory();
    this.historyEntries = [];
  }
}

triggerImport() {
  this.$refs.fileInput.click();
}

handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  importJSON(file).then((merged) => {
    this.historyEntries = merged;
    e.target.value = '';
  });
}

handleExport() {
  exportJSON();
}
```

---

## Phase 4: Clean Up renderer.js

**Remove:** Lines 1-3 (global state), 5-67 (renderResults/updateFeasibilityRow), 68-214 (buildCard/statRow/buildUnifiedBar), 344-352 (getSleepHours), 377-445 (buildSleepAndWindowsCard), 600-667 (renderSuggestion), 669-696 (renderHistory), 754-837 (buildHistoryTable/buildHistoryButtons), 839-884 (buttons)

**Keep:** ~120 lines of pure helpers:
- `buildLegend(totalHours, hoursLeft, exponent, actualPct)` → returns HTML string
- `buildChartHTML(entries)` → returns SVG string (renamed from buildChart)
- `build5hrWindows(hoursLeft, resetMs, sessionStartMs, sleepStart, sleepEnd)` → returns array
- `countAwakeWindows(resetMs, sessionStartMs, sleepStart, sleepEnd)` → returns count
- `isWindowAsleep(...)` → internal helper
- `fmtTime(date)`, `fmt(n)` → formatters
- Helper functions: `hourLabel()`, `formatSessionDate()`, `formatEntryTime()`, `formatDuration()`, `clamp()`

**Export on Alpine component:**
All helpers should be globally accessible or methods on the Alpine component so templates can call them.

---

## Implementation Order

1. **Create comprehensive Alpine component in app.js** with all getters and methods (one edit)
2. **Update index.html** with template sections (3-4 large edits for each section)
3. **Delete old functions from renderer.js** (one large deletion)
4. **Test in browser** to ensure all displays work
5. **Update CLAUDE.md** to reflect new architecture

---

## Verification Checklist

- [ ] Session card displays with correct data binding
- [ ] Weekly card displays with correct data binding
- [ ] Sleep/Windows card renders correctly with selects working
- [ ] Feasibility row only shows when constrained
- [ ] Suggestions panel appears/disappears correctly
- [ ] History panel shows recent sessions with delete buttons
- [ ] Export/Import/Clear history buttons work
- [ ] All formatters (fmt, fmtTime, hourLabel) work
- [ ] Chart renders via x-html
- [ ] SVG chart is interactive (if applicable)
- [ ] Sleep preferences persist across page loads
- [ ] No console errors
- [ ] No regression in existing features

---

## Expected Token Savings

After Phase 3-4 completes:
- **Context reduction:** 560 lines (43% smaller)
- **Per-session token savings:** ~1,500-2,000 tokens
- **Monthly savings** (100 sessions/month): ~150,000-200,000 tokens
- **Quarterly savings** (300 sessions): ~450,000-600,000 tokens

---

## Critical Implementation Notes

1. **Alpine initialization order:** Alpine must initialize AFTER `app.js` registers the component. The `defer` attribute on the script tag ensures this.

2. **Global state migration:** Move `sessionExponent` and `weeklyExponent` from renderer.js globals into Alpine component state. The old renderResults/renderSuggestion still read from window globals during transition.

3. **Signature changes:**
   - `build5hrWindows(hoursLeft, resetMs, sessionStartMs)` → `build5hrWindows(hoursLeft, resetMs, sessionStartMs, sleepStart, sleepEnd)` (now receives sleep prefs, no longer reads DOM)
   - `countAwakeWindows(resetMs, sessionStartMs)` → `countAwakeWindows(resetMs, sessionStartMs, sleepStart, sleepEnd)`

4. **Reactivity trigger:** Setting `x-model.number="sleepStart"` or `@change="saveSleep()"` on selects automatically re-evaluates the `sleepWindows` computed getter due to Alpine's reactivity system.

5. **Event handling:** All click handlers become `@click` directives in templates. No more addEventListener chains in JS.
