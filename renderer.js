let sessionExponent = 0.8;
let weeklyExponent  = 0.8;

function renderResults(parsed) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (parsed.session) {
    const stats = computeStats(SESSION_WINDOW_HOURS, parsed.session.hoursLeft, parsed.session.actualPct, sessionExponent);
    container.appendChild(buildCard('Session', parsed.session.actualPct, stats, SESSION_WINDOW_HOURS, parsed.session.hoursLeft, sessionExponent));
  }

  if (parsed.weekly) {
    const stats = computeStats(WEEKLY_WINDOW_HOURS, parsed.weekly.hoursLeft, parsed.weekly.actualPct, weeklyExponent);
    container.appendChild(buildCard('Weekly', parsed.weekly.actualPct, stats, WEEKLY_WINDOW_HOURS, parsed.weekly.hoursLeft, weeklyExponent));
  }

  const resetMs = parsed.weekly ? Date.now() + parsed.weekly.hoursLeft * 3600 * 1000 : Date.now() + 24 * 3600 * 1000;
  const hoursLeft = parsed.weekly ? parsed.weekly.hoursLeft : 24;
  let sessionStartMs = loadSessionStartTime();
  // If no saved session start, calculate from current session data
  if (!sessionStartMs && parsed.session) {
    const now = Date.now();
    sessionStartMs = now - (SESSION_WINDOW_HOURS - parsed.session.hoursLeft) * 3600 * 1000;
  }
  container.appendChild(buildSleepAndWindowsCard(hoursLeft, resetMs, sessionStartMs));
}

function buildCard(label, actualPct, stats, totalHours, hoursLeft, exponent) {
  const { targetPct, diff, status } = stats;

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.type = label.toLowerCase();

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = label;
  card.appendChild(title);

  const resetMs = Date.now() + hoursLeft * 3600 * 1000;
  const resetDate = new Date(resetMs);
  const DAYS_R = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const rh = resetDate.getHours(), rm = resetDate.getMinutes();
  const rampm = rh >= 12 ? 'pm' : 'am';
  const rh12 = rh % 12 || 12;
  const rmm = rm < 10 ? '0' + rm : rm;
  const resetLabel = resetDate.toDateString() === new Date().toDateString()
    ? 'today ' + rh12 + ':' + rmm + rampm
    : DAYS_R[resetDate.getDay()] + ' ' + rh12 + ':' + rmm + rampm;

  const compactRow = document.createElement('div');
  compactRow.className = 'stat-row compact-meta-row';

  const usageCell = document.createElement('span');
  usageCell.className = 'compact-meta-cell';
  const usageLabel = document.createElement('span');
  usageLabel.className = 'stat-label';
  usageLabel.textContent = 'Used';
  const usageFrac = document.createElement('span');
  usageFrac.className = 'stat-value fraction-value';
  usageFrac.innerHTML = '<span class="frac-actual">' + fmt(actualPct) + '%</span><span class="frac-sep">/</span><span class="frac-target">' + fmt(targetPct) + '%</span>';
  usageCell.appendChild(usageLabel);
  usageCell.appendChild(usageFrac);

  const resetCell = document.createElement('span');
  resetCell.className = 'compact-meta-cell';
  const resetLabel2 = document.createElement('span');
  resetLabel2.className = 'stat-label';
  resetLabel2.textContent = 'Resets';
  const resetVal = document.createElement('span');
  resetVal.className = 'stat-value';
  resetVal.textContent = resetLabel;
  resetCell.appendChild(resetLabel2);
  resetCell.appendChild(resetVal);

  compactRow.appendChild(usageCell);
  compactRow.appendChild(resetCell);
  card.appendChild(compactRow);

  if (label === 'Weekly') {
    const fullSessionsRemaining = Math.max(0, (100 - actualPct) * WEEKLY_WINDOW_HOURS / SESSION_WINDOW_HOURS / 100);
    const windowsUntilReset = hoursLeft / SESSION_WINDOW_HOURS;

    const weeklyCompactRow = document.createElement('div');
    weeklyCompactRow.className = 'stat-row compact-meta-row';

    const sessCell = document.createElement('span');
    sessCell.className = 'compact-meta-cell';
    const sessLabel = document.createElement('span');
    sessLabel.className = 'stat-label';
    sessLabel.textContent = 'Sessions left';
    const sessFrac = document.createElement('span');
    sessFrac.className = 'stat-value fraction-value';
    sessFrac.innerHTML = '<span class="frac-actual">' + fmt(fullSessionsRemaining) + '</span><span class="frac-sep">/</span><span class="frac-target">' + fmt(windowsUntilReset) + '</span>';
    sessCell.appendChild(sessLabel);
    sessCell.appendChild(sessFrac);

    weeklyCompactRow.appendChild(sessCell);
    card.appendChild(weeklyCompactRow);
  }

  const badgeClass = status === 'over' ? 'badge-over' : status === 'under' ? 'badge-under' : 'badge-on';
  const badgeText  = status === 'over'  ? 'OVER, USE SLOWER'
                   : status === 'under' ? 'UNDER, USE FASTER'
                                        : 'ON TARGET, MAINTAIN THE PACE';
  const diffClass  = status === 'over' ? 'diff-over' : status === 'under' ? 'diff-under' : 'diff-on';
  const sign       = diff > 0 ? '+' : '';

  const statusRow = document.createElement('div');
  statusRow.className = 'stat-row';

  const lhs = document.createElement('span');
  lhs.innerHTML = '<span class="badge ' + badgeClass + '">' + badgeText + '</span>';

  const rhs = document.createElement('span');
  rhs.className = 'stat-value diff-value ' + diffClass;
  rhs.textContent = sign + fmt(diff) + ' pp';

  statusRow.appendChild(lhs);
  statusRow.appendChild(rhs);
  card.appendChild(statusRow);

  card.appendChild(buildUnifiedBar(actualPct, targetPct, status));

  card.appendChild(buildLegend(totalHours, hoursLeft, exponent, actualPct));

  return card;
}

