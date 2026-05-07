const storageAdapter = {
  getItem: async function(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  },
  setItem: async function(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async function(key) {
    await chrome.storage.local.remove(key);
  },
};

if (typeof localStorage === 'undefined') {
  window.localStorage = storageAdapter;
}
