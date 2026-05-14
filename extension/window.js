let messageListener = null;

function loadSessionStartTime() { return null; }
function saveSessionStartTime() {}
function loadHistory() { return []; }
function saveHistory() {}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAlarmState();
  updateAlarmButtonLabel();

  const cachedData = await getCachedData();
  if (cachedData) {
    processText(cachedData.text);
    showLastUpdated(cachedData.timestamp);
  }

  let tabs = await chrome.tabs.query({ url: 'https://claude.ai/settings/usage' });
  let usageTab = tabs.length > 0 ? tabs[0] : null;

  if (!usageTab) {
    const newTab = await chrome.tabs.create({ url: 'https://claude.ai/settings/usage' });
    usageTab = newTab;
  }

  if (usageTab) {
    document.getElementById('status-bar').style.display = 'flex';
    document.getElementById('btn-alarm-toggle').addEventListener('click', () => {
      const newState = !isAlarmEnabled();
      setAlarmEnabled(newState);
      updateAlarmButtonLabel();
    });
    document.getElementById('btn-refresh').addEventListener('click', async () => {
      await chrome.tabs.update(usageTab.id, { url: 'https://claude.ai/settings/usage' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      await chrome.scripting.executeScript({ target: { tabId: usageTab.id }, files: ['content.js'] });
    });
    document.getElementById('btn-open-usage').addEventListener('click', async () => {
      try {
        await chrome.tabs.update(usageTab.id, { active: true });
      } catch {
        // Tab was closed, create a new one
        const newTab = await chrome.tabs.create({ url: 'https://claude.ai/settings/usage' });
        usageTab = newTab;
        await chrome.scripting.executeScript({ target: { tabId: usageTab.id }, files: ['content.js'] });
      }
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
    if (isAlarmEnabled() && parsed.session) {
      scheduleSessionAlarm(Date.now() + parsed.session.hoursLeft * 3600 * 1000);
    }
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

function exponentToLabel(e) {
  if (e < 0.2) return 'Conservative';
  if (e < 0.4) return 'Slight Push';
  if (e < 0.6) return 'Slight Push';
  if (e < 0.8) return 'Front-loaded';
  return 'Aggressive';
}

function run(options) {
  const cachedText = localStorage.getItem ? localStorage.getItem('cachedText') : null;
  if (cachedText) {
    processText(cachedText);
  }
}

function deleteEntry(ts) {
  // Placeholder
}

function clearHistory() {
  // Placeholder
}

function analyzeHistory(entries) {
  return {};
}

function groupBySession(entries) {
  return [];
}

function importJSON(file) {
  return Promise.resolve([]);
}

function exportJSON() {
  // Placeholder
}

function updateAlarmButtonLabel() {
  const btn = document.getElementById('btn-alarm-toggle');
  if (btn) {
    btn.textContent = isAlarmEnabled() ? 'Alarm: on' : 'Alarm: off';
  }
}