function statRow(label, value) {
  const row = document.createElement('div');
  row.className = 'stat-row';
  const l = document.createElement('span');
  l.className = 'stat-label';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'stat-value';
  v.textContent = value;
  row.appendChild(l);
  row.appendChild(v);
  return row;
}

function buildUnifiedBar(actualPct, targetPct, status) {
  const clamp = function(n) { return Math.min(100, Math.max(0, n)); };
  const actualClamped = clamp(actualPct);
  const targetClamped = clamp(targetPct);
  const statusClass = 'status-' + status;

  const track = document.createElement('div');
  track.className = 'bar-track unified';

  const targetFill = document.createElement('div');
  targetFill.className = 'bar-target-fill';
  targetFill.style.width = targetClamped + '%';
  track.appendChild(targetFill);

  const actualFill = document.createElement('div');
  actualFill.className = 'bar-actual-fill ' + statusClass;
  actualFill.style.width = actualClamped + '%';
  track.appendChild(actualFill);

  [10, 20, 30, 40, 50, 60, 70, 80, 90].forEach(function(t) {
    const tick = document.createElement('div');
    tick.className = 'bar-tick';
    tick.style.left = t + '%';
    track.appendChild(tick);
  });

  const targetMarker = document.createElement('div');
  targetMarker.className = 'bar-target-marker';
  targetMarker.style.left = targetClamped + '%';
  track.appendChild(targetMarker);

  const dot = document.createElement('div');
  dot.className = 'bar-endpoint-dot ' + statusClass;
  dot.style.left = actualClamped + '%';
  track.appendChild(dot);

  return track;
}

function buildLegend(totalHours, hoursLeft, exponent, actualPct) {
  const now = Date.now();
  const elapsedMs = (totalHours - hoursLeft) * 3600 * 1000;
  const windowStartMs = now - elapsedMs;
  const totalMs = totalHours * 3600 * 1000;
  const today = new Date().toDateString();
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function fmtLeft(ms) {
    const totalMin = Math.max(0, Math.round(ms / 60000));
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return d + 'd ' + h + 'h left';
    if (h > 0) return h + 'h ' + m + 'm left';
    return m + 'm left';
  }

  const legend = document.createElement('div');
  legend.className = 'bar-legend';

  const e = exponent > 0 ? exponent : 1;

  const remainingMs = hoursLeft * 3600 * 1000;
  const curveNow = Math.pow(actualPct / 100, 1 / e);
  const curveEnd = 1;

  [10,20,30,40,50,60,70,80,90,100].forEach(function(m) {
    const isPast = m <= actualPct;
    const hitMs = isPast
      ? windowStartMs + Math.pow(m / 100, 1 / e) * totalMs
      : now + ((Math.pow(m / 100, 1 / e) - curveNow) / (curveEnd - curveNow)) * remainingMs;
    const hitDate = new Date(hitMs);

    const item = document.createElement('div');
    item.className = 'bar-legend-item' + (isPast ? ' legend-past' : '');

    const pctEl = document.createElement('div');
    pctEl.className = 'bar-legend-pct';
    pctEl.textContent = m + '%';
    item.appendChild(pctEl);

    if (!isPast) {
      let dateStr;
      if (hitDate.toDateString() === today) {
        const h = hitDate.getHours();
        const min = hitDate.getMinutes();
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h % 12 || 12;
        const mm = min < 10 ? '0' + min : min;
        dateStr = h12 + ':' + mm + ampm;
      } else {
        const h = hitDate.getHours();
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h % 12 || 12;
        dateStr = DAYS[hitDate.getDay()] + ' ' + h12 + ampm;
      }

      const dateEl = document.createElement('div');
      dateEl.className = 'bar-legend-date';
      dateEl.textContent = dateStr;
      item.appendChild(dateEl);

      const leftEl = document.createElement('div');
      leftEl.className = 'bar-legend-left';
      leftEl.textContent = fmtLeft(hitMs - now);
      item.appendChild(leftEl);
    }

    legend.appendChild(item);
  });

  return legend;
}

