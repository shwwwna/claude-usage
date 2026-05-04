const CONFIG = {
  DEBOUNCE_MS: 300
};

const SHOW_SESSION_KEY = 'claude-usage-show-session';
const SHOW_HISTORY_KEY = 'claude-usage-show-history';

let textarea;
let errorEl;
let debounceTimer;

function getElements() {
  if (!textarea) textarea = document.getElementById('input');
  if (!errorEl) errorEl = document.getElementById('error');
}

function applySuggestedPacing(parsed) {
  if (parsed.session) {
    const v = suggestPacing(parsed.session.actualPct);
    sessionExponent = v;
    const slider = document.getElementById('session-exponent');
    const label = document.getElementById('session-exponent-label');
    if (slider) slider.value = v.toFixed(2);
    if (label) label.textContent = exponentToLabel(v);
  }
  if (parsed.weekly) {
    const v = suggestPacing(parsed.weekly.actualPct);
    weeklyExponent = v;
    const slider = document.getElementById('weekly-exponent');
    const label = document.getElementById('weekly-exponent-label');
    if (slider) slider.value = v.toFixed(2);
    if (label) label.textContent = exponentToLabel(v);
  }
}

function run(options) {
  getElements();
  if (!textarea || !errorEl) return;
  const autoPace = !(options && options.skipAutoPace);
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
      if (autoPace) applySuggestedPacing(parsed);
      renderResults(parsed);
      renderSuggestion(parsed);

      if (parsed.session) {
        const now = Date.now();
        const elapsedHours = SESSION_WINDOW_HOURS - parsed.session.hoursLeft;
        const sessionStartMs = now - (elapsedHours * 3600 * 1000);
        const resetMs = now + parsed.session.hoursLeft * 3600 * 1000;
        saveSessionStartTime(sessionStartMs);
        scheduleSessionAlarm(resetMs);
      } else {
        // Clear session start time if no session data
        localStorage.removeItem('claude-usage-session-start-time');
      }

      if (parsed.session || parsed.weekly) {
        saveEntry({
          ts: Date.now(),
          sessionPct: parsed.session ? parsed.session.actualPct : null,
          weeklyPct: parsed.weekly ? parsed.weekly.actualPct : null,
          sessionHoursLeft: parsed.session ? parsed.session.hoursLeft : null,
          weeklyHoursLeft: parsed.weekly ? parsed.weekly.hoursLeft : null
        });
        saveLastInput(raw);
      }
      renderHistory(loadHistory());
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }, CONFIG.DEBOUNCE_MS);
}

function setSessionVisible(visible) {
  document.body.classList.toggle('session-hidden', !visible);
  const btn = document.getElementById('btn-toggle-session');
  if (btn) btn.textContent = visible ? 'Hide session calculation' : 'Show session calculation';
  localStorage.setItem(SHOW_SESSION_KEY, visible ? '1' : '0');
}

function updateAlarmButtonLabel() {
  const btn = document.getElementById('btn-alarm-toggle');
  if (!btn) return;
  btn.textContent = isAlarmEnabled() ? 'Alarm: on' : 'Alarm: off';
}

function exponentToLabel(v) {
  if (v <= 0.5)  return 'aggressive';
  if (v <= 0.65) return 'lighter usage later';
  if (v <= 0.8)  return 'measured';
  return 'conservative';
}

const SHOW_PRICING_KEY = 'claude-usage-show-pricing';
const SHOW_PRACTICES_KEY = 'claude-usage-show-practices';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/claude-usage/src/sw.js', { scope: '/claude-usage/' });
}

document.addEventListener('DOMContentLoaded', function() {
  getElements();

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

  document.getElementById('btn-paste').addEventListener('click', function() {
    navigator.clipboard.readText().then(function(text) {
      textarea.value = text;
      run();
    }).catch(function(err) {
      errorEl.textContent = 'Paste failed: ' + (err && err.message ? err.message : 'clipboard access denied');
    });
  });


  document.getElementById('btn-toggle-session').addEventListener('click', function() {
    setSessionVisible(document.body.classList.contains('session-hidden'));
  });

  document.getElementById('btn-alarm-toggle').addEventListener('click', function() {
    const next = !isAlarmEnabled();
    setAlarmEnabled(next);
    updateAlarmButtonLabel();
    if (next) {
      try {
        const raw = textarea.value;
        if (raw.trim()) {
          const parsed = parseUsageText(raw);
          if (parsed.session) {
            const resetMs = Date.now() + parsed.session.hoursLeft * 3600 * 1000;
            scheduleSessionAlarm(resetMs);
          }
        }
      } catch (e) {}
    }
  });


  document.getElementById('btn-practices-toggle').addEventListener('click', function() {
    const content = document.getElementById('practices-content');
    const chevron = document.querySelector('#btn-practices-toggle .card-chevron');
    const isVisible = content.style.display !== 'none';
    content.style.display = isVisible ? 'none' : 'block';
    chevron.classList.toggle('open', !isVisible);
    localStorage.setItem(SHOW_PRACTICES_KEY, isVisible ? '0' : '1');
  });

  document.getElementById('btn-pricing-toggle').addEventListener('click', function() {
    const content = document.getElementById('pricing-content');
    const chevron = document.querySelector('#btn-pricing-toggle .card-chevron');
    const isVisible = content.style.display !== 'none';
    content.style.display = isVisible ? 'none' : 'block';
    chevron.classList.toggle('open', !isVisible);
    localStorage.setItem(SHOW_PRICING_KEY, isVisible ? '0' : '1');
  });

  document.getElementById('btn-history-toggle').addEventListener('click', function() {
    const panel = document.getElementById('history-panel');
    const chevron = document.getElementById('history-chevron');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    chevron.classList.toggle('open', !isVisible);
    localStorage.setItem(SHOW_HISTORY_KEY, isVisible ? '0' : '1');
  });

  const stored = localStorage.getItem(SHOW_SESSION_KEY);
  setSessionVisible(stored === '1');
  updateAlarmButtonLabel();

  const pricingStored = localStorage.getItem(SHOW_PRICING_KEY);
  if (pricingStored === '1') {
    document.getElementById('pricing-content').style.display = 'block';
    document.querySelector('#btn-pricing-toggle .card-chevron').classList.add('open');
  }

  const practicesStored = localStorage.getItem(SHOW_PRACTICES_KEY);
  if (practicesStored === '1') {
    document.getElementById('practices-content').style.display = 'block';
    document.querySelector('#btn-practices-toggle .card-chevron').classList.add('open');
  }

  const historyStored = localStorage.getItem(SHOW_HISTORY_KEY);
  if (historyStored === '1') {
    document.getElementById('history-panel').style.display = 'block';
    document.getElementById('history-chevron').classList.add('open');
  }

  const last = loadLastInput();
  if (last) {
    textarea.value = last;
    try {
      const parsed = parseUsageText(last);
      if (parsed.errors.length) errorEl.textContent = parsed.errors.join('\n');
      applySuggestedPacing(parsed);
      renderResults(parsed);
      renderSuggestion(parsed);
      if (parsed.session) {
        const resetMs = Date.now() + parsed.session.hoursLeft * 3600 * 1000;
        scheduleSessionAlarm(resetMs);
      }
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
    }
    renderHistory(loadHistory());
  } else {
    renderHistory(loadHistory());
  }
});
