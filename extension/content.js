(function() {
  const TIMEOUT_MS = 8000;
  const POLL_INTERVAL_MS = 300;

  function hasUsageData(text) {
    return /current\s+session/i.test(text) && /\d+%\s+used/i.test(text);
  }

  function tryExtract() {
    const main = document.querySelector('main') || document.body;
    const text = main.innerText;
    if (hasUsageData(text)) {
      chrome.runtime.sendMessage({ type: 'USAGE_TEXT', text });
      return true;
    }
    return false;
  }

  if (tryExtract()) return;

  const start = Date.now();
  const observer = new MutationObserver(() => {
    if (tryExtract()) {
      observer.disconnect();
    } else if (Date.now() - start > TIMEOUT_MS) {
      observer.disconnect();
      chrome.runtime.sendMessage({ type: 'USAGE_ERROR', reason: 'timeout' });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