function getSleepHours() {
  const input = document.getElementById('sleep-start');
  const input2 = document.getElementById('sleep-end');
  if (!input || !input2) return { start: 22, end: 7 };
  const s = parseInt(input.value, 10);
  const e = parseInt(input2.value, 10);
  if (isNaN(s) || isNaN(e)) return { start: 22, end: 7 };
  return { start: s, end: e };
}

function isWindowAsleep(windowStartHour, windowEndHour, sleepStart, sleepEnd) {
  if (sleepStart === sleepEnd) return false;
  // Normalize to check overlap. Sleep may wrap midnight.
  // windowStartHour/windowEndHour are in [0,24)
  function hoursOverlap(ws, we, ss, se) {
    // expand to [0, 48) if sleep wraps midnight
    if (ss < se) {
      return we > ss && ws < se;
    } else {
      // wraps: ss..24 and 0..se
      return we > ss || ws < se;
    }
  }
  return hoursOverlap(windowStartHour, windowEndHour, sleepStart, sleepEnd);
}

function fmtTime(date) {
  const h = date.getHours(), m = date.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? h12 + ampm : h12 + ':' + (m < 10 ? '0' + m : m) + ampm;
}

function buildSleepAndWindowsCard(hoursLeft, resetMs, sessionStartMs) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.type = 'sleep-windows';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = 'Sleep & Windows';
  card.appendChild(title);

  const sleepRow = document.createElement('div');
  sleepRow.className = 'sleep-row';

  const label = document.createElement('label');
  label.className = 'sleep-label';
  label.textContent = 'Sleep hours:';
  sleepRow.appendChild(label);

  const startSelect = document.createElement('select');
  startSelect.id = 'sleep-start';
  startSelect.className = 'sleep-select';
  for (let i = 0; i < 24; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    const h = i % 12 || 12;
    const ampm = i >= 12 ? 'pm' : 'am';
    opt.textContent = h + ampm;
    if (i === 22) opt.selected = true;
    startSelect.appendChild(opt);
  }
  sleepRow.appendChild(startSelect);

  const sep = document.createElement('span');
  sep.className = 'sleep-sep';
  sep.textContent = '–';
  sleepRow.appendChild(sep);

  const endSelect = document.createElement('select');
  endSelect.id = 'sleep-end';
  endSelect.className = 'sleep-select';
  for (let i = 0; i < 24; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    const h = i % 12 || 12;
    const ampm = i >= 12 ? 'pm' : 'am';
    opt.textContent = h + ampm;
    if (i === 7) opt.selected = true;
    endSelect.appendChild(opt);
  }
  sleepRow.appendChild(endSelect);

  card.appendChild(sleepRow);

  let windowsContainer = build5hrWindows(hoursLeft, resetMs, sessionStartMs);

  function updateWindows() {
    const newWindows = build5hrWindows(hoursLeft, resetMs, sessionStartMs);
    card.replaceChild(newWindows, windowsContainer);
    windowsContainer = newWindows;
  }

  startSelect.addEventListener('change', updateWindows);
  endSelect.addEventListener('change', updateWindows);

  card.appendChild(windowsContainer);

  return card;
}

