# History & Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add localStorage-based history persistence, a trend chart, export/import, and targeted code cleanup to the Claude Usage Tracker.

**Architecture:** A new `history.js` handles all localStorage reads/writes and analysis. `app.js` calls into it after valid parses and on load. `renderer.js` gains a `renderHistory()` function. No new dependencies — vanilla JS throughout.

**Tech Stack:** Vanilla JS, SVG (no library), localStorage, HTML5 File API

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `history.js` | **Create** | Storage, export, import, analysis |
| `app.js` | **Modify** | Wire history calls, add CONFIG, debounce, restore textarea, remove dead interval |
| `renderer.js` | **Modify** | Add `renderHistory()`, extract DOM helpers |
| `index.html` | **Modify** | Add `<script src="history.js">`, add `<div id="history-panel">` |
| `styles.css` | **Modify** | History panel, chart, table, button styles |
| `stats.js` | No changes | — |

---

## Task 1: Create `history.js` — storage core

**Files:**
- Create: `history.js`

- [ ] **Step 1: Write the file with storage and analysis functions**

```js
const HISTORY_KEY = 'claude-usage-history';
const LAST_INPUT_KEY = 'claude-usage-last-input';
const MAX_ENTRIES = 200;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveEntry(entry) {
  const history = loadHistory();
  history.push(entry);
  if (history.length > MAX_ENTRIES) history.splice(0, history.length - MAX_ENTRIES);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function saveLastInput(text) {
  localStorage.setItem(LAST_INPUT_KEY, text);
}

function loadLastInput() {
  return localStorage.getItem(LAST_INPUT_KEY) || '';
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

function exportJSON() {
  const data = JSON.stringify(loadHistory(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'claude-usage-history.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const incoming = JSON.parse(e.target.result);
        if (!Array.isArray(incoming)) return reject('Invalid format');
        const existing = loadHistory();
        const existingTs = new Set(existing.map(function(x) { return x.ts; }));
        const merged = existing.concat(incoming.filter(function(x) { return !existingTs.has(x.ts); }));
        merged.sort(function(a, b) { return a.ts - b.ts; });
        if (merged.length > MAX_ENTRIES) merged.splice(0, merged.length - MAX_ENTRIES);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
        resolve(merged);
      } catch { reject('Parse error'); }
    };
    reader.readAsText(file);
  });
}

function analyzeHistory(entries) {
  const now = Date.now();
  const cutoff7d = now - 7 * 24 * 3600 * 1000;
  const recent = entries.filter(function(e) { return e.ts >= cutoff7d; });

  function avg(arr, key) {
    const vals = arr.map(function(e) { return e[key]; }).filter(function(v) { return v != null; });
    return vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : null;
  }

  function trend(arr, key) {
    const vals = arr.map(function(e) { return e[key]; }).filter(function(v) { return v != null; });
    if (vals.length < 2) return 'flat';
    const first = vals.slice(0, Math.ceil(vals.length / 2));
    const last = vals.slice(Math.floor(vals.length / 2));
    const firstAvg = first.reduce(function(a, b) { return a + b; }, 0) / first.length;
    const lastAvg = last.reduce(function(a, b) { return a + b; }, 0) / last.length;
    const diff = lastAvg - firstAvg;
    if (diff > 3) return 'up';
    if (diff < -3) return 'down';
    return 'flat';
  }

  return {
    sessionAvg7d: avg(recent, 'sessionPct'),
    weeklyAvg7d: avg(recent, 'weeklyPct'),
    sessionTrend: trend(recent, 'sessionPct'),
    weeklyTrend: trend(recent, 'weeklyPct')
  };
}
```

- [ ] **Step 2: Verify the file exists and has no syntax errors**

Open the browser console and run:
```js
loadHistory()  // should return []
```
Expected: `[]` (empty array, no errors)

- [ ] **Step 3: Commit**

```bash
git add history.js
git commit -m "feat: add history.js with storage, export, import, analysis"
```

---

## Task 2: Wire `history.js` into `app.js`

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Replace the full contents of `app.js`**

