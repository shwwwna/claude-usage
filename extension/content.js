(function() {
  const TIMEOUT_MS = 12000;
  const POLL_INTERVAL_MS = 300;

  function hasUsageData(text) {
    return /current\s+session/i.test(text) && /\d+%\s+used/i.test(text);
  }

  function findUsageContainer() {
    const candidates = [
      document.querySelector('[role="dialog"]'),
      document.querySelector('[role="modal"]'),
      document.querySelector('main'),
      document.body,
    ].filter(Boolean);
    for (const el of candidates) {
      if (hasUsageData(el.innerText)) return el;
    }
    return null;
  }

  function tryExtract() {
    const container = findUsageContainer();
    if (container) {
      chrome.runtime.sendMessage({ type: 'USAGE_TEXT', text: container.innerText });
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
