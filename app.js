const CONFIG = {
  DEBOUNCE_MS: 300
};

const SHOW_SESSION_KEY = 'claude-usage-show-session';

const textarea = document.getElementById('input');
const errorEl  = document.getElementById('error');

let debounceTimer;

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
      errorEl.textContent = err instanceof Error ? err.message : String(err);
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

document.getElementById('btn-paste').addEventListener('click', function() {
  navigator.clipboard.readText().then(function(text) {
    textarea.value = text;
    run();
  }).catch(function(err) {
    errorEl.textContent = 'Paste failed: ' + (err && err.message ? err.message : 'clipboard access denied');
  });
});

function setSessionVisible(visible) {
  document.body.classList.toggle('session-hidden', !visible);
  const btn = document.getElementById('btn-toggle-session');
  if (btn) btn.textContent = visible ? 'Hide session calculation' : 'Show session calculation';
  localStorage.setItem(SHOW_SESSION_KEY, visible ? '1' : '0');
}

document.getElementById('btn-toggle-session').addEventListener('click', function() {
  setSessionVisible(document.body.classList.contains('session-hidden'));
});

function exponentToLabel(v) {
  if (v <= 0.5)  return 'aggressive';
  if (v <= 0.65) return 'lighter usage later';
  if (v <= 0.8)  return 'measured';
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
    run({ skipAutoPace: true });
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

document.addEventListener('DOMContentLoaded', function() {
  const stored = localStorage.getItem(SHOW_SESSION_KEY);
  setSessionVisible(stored === '1');

  const last = loadLastInput();
  if (last) {
    textarea.value = last;
    try {
      const parsed = parseUsageText(last);
      if (parsed.errors.length) errorEl.textContent = parsed.errors.join('\n');
      applySuggestedPacing(parsed);
      renderResults(parsed);
      renderSuggestion(parsed);
      if (parsed.session || parsed.weekly) renderHistory(loadHistory());
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
    }
  } else {
    renderHistory(loadHistory());
  }
});