```js
const CONFIG = {
  SESSION_WINDOW_HOURS: 5,
  WEEKLY_WINDOW_HOURS: 168,
  DEBOUNCE_MS: 300
};

const textarea = document.getElementById('input');
const errorEl  = document.getElementById('error');

let debounceTimer;

function run() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function() {
    const raw = textarea.value;
    errorEl.textContent = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('suggestion').innerHTML = '';
    if (!raw.trim()) return;

    try {
      const parsed = parseUsageText(raw);
      if (parsed.errors.length) errorEl.textContent = parsed.errors.join('\n');
      renderResults(parsed);
      renderSuggestion(parsed);

      if (parsed.session || parsed.weekly) {
        saveEntry({
          ts: Date.now(),
          sessionPct: parsed.session ? parsed.session.actualPct : null,
          weeklyPct: parsed.weekly ? parsed.weekly.actualPct : null,
          sessionHoursLeft: parsed.session ? parsed.session.hoursLeft : null,
          weeklyHoursLeft: parsed.weekly ? parsed.weekly.hoursLeft : null
        });
        saveLastInput(raw);
        renderHistory(loadHistory());
      }
    } catch (err) {
      errorEl.textContent = err;
    }
  }, CONFIG.DEBOUNCE_MS);
}

textarea.addEventListener('input', run);

document.getElementById('btn-clear').addEventListener('click', function() {
  textarea.value = '';
  errorEl.textContent = '';
  document.getElementById('results').innerHTML = '';
  document.getElementById('suggestion').innerHTML = '';
  renderHistory(loadHistory());
});

document.getElementById('btn-open-usage').addEventListener('click', function() {
  if (navigator.windowControlsOverlay) {
    window.open('https://claude.ai/settings/usage', 'claude-usage-window', 'popup,width=800,height=600');
  } else {
    window.open('https://claude.ai/settings/usage', '_blank');
  }
});

function exponentToLabel(v) {
  if (v <= 0.5)  return 'aggressive';
  if (v <= 0.65) return 'front-loaded';
  if (v <= 0.8)  return 'slight push';
  return 'conservative';
}

['session', 'weekly'].forEach(function(key) {
  const slider = document.getElementById(key + '-exponent');
  const label  = document.getElementById(key + '-exponent-label');
  slider.addEventListener('input', function() {
    const v = parseFloat(slider.value);
    if (key === 'session') sessionExponent = v;
    else weeklyExponent = v;
    label.textContent = exponentToLabel(v);
    run();
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

document.addEventListener('DOMContentLoaded', function() {
  const last = loadLastInput();
  if (last) {
    textarea.value = last;
    run();
  }
  renderHistory(loadHistory());
});
```

- [ ] **Step 2: Verify textarea restores on reload**

Open the app in a browser, paste valid usage text, reload the page.
Expected: textarea repopulates and results render automatically.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: wire history into app.js, add CONFIG, debounce, restore on load"
```

---

## Task 3: Add `renderHistory()` to `renderer.js`

**Files:**
- Modify: `renderer.js`

- [ ] **Step 1: Add `renderHistory` and SVG chart builder at the bottom of `renderer.js`**

Append the following to the end of `renderer.js` (after the closing of `renderSuggestion`):

```js
function renderHistory(entries) {
  const container = document.getElementById('history-panel');
  if (!container) return;
  container.innerHTML = '';
  if (!entries.length) {
    container.innerHTML = '<p class="history-empty">No history yet. Paste usage data above to start tracking.</p>';
    return;
  }

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.className = 'history-summary';
  summary.textContent = 'Usage History';
  details.appendChild(summary);

  const analysis = analyzeHistory(entries);
  const analysisEl = document.createElement('div');
  analysisEl.className = 'history-analysis';

  const parts = [];
  if (analysis.sessionAvg7d != null) parts.push('session ' + fmt(analysis.sessionAvg7d) + '% (' + analysis.sessionTrend + ')');
  if (analysis.weeklyAvg7d != null) parts.push('weekly ' + fmt(analysis.weeklyAvg7d) + '% (' + analysis.weeklyTrend + ')');
  analysisEl.textContent = parts.length ? '7-day avg: ' + parts.join(', ') : '';
  details.appendChild(analysisEl);

  details.appendChild(buildChart(entries));
  details.appendChild(buildHistoryTable(entries));
  details.appendChild(buildHistoryButtons());

  container.appendChild(details);
}

