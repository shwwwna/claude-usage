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