function build5hrWindows(hoursLeft, resetMs, sessionStartMs) {
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const sleep = getSleepHours();

  // Build list of windows from session start to reset
  const windows = [];
  const windowMs = SESSION_WINDOW_HOURS * 3600 * 1000;
  let cursor = sessionStartMs !== null ? sessionStartMs : Date.now();

  while (cursor < resetMs) {
    const windowStart = new Date(cursor);
    const windowEndRaw = new Date(Math.min(cursor + windowMs, resetMs));

    if (sleep && sleep.start !== sleep.end) {
      // Find when sleep starts after cursor
      const sleepOnset = new Date(windowStart);
      sleepOnset.setHours(sleep.start, 0, 0, 0);
      if (sleepOnset <= windowStart) sleepOnset.setDate(sleepOnset.getDate() + 1);

      if (sleepOnset < windowEndRaw) {
        // This block crosses into sleep — split into awake part then sleep part

        // Awake portion before sleep
        if (sleepOnset > windowStart) {
          windows.push({ start: new Date(windowStart), end: new Date(sleepOnset), asleep: false });
        }

        // Sleep portion from sleep onset to wake time
        const wakeTime = new Date(sleepOnset);
        wakeTime.setHours(sleep.end, 0, 0, 0);
        if (wakeTime <= sleepOnset) wakeTime.setDate(wakeTime.getDate() + 1);

        const sleepEnd = new Date(Math.min(wakeTime.getTime(), resetMs));
        windows.push({ start: new Date(sleepOnset), end: sleepEnd, asleep: true });

        // Resume from wake time
        cursor = wakeTime.getTime();
        continue;
      }
    }

    windows.push({ start: new Date(windowStart), end: new Date(windowEndRaw), asleep: false });
    cursor += windowMs;
  }

  const container = document.createElement('div');
  container.className = 'windows-list';

  const header = document.createElement('div');
  header.className = 'windows-header';

  const headerLeft = document.createElement('span');
  headerLeft.className = 'stat-label';
  headerLeft.textContent = '5-hr windows until reset';

  const totalHoursEl = document.createElement('span');
  totalHoursEl.className = 'windows-total';
  totalHoursEl.textContent = 'total ~' + (windows.length * SESSION_WINDOW_HOURS) + ' hrs';

  header.appendChild(headerLeft);
  header.appendChild(totalHoursEl);
  container.appendChild(header);

  const list = document.createElement('div');
  list.className = 'windows-items';

  let currentDay = null;
  windows.forEach(function(w, i) {
    const dayKey = DAYS[w.start.getDay()];
    if (dayKey !== currentDay) {
      currentDay = dayKey;
      const dayEl = document.createElement('div');
      dayEl.className = 'windows-day';
      dayEl.textContent = dayKey;
      list.appendChild(dayEl);
    }

    const item = document.createElement('div');
    item.className = 'windows-item' + (w.asleep ? ' windows-item-sleep' : '');

    const num = document.createElement('span');
    num.className = 'windows-num';
    num.textContent = (i + 1) + '.';

    const durationMs = w.end.getTime() - w.start.getTime();
    const durationHours = Math.round(durationMs / (3600 * 1000));

    const range = document.createElement('span');
    range.className = 'windows-range';
    range.textContent = fmtTime(w.start) + '–' + fmtTime(w.end);

    if (durationHours !== 5) {
      const durationSpan = document.createElement('span');
      durationSpan.className = 'windows-duration';
      durationSpan.textContent = ' (' + durationHours + 'h)';
      range.appendChild(durationSpan);
    }

    item.appendChild(num);
    item.appendChild(range);
    list.appendChild(item);
  });

  container.appendChild(list);
  return container;
}

function fmt(n) { return n.toFixed(1); }

function renderSuggestion(parsed) {
  const container = document.getElementById('suggestion');
  container.innerHTML = '';

  const suggestions = [];
  if (parsed.session) suggestions.push({
    key: 'session-exponent',
    type: 'Session',
    actualPct: parsed.session.actualPct
  });
  if (parsed.weekly) suggestions.push({
    key: 'weekly-exponent',
    type: 'Weekly',
    actualPct: parsed.weekly.actualPct
  });

  if (!suggestions.length) return;

  const section = document.createElement('div');
  section.className = 'suggestion-section';

  const heading = document.createElement('div');
  heading.className = 'suggestion-heading';
  heading.innerHTML = '💡 Suggested Pacing';
  section.appendChild(heading);

  const items = document.createElement('div');
  items.className = 'suggestion-items';

  suggestions.forEach(function(s) {
    const suggested = suggestPacing(s.actualPct);
    const current = s.key === 'session-exponent' ? sessionExponent : weeklyExponent;
    const shouldUpdate = Math.abs(suggested - current) > 0.05;

    const item = document.createElement('div');
    item.className = 'suggestion-item' + (shouldUpdate ? ' suggestion-update' : '');
    item.dataset.type = s.type.toLowerCase();

    const label = document.createElement('span');
    label.className = 'suggestion-label';
    label.textContent = s.type + ' (' + fmt(s.actualPct) + '% used)';

    const value = document.createElement('span');
    value.className = 'suggestion-value';
    value.textContent = exponentToLabel(suggested).charAt(0).toUpperCase() + exponentToLabel(suggested).slice(1);

    const btn = document.createElement('button');
    btn.className = 'suggestion-btn';
    btn.textContent = 'Apply';
    btn.addEventListener('click', function() {
      const slider = document.getElementById(s.key);
      slider.value = suggested.toFixed(2);
      if (s.key === 'session-exponent') sessionExponent = suggested;
      else weeklyExponent = suggested;
      document.getElementById(s.key + '-label').textContent = exponentToLabel(suggested);
      run();
    });

    item.appendChild(label);
    item.appendChild(value);
    if (shouldUpdate) item.appendChild(btn);

    items.appendChild(item);
  });

  section.appendChild(items);
  container.appendChild(section);
}