function buildChart(entries) {
  const W = 400, H = 120, PAD = 10;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('class', 'history-chart');

  const minTs = entries[0].ts;
  const maxTs = entries[entries.length - 1].ts;
  const tsRange = maxTs - minTs || 1;

  function toX(ts) { return PAD + ((ts - minTs) / tsRange) * plotW; }
  function toY(pct) { return PAD + (1 - pct / 100) * plotH; }

  function makeLine(key, cls) {
    const points = entries
      .filter(function(e) { return e[key] != null; })
      .map(function(e) { return toX(e.ts) + ',' + toY(e[key]); })
      .join(' ');
    if (!points) return;
    const poly = document.createElementNS(ns, 'polyline');
    poly.setAttribute('points', points);
    poly.setAttribute('class', cls);
    svg.appendChild(poly);

    entries.filter(function(e) { return e[key] != null; }).forEach(function(e) {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', toX(e.ts));
      circle.setAttribute('cy', toY(e[key]));
      circle.setAttribute('r', '3');
      circle.setAttribute('class', cls + '-dot');
      svg.appendChild(circle);
    });
  }

  makeLine('sessionPct', 'chart-session');
  makeLine('weeklyPct', 'chart-weekly');

  const dateWrap = document.createElement('div');
  dateWrap.className = 'chart-dates';
  const d1 = new Date(minTs);
  const d2 = new Date(maxTs);
  dateWrap.innerHTML =
    '<span>' + d1.toLocaleDateString() + '</span>' +
    '<span>' + d2.toLocaleDateString() + '</span>';

  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  wrap.appendChild(svg);
  wrap.appendChild(dateWrap);
  return wrap;
}

