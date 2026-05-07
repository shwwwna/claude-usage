chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('refresh', { periodInMinutes: 5 });
});

chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: 'window.html',
    type: 'popup',
    width: 900,
    height: 700
  });
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

  const match = text.match(/(\d+)%\s+used/i);
  if (match) {
    const pct = match[1];
    chrome.action.setBadgeText({ text: pct + '%' });
    chrome.action.setBadgeBackgroundColor({ color: '#4a9eff' });
  }
});
