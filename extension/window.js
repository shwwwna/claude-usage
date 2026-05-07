let messageListener = null;

function loadSessionStartTime() { return null; }
function saveSessionStartTime() {}
function loadHistory() { return []; }
function saveHistory() {}

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
