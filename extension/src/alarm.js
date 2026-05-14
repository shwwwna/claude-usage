const ALARM_ENABLED_KEY = 'claude-usage-alarm-enabled';
const MAX_TIMEOUT = 2147483647;

let timerId = null;
let scheduledFor = null;
let alarmAudio = null;
let titleFlashId = null;
let faviconFlashId = null;
let originalTitle = typeof document !== 'undefined' ? document.title : '';
let originalFavicon = null;
let modalEl = null;
let activeNotification = null;
let escHandler = null;
let _alarmEnabled = true;

const FLASH_FAVICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#e14b4b"/></svg>'
);

function isAlarmEnabled() {
  return _alarmEnabled;
}

function setAlarmEnabled(enabled) {
  _alarmEnabled = enabled;
  chrome.storage.local.set({ 'claude-usage-alarm-enabled': enabled ? '1' : '0' });
  if (!enabled) {
    cancelAlarm();
    dismissAlarm();
  } else if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

async function loadAlarmState() {
  try {
    const result = await chrome.storage.local.get('claude-usage-alarm-enabled');
    const val = result['claude-usage-alarm-enabled'];
    _alarmEnabled = val === undefined ? true : val === '1';
  } catch (e) {
    _alarmEnabled = true;
  }
}

function scheduleSessionAlarm(resetMs) {
  cancelAlarm();
  if (!isAlarmEnabled()) return;
  const delay = resetMs - Date.now();
  if (delay <= 500) return;
  scheduledFor = resetMs;
  const wait = Math.min(delay, MAX_TIMEOUT);
  timerId = setTimeout(function() {
    if (Date.now() + 500 < scheduledFor) {
      scheduleSessionAlarm(scheduledFor);
    } else {
      fireAlarm();
    }
  }, wait);
}

function cancelAlarm() {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  scheduledFor = null;
}

function fireAlarm() {
  timerId = null;
  scheduledFor = null;
  startSound();
  startTitleFlash();
  startFaviconFlash();
  showNotification();
  showModal();
}

function startSound() {
  try {
    alarmAudio = new Audio('assets/Recover.mp3');
    alarmAudio.loop = true;
    alarmAudio.volume = 0.5;
    alarmAudio.play();
  } catch (e) {}
}

function stopSound() {
  if (alarmAudio) {
    try { alarmAudio.pause(); } catch (e) {}
    alarmAudio = null;
  }
}

function startTitleFlash() {
  originalTitle = document.title;
  let on = false;
  titleFlashId = setInterval(function() {
    on = !on;
    document.title = on ? '🔔 SESSION RESET' : originalTitle;
  }, 800);
}

function stopTitleFlash() {
  if (titleFlashId !== null) {
    clearInterval(titleFlashId);
    titleFlashId = null;
  }
  document.title = originalTitle;
}

function getFaviconLink() {
  return document.querySelector('link[rel="icon"]');
}

function startFaviconFlash() {
  const link = getFaviconLink();
  if (!link) return;
  originalFavicon = link.getAttribute('href');
  let on = false;
  faviconFlashId = setInterval(function() {
    on = !on;
    link.setAttribute('href', on ? FLASH_FAVICON : originalFavicon);
  }, 800);
}

function stopFaviconFlash() {
  if (faviconFlashId !== null) {
    clearInterval(faviconFlashId);
    faviconFlashId = null;
  }
  const link = getFaviconLink();
  if (link && originalFavicon !== null) link.setAttribute('href', originalFavicon);
}

function showNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    activeNotification = new Notification('Claude session reset', {
      body: 'Your session window has reset.',
      tag: 'claude-session-reset',
      requireInteraction: true
    });
    activeNotification.onclick = function() {
      window.focus();
      dismissAlarm();
    };
  } catch (e) {}
}

function showModal() {
  if (modalEl) return;
  modalEl = document.createElement('div');
  modalEl.className = 'alarm-modal-overlay';
  modalEl.innerHTML =
    '<div class="alarm-modal">' +
      '<div class="alarm-modal-title">🔔 Session Reset</div>' +
      '<div class="alarm-modal-body">Your Claude session window has reset.</div>' +
      '<button class="alarm-dismiss-btn" type="button">Dismiss</button>' +
    '</div>';
  modalEl.querySelector('.alarm-dismiss-btn').addEventListener('click', dismissAlarm);
  escHandler = function(e) { if (e.key === 'Escape') dismissAlarm(); };
  document.addEventListener('keydown', escHandler);
  document.body.appendChild(modalEl);
}

function removeModal() {
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
  modalEl = null;
}

function dismissAlarm() {
  stopSound();
  stopTitleFlash();
  stopFaviconFlash();
  removeModal();
  if (activeNotification) {
    try { activeNotification.close(); } catch (e) {}
    activeNotification = null;
  }
}