function buildHistoryTable(entries) {
  const recent = entries.slice(-10).reverse();
  const table = document.createElement('table');
  table.className = 'history-table';
  table.innerHTML = '<thead><tr><th>Date/Time</th><th>Session %</th><th>Weekly %</th></tr></thead>';
  const tbody = document.createElement('tbody');
  recent.forEach(function(e) {
    const d = new Date(e.ts);
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</td>' +
      '<td>' + (e.sessionPct != null ? fmt(e.sessionPct) + '%' : '—') + '</td>' +
      '<td>' + (e.weeklyPct != null ? fmt(e.weeklyPct) + '%' : '—') + '</td>';
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function buildHistoryButtons() {
  const row = document.createElement('div');
  row.className = 'history-btn-row';

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export JSON';
  exportBtn.className = 'btn-history';
  exportBtn.addEventListener('click', exportJSON);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', function() {
    if (!fileInput.files[0]) return;
    importJSON(fileInput.files[0]).then(function(merged) {
      renderHistory(merged);
    });
    fileInput.value = '';
  });

  const importBtn = document.createElement('button');
  importBtn.textContent = 'Import JSON';
  importBtn.className = 'btn-history';
  importBtn.addEventListener('click', function() { fileInput.click(); });

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear history';
  clearBtn.className = 'btn-history btn-history-clear';
  clearBtn.addEventListener('click', function() {
    if (confirm('Clear all history? This can\'t be undone.')) {
      clearHistory();
      renderHistory([]);
    }
  });

  row.appendChild(exportBtn);
  row.appendChild(importBtn);
  row.appendChild(fileInput);
  row.appendChild(clearBtn);
  return row;
}
```

- [ ] **Step 2: Remove the dead `renderClock` function from `renderer.js`**

Delete lines 182–193 of `renderer.js` (the `renderClock` function) — it is no longer called from anywhere:

```js
// DELETE this entire function:
function renderClock() {
  const el = document.getElementById('live-clock');
  if (!el) return;
  ...
}
```

- [ ] **Step 3: Verify no JS errors in console**

Open browser DevTools. Expected: no errors thrown.

- [ ] **Step 4: Commit**

```bash
git add renderer.js
git commit -m "feat: add renderHistory, buildChart, buildHistoryTable, buildHistoryButtons; remove dead renderClock"
```

---

## Task 4: Update `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add `history.js` script tag and history panel div**

In `index.html`, make two changes:

Change the script block from:
```html
<script src="parser.js"></script>
<script src="stats.js"></script>
<script src="renderer.js"></script>
<script src="app.js"></script>
```
To:
```html
<script src="parser.js"></script>
<script src="stats.js"></script>
<script src="history.js"></script>
<script src="renderer.js"></script>
<script src="app.js"></script>
```

And add the history panel div after `<div class="results" id="results"></div>`:
```html
<div class="results" id="results"></div>
<div id="history-panel"></div>
```

Also remove the duplicate service worker registration block at the bottom (the inline `<script>` after `app.js`) since `app.js` already registers it:
```html
<!-- remove this block: -->
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
</script>
```

- [ ] **Step 2: Verify page loads without errors**

Open browser. Expected: no console errors, history panel div is present in DOM.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add history.js script and history-panel div to index.html"
```

---

## Task 5: Add styles to `styles.css`

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Append history styles at the end of `styles.css`**

```css
/* History panel */
#history-panel { margin-top: 1.5rem; }

.history-empty {
  color: #888;
  font-size: 0.85rem;
  text-align: center;
  padding: 1rem 0;
}

details.history-summary { }

.history-summary {
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  color: #a5b4fc;
  padding: 0.5rem 0;
  user-select: none;
}

.history-analysis {
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 0.75rem;
}

/* Chart */
.chart-wrap { margin-bottom: 1rem; }

.history-chart {
  width: 100%;
  display: block;
  background: #1c1c1f;
  border-radius: 6px;
}

.chart-session {
  fill: none;
  stroke: #6366f1;
  stroke-width: 1.5;
}

.chart-session-dot { fill: #6366f1; }

.chart-weekly {
  fill: none;
  stroke: #86efac;
  stroke-width: 1.5;
}

.chart-weekly-dot { fill: #86efac; }

.chart-dates {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #555;
  margin-top: 0.2rem;
}

/* History table */
.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  font-family: monospace;
  margin-bottom: 0.75rem;
}

.history-table th {
  text-align: left;
  color: #888;
  font-weight: normal;
  padding: 0.2rem 0.5rem 0.4rem 0;
  border-bottom: 1px solid #2a2a2e;
}

.history-table td {
  padding: 0.25rem 0.5rem 0.25rem 0;
  color: #ccc;
  border-bottom: 1px solid #1c1c1f;
}

/* History buttons */
.history-btn-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.btn-history {
  font-size: 0.78rem;
  padding: 0.3rem 0.7rem;
  border-radius: 4px;
  border: 1px solid #3a3a3e;
  background: #1c1c1f;
  color: #ccc;
  cursor: pointer;
}

.btn-history:hover { background: #2a2a2e; }

.btn-history-clear {
  color: #f87171;
  border-color: #450a0a;
  margin-left: auto;
}

.btn-history-clear:hover { background: #1a0a0a; }
```

- [ ] **Step 2: Verify visual appearance**

Open browser. Paste valid usage text. Open the "Usage History" details element. Expected: chart shows lines, table shows entries, buttons are visible and styled.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: add history panel, chart, table, and button styles"
```

---

## Task 6: End-to-end verification

- [ ] **Step 1: Paste valid usage text**

```
Current session
Resets in 1 hr 30 min
74% used

Weekly limits
All models
Resets Fri 5:59 AM
65% used
```

Open DevTools → Application → Local Storage. Verify `claude-usage-history` key has one entry with `sessionPct: 74`, `weeklyPct: 65`.

- [ ] **Step 2: Reload the page**

Expected: textarea repopulates with the pasted text, results render automatically.

- [ ] **Step 3: Add 3 more entries with different values**

Paste the same text but edit the percentages (e.g. `80% used`, `50% used`, `30% used`).  
Open history panel. Expected: table shows up to 4 entries, chart shows two lines, analysis line shows averages.

- [ ] **Step 4: Export**

Click "Export JSON". Expected: file `claude-usage-history.json` downloads with all entries.

- [ ] **Step 5: Clear history**

Click "Clear history". Click OK in confirm dialog. Expected: panel shows empty state message.

- [ ] **Step 6: Import**

Click "Import JSON". Select the exported file. Expected: all entries reappear in table and chart.

- [ ] **Step 7: Import again (dedup check)**

Click "Import JSON" again with the same file. Expected: entry count does not grow.

- [ ] **Step 8: Mobile check**

Resize browser to ~375px width. Expected: history panel, chart, and table don't overflow horizontally.