function renderHistory(entries) {
  const container = document.getElementById('history-panel');
  if (!container) return;
  container.innerHTML = '';
  if (!entries.length) {
    container.innerHTML = '<p class="history-empty">No history yet. Paste usage data above to start tracking.</p>';
    return;
  }

  const title = document.createElement('div');
  title.className = 'history-title';
  title.textContent = 'Usage History';
  container.appendChild(title);

  const analysis = analyzeHistory(entries);
  const analysisEl = document.createElement('div');
  analysisEl.className = 'history-analysis';

  const parts = [];
  if (analysis.sessionAvg7d != null) parts.push('session ' + fmt(analysis.sessionAvg7d) + '% (' + analysis.sessionTrend + ')');
  if (analysis.weeklyAvg7d != null) parts.push('weekly ' + fmt(analysis.weeklyAvg7d) + '% (' + analysis.weeklyTrend + ')');
  analysisEl.textContent = parts.length ? '7-day avg: ' + parts.join(', ') : '';
  container.appendChild(analysisEl);

  container.appendChild(buildChart(entries));
  container.appendChild(buildHistoryTable(entries));
  container.appendChild(buildHistoryButtons());
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
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const th1 = document.createElement('th');
  th1.textContent = 'Date/Time';
  const th2 = document.createElement('th');
  th2.textContent = 'Session %';
  const th3 = document.createElement('th');
  th3.textContent = 'Weekly %';
  const th4 = document.createElement('th');
  th4.textContent = '';
  headerRow.appendChild(th1);
  headerRow.appendChild(th2);
  headerRow.appendChild(th3);
  headerRow.appendChild(th4);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  recent.forEach(function(e) {
    const d = new Date(e.ts);
    const tr = document.createElement('tr');
    const tdDate = document.createElement('td');
    tdDate.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const tdSession = document.createElement('td');
    tdSession.textContent = e.sessionPct != null ? fmt(e.sessionPct) + '%' : '—';
    const tdWeekly = document.createElement('td');
    tdWeekly.textContent = e.weeklyPct != null ? fmt(e.weeklyPct) + '%' : '—';
    const tdDelete = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-history-delete';
    delBtn.textContent = '×';
    delBtn.title = 'Delete entry';
    delBtn.addEventListener('click', function() {
      deleteEntry(e.ts);
      renderHistory(loadHistory());
    });
    tdDelete.appendChild(delBtn);
    tr.appendChild(tdDate);
    tr.appendChild(tdSession);
    tr.appendChild(tdWeekly);
    tr.appendChild(tdDelete);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

let _fileInput = null;

function buildHistoryButtons() {
  const row = document.createElement('div');
  row.className = 'history-btn-row';

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export JSON';
  exportBtn.className = 'btn-history';
  exportBtn.addEventListener('click', exportJSON);

  if (!_fileInput) {
    _fileInput = document.createElement('input');
    _fileInput.type = 'file';
    _fileInput.accept = '.json';
    _fileInput.style.display = 'none';
    _fileInput.addEventListener('change', function() {
      if (!_fileInput.files[0]) return;
      importJSON(_fileInput.files[0]).then(function(merged) {
        renderHistory(merged);
      });
      _fileInput.value = '';
    });
    document.body.appendChild(_fileInput);
  }

  const importBtn = document.createElement('button');
  importBtn.textContent = 'Import JSON';
  importBtn.className = 'btn-history';
  importBtn.addEventListener('click', function() { _fileInput.click(); });

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
  row.appendChild(clearBtn);
  return row;
}
