const SAMPLE = [
  'Current session',
  'Resets in 1 hr 30 min',
  '74% used',
  'Weekly limits',
  'All models',
  'Resets Fri 5:59 AM',
  '65% used',
].join('\n');

const textarea = document.getElementById('input');
const errorEl  = document.getElementById('error');

function run() {
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
  } catch (err) {
    errorEl.textContent = err;
  }
}

textarea.addEventListener('input', run);

document.getElementById('btn-sample').addEventListener('click', function() {
  textarea.value = SAMPLE;
  run();
});

document.getElementById('btn-clear').addEventListener('click', function() {
  textarea.value = '';
  errorEl.textContent = '';
  document.getElementById('results').innerHTML = '';
});

document.getElementById('btn-open-usage').addEventListener('click', function() {
  if (navigator.windowControlsOverlay) {
    window.open('https://claude.ai/settings/usage', 'claude-usage-window', 'popup');
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

renderClock();
setInterval(renderClock, 1000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
