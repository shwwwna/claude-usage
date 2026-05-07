let sessionExponent = 0.8;
let weeklyExponent  = 0.8;
let lastParsed = null;

function renderResults(parsed) {
  lastParsed = parsed;
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (parsed.session) {
    const stats = computeStats(SESSION_WINDOW_HOURS, parsed.session.hoursLeft, parsed.session.actualPct, sessionExponent);
    container.appendChild(buildCard('Session', parsed.session.actualPct, stats, SESSION_WINDOW_HOURS, parsed.session.hoursLeft, sessionExponent));
  }

  if (parsed.weekly) {
    const stats = computeStats(WEEKLY_WINDOW_HOURS, parsed.weekly.hoursLeft, parsed.weekly.actualPct, weeklyExponent);
    container.appendChild(buildCard('Weekly', parsed.weekly.actualPct, stats, WEEKLY_WINDOW_HOURS, parsed.weekly.hoursLeft, weeklyExponent, parsed.session));
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
  updateFeasibilityRow();
}

function updateFeasibilityRow() {
  const el = document.getElementById('weekly-feasibility-row');
  if (!el || !lastParsed || !lastParsed.weekly || !lastParsed.session) return;

  const actualPct = lastParsed.weekly.actualPct;
  const hoursLeft = lastParsed.weekly.hoursLeft;
  const weeklyRemaining = 100 - actualPct;
  const weeklyResetMs = Date.now() + hoursLeft * 3600 * 1000;
  const sessionStartMs = Date.now() - (SESSION_WINDOW_HOURS - lastParsed.session.hoursLeft) * 3600 * 1000;
  const awakeWindows = countAwakeWindows(weeklyResetMs, sessionStartMs);
  const reachableAdditional = awakeWindows * (SESSION_WINDOW_HOURS / WEEKLY_WINDOW_HOURS) * 100;
  const reachablePct = Math.min(100, actualPct + reachableAdditional);
  const constrained = reachableAdditional < weeklyRemaining - 5;

  el.innerHTML = '';
  if (!constrained) return;

  el.className = 'stat-row compact-meta-row';

  const feasCell = document.createElement('span');
  feasCell.className = 'compact-meta-cell';

  const feasLabel = document.createElement('span');
  feasLabel.className = 'stat-label';
  feasLabel.textContent = 'Reachable';

  const feasVal = document.createElement('span');
  feasVal.className = 'stat-value fraction-value';
  feasVal.innerHTML = '<span class="frac-actual">' + fmt(reachablePct) + '%</span><span class="frac-sep">/</span><span class="frac-target">100%</span>';

  feasCell.appendChild(feasLabel);
  feasCell.appendChild(feasVal);

  el.appendChild(feasCell);
}

function buildCard(label, actualPct, stats, totalHours, hoursLeft, exponent, sessionData) {
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

    const sessExplainer = document.createElement('div');
    sessExplainer.className = 'stat-explainer';
    sessExplainer.textContent = 'Full 5-hour sessions you can complete vs. total windows until reset';
    card.appendChild(sessExplainer);

    if (sessionData) {
      const feasPlaceholder = document.createElement('div');
      feasPlaceholder.id = 'weekly-feasibility-row';
      card.appendChild(feasPlaceholder);
    }
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

  if (label === 'Session') {
    const remaining = 1 - actualPct / 100;
    const models = [
      { name: 'Haiku',  count: Math.round(remaining * 150) },
      { name: 'Sonnet', count: Math.round(remaining * 45) },
      { name: 'Opus',   count: Math.round(remaining * 12) },
    ];

    const msgsBlock = document.createElement('div');
    msgsBlock.className = 'msgs-estimate-block';

    const msgsHeading = document.createElement('div');
    msgsHeading.className = 'stat-label';
    msgsHeading.textContent = 'Est. msgs left';
    msgsBlock.appendChild(msgsHeading);

    const msgsList = document.createElement('div');
    msgsList.className = 'msgs-estimate-list';

    models.forEach(function(m) {
      const row = document.createElement('div');
      row.className = 'msgs-estimate-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'msgs-model-name';
      nameEl.textContent = m.name;

      const countEl = document.createElement('span');
      countEl.className = 'msgs-model-count';
      countEl.textContent = m.count;

      row.appendChild(nameEl);
      row.appendChild(countEl);
      msgsList.appendChild(row);
    });

    msgsBlock.appendChild(msgsList);
    card.appendChild(msgsBlock);
  }

  card.appendChild(buildUnifiedBar(actualPct, targetPct, status));

  card.appendChild(buildLegend(totalHours, hoursLeft, exponent, actualPct));

  const pacingControl = document.createElement('div');
  pacingControl.className = 'flex items-center gap-3 text-muted3 mt-2';
  pacingControl.style.fontSize = '0.75rem';

  const pacingLabel = document.createElement('label');
  pacingLabel.style.minWidth = label === 'Session' ? '9rem' : '9rem';
  pacingLabel.textContent = label.toLowerCase() + ' pacing:';
  pacingControl.appendChild(pacingLabel);

  const pacingSlider = document.createElement('input');
  pacingSlider.type = 'range';
  pacingSlider.id = label === 'Session' ? 'session-exponent' : 'weekly-exponent';
  pacingSlider.min = '0';
  pacingSlider.max = '1';
  pacingSlider.step = '0.01';
  pacingSlider.value = exponent;
  pacingSlider.className = 'flex-1';
  pacingSlider.addEventListener('input', function() {
    const v = parseFloat(this.value);
    if (label === 'Session') {
      sessionExponent = v;
    } else {
      weeklyExponent = v;
    }
    const labelEl = document.getElementById(label === 'Session' ? 'session-exponent-label' : 'weekly-exponent-label');
    if (labelEl) labelEl.textContent = exponentToLabel(v);
    run({ skipAutoPace: true });
  });
  pacingControl.appendChild(pacingSlider);

  const pacingValueLabel = document.createElement('span');
  pacingValueLabel.id = label === 'Session' ? 'session-exponent-label' : 'weekly-exponent-label';
  pacingValueLabel.style.minWidth = '8rem';
  pacingValueLabel.style.color = '#a5b4fc';
  pacingValueLabel.textContent = exponentToLabel(exponent);
  pacingControl.appendChild(pacingValueLabel);

  card.appendChild(pacingControl);

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

  const e = Math.max(exponent, 0.05);

  const remainingMs = hoursLeft * 3600 * 1000;
  const resetMs = now + remainingMs;
  const curveNow = Math.pow(actualPct / 100, 1 / e);
  const curveEnd = 1;

  function fmtDateStr(date) {
    if (date.toDateString() === today) {
      const h = date.getHours();
      const min = date.getMinutes();
      const ampm = h >= 12 ? 'pm' : 'am';
      const h12 = h % 12 || 12;
      const mm = min < 10 ? '0' + min : min;
      return h12 + ':' + mm + ampm;
    } else {
      const h = date.getHours();
      const ampm = h >= 12 ? 'pm' : 'am';
      const h12 = h % 12 || 12;
      return DAYS[date.getDay()] + ' ' + h12 + ampm;
    }
  }

  // Pre-compute 80% and 90% hit times to extrapolate 100% linearly
  function computeHitMs(m) {
    const isPast = m <= actualPct;
    return isPast
      ? windowStartMs + Math.pow(m / 100, 1 / e) * totalMs
      : now + ((Math.pow(m / 100, 1 / e) - curveNow) / (curveEnd - curveNow)) * remainingMs;
  }
  const hit80Ms = computeHitMs(80);
  const hit90Ms = computeHitMs(90);
  const hit100MsExtrapolated = hit90Ms + (hit90Ms - hit80Ms);

  [10,20,30,40,50,60,70,80,90,100].forEach(function(m) {
    const isPast = m <= actualPct;
    const hitMs = m === 100
      ? (isPast ? computeHitMs(100) : hit100MsExtrapolated)
      : computeHitMs(m);
    const hitDate = new Date(hitMs);

    const item = document.createElement('div');
    item.className = 'bar-legend-item' + (isPast ? ' legend-past' : '');

    const pctEl = document.createElement('div');
    pctEl.className = 'bar-legend-pct';
    pctEl.textContent = m + '%';
    item.appendChild(pctEl);

    if (!isPast) {
      const dateEl = document.createElement('div');
      dateEl.className = 'bar-legend-date';
      dateEl.textContent = fmtDateStr(hitDate);
      item.appendChild(dateEl);

      const leftEl = document.createElement('div');
      leftEl.className = 'bar-legend-left';
      if (m === 100) {
        const diffMs = resetMs - hitMs;
        const totalMin = Math.max(0, Math.round(diffMs / 60000));
        const d = Math.floor(totalMin / 1440);
        const h = Math.floor((totalMin % 1440) / 60);
        const min = totalMin % 60;
        if (d > 0) leftEl.textContent = d + 'd ' + h + 'h earlier than reset';
        else if (h > 0) leftEl.textContent = h + 'h ' + min + 'm earlier than reset';
        else leftEl.textContent = min + 'm earlier than reset';
      } else {
        leftEl.textContent = fmtLeft(hitMs - now);
      }
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

  const titleRow = document.createElement('div');
  titleRow.className = 'card-title-row';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = 'Sleep & Windows';
  titleRow.appendChild(title);

  const chevron = document.createElement('span');
  chevron.className = 'card-chevron';
  chevron.textContent = '›';
  titleRow.appendChild(chevron);

  card.appendChild(titleRow);

  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';

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

  cardBody.appendChild(sleepRow);

  let windowsContainer = build5hrWindows(hoursLeft, resetMs, sessionStartMs);

  function updateWindows() {
    const newWindows = build5hrWindows(hoursLeft, resetMs, sessionStartMs);
    cardBody.replaceChild(newWindows, windowsContainer);
    windowsContainer = newWindows;
    updateFeasibilityRow();
  }

  startSelect.addEventListener('change', updateWindows);
  endSelect.addEventListener('change', updateWindows);

  cardBody.appendChild(windowsContainer);
  card.appendChild(cardBody);

  const SHOW_SLEEP_WINDOWS_KEY = 'claude-usage-show-sleep-windows-v2';
  const savedState = localStorage.getItem(SHOW_SLEEP_WINDOWS_KEY);
  const isExpanded = savedState !== '0';
  cardBody.style.display = isExpanded ? '' : 'none';
  if (isExpanded) chevron.classList.add('open');

  titleRow.style.cursor = 'pointer';
  titleRow.addEventListener('click', function() {
    const nowExpanded = cardBody.style.display !== 'none';
    cardBody.style.display = nowExpanded ? 'none' : '';
    chevron.classList.toggle('open');
    localStorage.setItem(SHOW_SLEEP_WINDOWS_KEY, nowExpanded ? '0' : '1');
  });

  return card;
}

function countAwakeWindows(resetMs, sessionStartMs) {
  const sleep = getSleepHours();
  const windowMs = SESSION_WINDOW_HOURS * 3600 * 1000;
  let cursor = sessionStartMs !== null ? sessionStartMs : Date.now();
  let count = 0;

  while (cursor < resetMs) {
    const windowStart = new Date(cursor);
    const windowEndRaw = new Date(Math.min(cursor + windowMs, resetMs));

    if (sleep && sleep.start !== sleep.end) {
      const sleepOnset = new Date(windowStart);
      sleepOnset.setHours(sleep.start, 0, 0, 0);
      if (sleepOnset <= windowStart) sleepOnset.setDate(sleepOnset.getDate() + 1);

      if (sleepOnset < windowEndRaw) {
        const wakeTime = new Date(sleepOnset);
        wakeTime.setHours(sleep.end, 0, 0, 0);
        if (wakeTime <= sleepOnset) wakeTime.setDate(wakeTime.getDate() + 1);
        cursor = wakeTime.getTime();
        continue;
      }
    }

    count++;
    cursor += windowMs;
  }

  return count;
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
    const windowEnd = new Date(Math.min(cursor + windowMs, resetMs));

    if (sleep && sleep.start !== sleep.end) {
      // Find when sleep starts after cursor
      const sleepOnset = new Date(windowStart);
      sleepOnset.setHours(sleep.start, 0, 0, 0);
      if (sleepOnset <= windowStart) sleepOnset.setDate(sleepOnset.getDate() + 1);

      // Check if sleep period falls within this window
      if (sleepOnset < windowEnd) {
        // This window crosses into sleep — split into awake part then sleep part

        // Awake portion before sleep
        if (sleepOnset > windowStart) {
          windows.push({ start: new Date(windowStart), end: new Date(sleepOnset), asleep: false });
        }

        // Sleep portion from sleep onset to wake time
        const wakeTime = new Date(sleepOnset);
        wakeTime.setHours(sleep.end, 0, 0, 0);
        if (wakeTime <= sleepOnset) wakeTime.setDate(wakeTime.getDate() + 1);

        // Sleep ends at wake time but window continues to windowEnd
        const sleepEnd = new Date(Math.min(wakeTime.getTime(), windowEnd));
        windows.push({ start: new Date(sleepOnset), end: sleepEnd, asleep: true });

        // Awake portion after sleep (if window extends past wake time)
        if (wakeTime < windowEnd) {
          windows.push({ start: new Date(wakeTime), end: new Date(windowEnd), asleep: false });
        }

        // Move to end of this window
        cursor = windowEnd.getTime();
        continue;
      }
    }

    windows.push({ start: new Date(windowStart), end: new Date(windowEnd), asleep: false });
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

  // Group windows by day
  const dayGroups = [];
  const dayMap = {};
  windows.forEach(function(w) {
    const dayKey = DAYS[w.start.getDay()];
    if (!dayMap[dayKey]) {
      dayMap[dayKey] = [];
      dayGroups.push({ day: dayKey, items: dayMap[dayKey] });
    }
    dayMap[dayKey].push(w);
  });

  const grid = document.createElement('div');
  grid.className = 'windows-grid';

  let awakeWindowCount = 0;
  dayGroups.forEach(function(group) {
    const col = document.createElement('div');
    col.className = 'windows-col';

    const dayEl = document.createElement('div');
    dayEl.className = 'windows-day';
    dayEl.textContent = group.day;
    col.appendChild(dayEl);

    group.items.forEach(function(w) {
      const item = document.createElement('div');
      item.className = 'windows-item' + (w.asleep ? ' windows-item-sleep' : '');

      const num = document.createElement('span');
      num.className = 'windows-num';
      if (w.asleep) {
        num.textContent = '';
      } else {
        awakeWindowCount++;
        num.textContent = awakeWindowCount + '.';
      }

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
      col.appendChild(item);
    });

    grid.appendChild(col);
  });

  container.appendChild(grid);
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

  const SHOW_SUGGESTION_KEY = 'claude-usage-show-suggestion';

  const toggle = document.createElement('button');
  toggle.className = 'card-toggle';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'card-title';
  titleSpan.textContent = 'Suggested Pacing';

  const chevron = document.createElement('span');
  chevron.className = 'card-chevron';
  chevron.textContent = '›';

  toggle.appendChild(titleSpan);
  toggle.appendChild(chevron);

  const items = document.createElement('div');
  items.className = 'suggestion-items';

  const isOpen = localStorage.getItem(SHOW_SUGGESTION_KEY) === '1';
  items.style.display = isOpen ? 'block' : 'none';
  if (isOpen) chevron.classList.add('open');

  toggle.addEventListener('click', function() {
    const visible = items.style.display !== 'none';
    items.style.display = visible ? 'none' : 'block';
    chevron.classList.toggle('open', !visible);
    localStorage.setItem(SHOW_SUGGESTION_KEY, visible ? '0' : '1');
  });

  suggestions.forEach(function(s) {
    const suggested = suggestPacing(s.actualPct);
    const reason = suggestReason(s.actualPct);
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

    const explainer = document.createElement('div');
    explainer.className = 'stat-explainer';
    explainer.textContent = reason;

    item.appendChild(label);
    item.appendChild(value);
    item.appendChild(explainer);
    if (shouldUpdate) item.appendChild(btn);

    items.appendChild(item);
  });

  const legendGrid = document.createElement('div');
  legendGrid.className = 'grid grid-cols-4 gap-4';
  legendGrid.style.marginTop = '0.5rem';

  [
    { name: 'Aggressive', sub: 'Use most of your quota early', bullets: ['Heavy usage planned for today/early in the week', 'Need fast iteration on urgent work', "Know you'll have lighter usage later"] },
    { name: 'Front-loaded', sub: 'Slightly skew toward early usage', bullets: ['Plan to work more early, taper off later', 'Natural daily/weekly rhythm with productivity peaks', 'Most common for balanced workflows (default)'] },
    { name: 'Slight Push', sub: 'Nearly even, slight preference for later', bullets: ['Want flexibility and steady usage throughout', 'No strong pattern of high or low periods', 'Prefer not to rush early on'] },
    { name: 'Conservative', sub: 'Spread usage evenly across the period', bullets: ['Uncertain about upcoming workload', 'Want maximum flexibility in usage timing', 'Prefer to save quota for later just in case'] },
  ].forEach(function(p) {
    const col = document.createElement('div');
    col.className = 'pacing-card';

    const nameEl = document.createElement('div');
    nameEl.className = 'text-indigo-light uppercase tracking-wide';
    nameEl.style.fontSize = '0.85rem';
    nameEl.textContent = p.name;
    col.appendChild(nameEl);

    const subEl = document.createElement('div');
    subEl.className = 'text-muted3 italic';
    subEl.style.fontSize = '0.75rem';
    subEl.textContent = p.sub;
    col.appendChild(subEl);

    const ul = document.createElement('ul');
    ul.style.cssText = 'font-size: 0.75rem; list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; color: #aaa;';
    p.bullets.forEach(function(b) {
      const li = document.createElement('li');
      li.textContent = b;
      ul.appendChild(li);
    });
    col.appendChild(ul);

    legendGrid.appendChild(col);
  });

  items.appendChild(legendGrid);

  container.appendChild(toggle);
  container.appendChild(items);
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

  container.appendChild(buildHistoryTable(entries));
  container.appendChild(buildHistoryButtons());
}


function buildHistoryTable(entries) {
  const sessions = groupBySession(entries);
  const recentSessions = sessions.slice(-5).reverse();

  const container = document.createElement('div');
  container.className = 'history-sessions-container';

  recentSessions.forEach(function(session) {
    const sessionDiv = document.createElement('div');
    sessionDiv.className = 'history-session';

    const sessionHeader = document.createElement('div');
    sessionHeader.className = 'session-header';

    const resetDate = new Date(session.resetTime);
    const recordedDurationMin = Math.round(session.durationMs / 60000);
    const recordedDurationHours = Math.floor(recordedDurationMin / 60);
    const recordedDurationMins = recordedDurationMin % 60;
    const recordedDurationStr = recordedDurationHours > 0
      ? recordedDurationHours + 'h ' + recordedDurationMins + 'm'
      : recordedDurationMins + 'm';

    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const month = resetDate.getMonth() + 1;
    const day = resetDate.getDate();
    const dayName = DAYS[resetDate.getDay()];
    const h = resetDate.getHours();
    const m = resetDate.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const mm = m < 10 ? '0' + m : m;
    const dateStr = month + '/' + day + ' ' + dayName + ' ' + h12 + ':' + mm + ' ' + ampm;

    const durationEl = document.createElement('span');
    durationEl.className = 'session-duration';
    durationEl.textContent = '(' + recordedDurationStr + ')';

    sessionHeader.innerHTML = '<span class="session-date">' + dateStr + '</span>';
    sessionHeader.appendChild(durationEl);
    sessionDiv.appendChild(sessionHeader);

    const table = document.createElement('table');
    table.className = 'history-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const th1 = document.createElement('th');
    th1.textContent = 'Time';
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
    session.entries.forEach(function(e) {
      const d = new Date(e.ts);
      const tr = document.createElement('tr');
      const tdTime = document.createElement('td');
      tdTime.textContent = d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
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
      tr.appendChild(tdTime);
      tr.appendChild(tdSession);
      tr.appendChild(tdWeekly);
      tr.appendChild(tdDelete);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    sessionDiv.appendChild(table);
    container.appendChild(sessionDiv);
  });

  return container;
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
