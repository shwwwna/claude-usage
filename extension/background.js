chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('refresh', { periodInMinutes: 5 });
  chrome.action.setBadgeBackgroundColor({ color: '#d77556' });
});

chrome.action.onClicked.addListener(async () => {
  chrome.windows.create({
    url: 'window.html',
    type: 'popup',
    width: 900,
    height: 700
  });

  const tabs = await chrome.tabs.query({ url: 'https://claude.ai/settings/usage' });
  if (tabs.length === 0) {
    chrome.tabs.create({ url: 'https://claude.ai/settings/usage' });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'refresh') return;
  const tabs = await chrome.tabs.query({ url: 'https://claude.ai/settings/usage' });
  if (tabs.length === 0) return;
  const tab = tabs[0];
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
});

chrome.runtime.onMessage.addListener(({ type, text }, sender, sendResponse) => {
  if (type !== 'USAGE_TEXT') return;
  chrome.storage.local.set({ cachedText: text, cachedAt: Date.now() });

  const matches = text.match(/(\d+)%\s+used/gi);
  if (matches && matches.length >= 2) {
    const weeklyMatch = matches[1].match(/(\d+)/);
    const pct = weeklyMatch[1];
    chrome.action.setBadgeText({ text: pct + '%' });
  }
});
