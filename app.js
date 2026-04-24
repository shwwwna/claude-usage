const CONFIG = {
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
  }).catch(function() {
  });
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
    try {
      const parsed = parseUsageText(last);
      if (parsed.errors.length) errorEl.textContent = parsed.errors.join('\n');
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
