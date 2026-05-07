let messageListener = null;

document.addEventListener('DOMContentLoaded', async () => {
  const cachedData = await getCachedData();
  if (cachedData) {
    processText(cachedData.text);
    showLastUpdated(cachedData.timestamp);
  }

  const tabs = await chrome.tabs.query({ url: 'https://claude.ai/settings/usage' });
  const usageTab = tabs.length > 0 ? tabs[0] : null;

  if (usageTab) {
    document.getElementById('status-bar').style.display = 'flex';
    document.getElementById('btn-refresh').addEventListener('click', () => {
      chrome.scripting.executeScript({ target: { tabId: usageTab.id }, files: ['content.js'] });
    });

    await chrome.scripting.executeScript({ target: { tabId: usageTab.id }, files: ['content.js'] });

    if (messageListener) chrome.runtime.onMessage.removeListener(messageListener);
    messageListener = ({ type, text, reason }) => {
      if (type === 'USAGE_TEXT') {
        processText(text);
        cacheData(text);
        showLastUpdated(Date.now());
        document.getElementById('error').style.display = 'none';
      } else if (type === 'USAGE_ERROR') {
        if (!cachedData) showError(`Could not read usage data: ${reason}`);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
  } else if (!cachedData) {
    showOpenPagePrompt();
  }
});

async function getCachedData() {
  try {
    const result = await chrome.storage.local.get(['cachedText', 'cachedAt']);
    if (result.cachedText && result.cachedAt) {
      return { text: result.cachedText, timestamp: result.cachedAt };
    }
  } catch (e) {}
  return null;
}

async function cacheData(text) {
  await chrome.storage.local.set({ cachedText: text, cachedAt: Date.now() });
}

function processText(text) {
  try {
    const parsed = parseUsageText(text);
    renderResults(parsed);
    renderSuggestion(parsed);
  } catch (err) {
    showError(err);
  }
}

function showLastUpdated(timestamp) {
  const now = Date.now();
  const elapsed = Math.round((now - timestamp) / 60000);
  const timeStr = elapsed === 0 ? 'just now' : elapsed + ' min ago';
  document.getElementById('last-updated').textContent = 'Last updated: ' + timeStr;
}

function showError(err) {
  const errorEl = document.getElementById('error');
  errorEl.textContent = err;
  errorEl.style.display = 'block';
}

function showOpenPagePrompt() {
  document.getElementById('open-prompt').style.display = 'block';
  document.getElementById('results').innerHTML = '';
  document.getElementById('suggestion').style.display = 'none';
}

function renderResults(parsed) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (parsed.session) {
    const stats = computeStats(5, parsed.session.hoursLeft, parsed.session.actualPct, 0.8);
    container.appendChild(buildCard('Session', parsed.session.actualPct, stats, 5, parsed.session.hoursLeft, 0.8));
  }

  if (parsed.weekly) {
    const stats = computeStats(168, parsed.weekly.hoursLeft, parsed.weekly.actualPct, 0.8);
    container.appendChild(buildCard('Weekly', parsed.weekly.actualPct, stats, 168, parsed.weekly.hoursLeft, 0.8, parsed.session));
  }
}

function renderSuggestion(parsed) {
  const suggestionEl = document.getElementById('suggestion');
  if (!parsed.session || !parsed.weekly) {
    suggestionEl.style.display = 'none';
    return;
  }

  const sessionPct = parsed.session.actualPct;
  const weeklyPct = parsed.weekly.actualPct;
  const avgPct = (sessionPct + weeklyPct) / 2;

  let suggestion = 'Usage is balanced';
  if (avgPct > 85) suggestion = "You're nearly out — slow down.";
  else if (avgPct > 75) suggestion = "You've used a lot — ease off.";
  else if (avgPct > 60) suggestion = "Slightly heavy — gentle slowdown.";
  else if (avgPct > 45) suggestion = "Balanced — mild front-load is fine.";
  else suggestion = "You have plenty — safe to use more early.";

  const div = document.createElement('div');
  div.className = 'stat-row';
  div.innerHTML = '<span class="stat-label">Suggestion</span><span class="stat-value" style="color: #86efac;">' + suggestion + '</span>';
  suggestionEl.innerHTML = '';
  suggestionEl.appendChild(div);
  suggestionEl.style.display = 'block';
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
  const DAYS_R = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
  usageFrac.innerHTML = '<span class="frac-actual">' + actualPct.toFixed(1) + '%</span><span class="frac-sep">/</span><span class="frac-target">100%</span>';
  usageCell.appendChild(usageLabel);
  usageCell.appendChild(usageFrac);
  compactRow.appendChild(usageCell);

  const badge = document.createElement('span');
  badge.className = 'badge badge-' + status;
  badge.textContent = status.toUpperCase();
  compactRow.appendChild(badge);

  card.appendChild(compactRow);

  const targetRow = document.createElement('div');
  targetRow.className = 'stat-row compact-meta-row';
  const targetCell = document.createElement('span');
  targetCell.className = 'compact-meta-cell';
  const targetLabel = document.createElement('span');
  targetLabel.className = 'stat-label';
  targetLabel.textContent = 'Target';
  const targetVal = document.createElement('span');
  targetVal.className = 'stat-value fraction-value';
  targetVal.innerHTML = '<span class="frac-actual">' + targetPct.toFixed(1) + '%</span><span class="frac-sep">·</span><span class="diff-value diff-' + status + '">' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%</span>';
  targetCell.appendChild(targetLabel);
  targetCell.appendChild(targetVal);
  targetRow.appendChild(targetCell);
  card.appendChild(targetRow);

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
  const resetRow = document.createElement('div');
  resetRow.className = 'stat-row compact-meta-row';
  resetRow.appendChild(resetCell);
  card.appendChild(resetRow);

  const bar = document.createElement('div');
  bar.className = 'bar-track';
  const targetFill = document.createElement('div');
  targetFill.className = 'bar-target-fill';
  targetFill.style.width = Math.min(100, targetPct) + '%';
  const actualFill = document.createElement('div');
  actualFill.className = 'bar-actual-fill status-' + status;
  actualFill.style.width = Math.min(100, actualPct) + '%';
  bar.appendChild(targetFill);
  bar.appendChild(actualFill);
  card.appendChild(bar);

  return card;
}
