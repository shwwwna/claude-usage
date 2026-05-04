const HISTORY_KEY = 'claude-usage-history';
const LAST_INPUT_KEY = 'claude-usage-last-input';
const SESSION_START_TIME_KEY = 'claude-usage-session-start-time';
const SESSION_ID_KEY = 'claude-usage-session-id';
const SESSION_CREATED_KEY = 'claude-usage-session-created';
const MAX_ENTRIES = 200;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function dedupKey(e) {
  return e.sessionPct + '|' + e.weeklyPct;
}

function getResetTime(e) {
  if (e.sessionHoursLeft !== null) {
    return e.ts + (e.sessionHoursLeft * 3600 * 1000);
  }
  return null;
}

function dedupEntries(entries) {
  const seen = new Map();
  const resetTimeSeen = new Map();

  for (const e of entries) {
    const resetTime = getResetTime(e);

    if (resetTime !== null) {
      const resetKey = Math.round(resetTime / 1000);
      if (resetTimeSeen.has(resetKey)) {
        const existing = resetTimeSeen.get(resetKey);
        if (e.ts > existing.ts) {
          resetTimeSeen.set(resetKey, e);
        }
        continue;
      }
      resetTimeSeen.set(resetKey, e);
    }

    const k = dedupKey(e);
    if (!seen.has(k) || e.ts > seen.get(k).ts) {
      seen.set(k, e);
    }
  }

  const combined = Array.from(resetTimeSeen.values()).concat(
    Array.from(seen.values()).filter(function(e) {
      return !resetTimeSeen.has(Math.round(getResetTime(e) / 1000));
    })
  );

  return combined.sort(function(a, b) { return a.ts - b.ts; });
}

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const sorted = raw.sort(function(a, b) { return a.ts - b.ts; });
    const deduped = dedupEntries(sorted);
    if (deduped.length !== raw.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(deduped));
    }
    return deduped;
  } catch { return []; }
}

function getOrCreateSessionId() {
  try {
    const data = JSON.parse(localStorage.getItem(SESSION_ID_KEY) || '{}');
    const now = Date.now();
    if (data.id && data.createdAt && (now - data.createdAt) < SESSION_TIMEOUT_MS) {
      return data.id;
    }
  } catch (e) {}

  const newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id: newId, createdAt: Date.now() }));
  return newId;
}

function saveEntry(entry) {
  const history = loadHistory();
  const sessionId = getOrCreateSessionId();
  entry.sessionId = sessionId;

  const entryKey = dedupKey(entry);
  const existing = history.find(function(e) { return dedupKey(e) === entryKey; });
  if (existing && entry.ts <= existing.ts) return;
  if (existing) {
    const idx = history.indexOf(existing);
    history[idx] = entry;
  } else {
    history.push(entry);
  }
  if (history.length > MAX_ENTRIES) history.splice(0, history.length - MAX_ENTRIES);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function saveLastInput(text) {
  localStorage.setItem(LAST_INPUT_KEY, text);
}

function loadLastInput() {
  return localStorage.getItem(LAST_INPUT_KEY) || '';
}

function saveSessionStartTime(ms) {
  localStorage.setItem(SESSION_START_TIME_KEY, JSON.stringify({
    startMs: ms,
    savedAt: Date.now()
  }));
}

function loadSessionStartTime() {
  try {
    const val = localStorage.getItem(SESSION_START_TIME_KEY);
    if (!val) return null;
    const data = JSON.parse(val);
    // Only use if saved less than 5.5 hours ago (session window + buffer)
    if (Date.now() - data.savedAt < 5.5 * 3600 * 1000) {
      return data.startMs;
    }
  } catch (e) {
    // ignore parse errors
  }
  return null;
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

function deleteEntry(ts) {
  const history = loadHistory();
  const next = history.filter(function(e) { return e.ts !== ts; });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function exportJSON() {
  const data = JSON.stringify(loadHistory(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'claude-usage-history.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
        const merged = dedupEntries(existing.concat(incoming).sort(function(a, b) { return a.ts - b.ts; }));
        if (merged.length > MAX_ENTRIES) merged.splice(0, merged.length - MAX_ENTRIES);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
        resolve(merged);
      } catch { reject('Parse error'); }
    };
    reader.onerror = function() { reject('Read error'); };
    reader.readAsText(file);
  });
}

function groupBySession(entries) {
  const RESET_TOLERANCE_MS = 10 * 60 * 1000;
  const TIME_TOLERANCE_MS = 5 * 60 * 1000;
  const grouped = [];

  entries.forEach(function(e) {
    const eReset = getResetTime(e);
    let placed = false;

    for (let i = 0; i < grouped.length; i++) {
      const g = grouped[i];

      if (eReset !== null) {
        const gResets = g.map(getResetTime).filter(function(r) { return r !== null; });
        if (gResets.length > 0) {
          const avgReset = gResets.reduce(function(a, b) { return a + b; }, 0) / gResets.length;
          if (Math.abs(eReset - avgReset) <= RESET_TOLERANCE_MS) {
            g.push(e);
            placed = true;
            break;
          }
          continue;
        }
      }

      const maxTs = Math.max.apply(null, g.map(function(x) { return x.ts; }));
      if (Math.abs(e.ts - maxTs) <= TIME_TOLERANCE_MS) {
        g.push(e);
        placed = true;
        break;
      }
    }

    if (!placed) {
      grouped.push([e]);
    }
  });

  return grouped
    .sort(function(a, b) {
      const aEndTs = Math.max.apply(null, a.map(function(e) { return e.ts; }));
      const bEndTs = Math.max.apply(null, b.map(function(e) { return e.ts; }));
      return aEndTs - bEndTs;
    })
    .map(function(sessionEntries) {
      const minTs = Math.min.apply(null, sessionEntries.map(function(e) { return e.ts; }));
      const maxTs = Math.max.apply(null, sessionEntries.map(function(e) { return e.ts; }));
      const lastEntry = sessionEntries[sessionEntries.length - 1];
      const resetTimeMs = lastEntry.sessionHoursLeft !== null
        ? lastEntry.ts + (lastEntry.sessionHoursLeft * 3600 * 1000)
        : maxTs;
      return {
        sessionId: sessionEntries[0].sessionId || 'unknown',
        entries: sessionEntries.sort(function(a, b) { return a.ts - b.ts; }),
        startTime: minTs,
        endTime: maxTs,
        resetTime: resetTimeMs,
        durationMs: maxTs - minTs
      };
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
