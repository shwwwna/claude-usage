let sessionExponent = 0.55;
let weeklyExponent  = 0.65;

function renderResults(parsed) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (parsed.session) {
    const stats = computeStats(SESSION_WINDOW_HOURS, parsed.session.hoursLeft, parsed.session.actualPct, sessionExponent);
    container.appendChild(buildCard('Session', parsed.session.actualPct, stats, SESSION_WINDOW_HOURS, parsed.session.hoursLeft));
  }

  if (parsed.weekly) {
    const stats = computeStats(WEEKLY_WINDOW_HOURS, parsed.weekly.hoursLeft, parsed.weekly.actualPct, weeklyExponent);
    container.appendChild(buildCard('Weekly', parsed.weekly.actualPct, stats, WEEKLY_WINDOW_HOURS, parsed.weekly.hoursLeft));
  }
}

function buildCard(label, actualPct, stats, totalHours, hoursLeft) {
  const { targetPct, diff, status } = stats;

  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = label;
  card.appendChild(title);

  card.appendChild(statRow('Actual used', fmt(actualPct) + '%'));
  card.appendChild(statRow('Target used', fmt(targetPct) + '%'));

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
  card.appendChild(statRow('Resets', resetLabel));

  const badgeClass = status === 'over' ? 'badge-over' : status === 'under' ? 'badge-under' : 'badge-on';
  const badgeText  = status === 'over' ? 'OVER' : status === 'under' ? 'UNDER' : 'ON TARGET';
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

  const bars = document.createElement('div');
  bars.className = 'bars';
  const TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  bars.appendChild(buildBar('Actual', actualPct, 'bar-actual' + (status === 'over' ? ' over-target' : '')));
  bars.appendChild(buildBar('Target', targetPct, 'bar-target', TICKS));
  card.appendChild(bars);

  card.appendChild(buildLegend(totalHours, hoursLeft));

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

function buildBar(label, pct, fillClass, ticks) {
  const wrap = document.createElement('div');
  wrap.className = 'bar-row';
  const lbl = document.createElement('div');
  lbl.className = 'bar-label';
  lbl.textContent = label;
  const track = document.createElement('div');
  track.className = 'bar-track';
  const fill = document.createElement('div');
  fill.className = 'bar-fill ' + fillClass;
  fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
  track.appendChild(fill);
  if (ticks) {
    ticks.forEach(function(t) {
      const tick = document.createElement('div');
      tick.className = 'bar-tick';
      tick.style.left = t + '%';
      track.appendChild(tick);
    });
  }
  wrap.appendChild(lbl);
  wrap.appendChild(track);
  return wrap;
}

function buildLegend(totalHours, hoursLeft) {
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

  [10,20,30,40,50,60,70,80,90,100].forEach(function(m) {
    const hitMs = windowStartMs + (m / 100) * totalMs;
    const hitDate = new Date(hitMs);
    const isPast = hitMs <= now;

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

function renderClock() {
  const el = document.getElementById('live-clock');
  if (!el) return;
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const d = new Date();
  const h = d.getHours();
  const min = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  const mm = min < 10 ? '0' + min : min;
  el.innerHTML = '<div class="clock-day">' + DAYS[d.getDay()] + '</div><div class="clock-time">' + h12 + ':' + mm + ampm + '</div>';
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
