const SETTINGS_DEFAULTS = Object.freeze({
  compactSidebarEnabled: true,
  compactSidebarMode: "icon",
  hideNavbarHome: false,
  topNavMarketplaceLabel: "Catalog",
  topNavChartsLabel: "Games",
  hideProfile: false,
  hideFriends: false,
  hideAvatar: false,
  hideInventory: false,
  hideTrade: false,
  hideCommunities: false,
  hideGetPremium: true,
  hideBuyGiftCards: false,
  hideOfficialStore: true,
  hideBlog: true,
  hideMessages: false,
  hideFavorites: false,
  hideExperienceEvents: true
});

const MODE_VALUES = new Set(["icon", "compact"]);
const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS);
const TEXT_SETTING_KEYS = new Set(["topNavMarketplaceLabel", "topNavChartsLabel"]);

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => resolve(result));
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(values, () => resolve());
  });
}

function sanitizeSettings(raw) {
  const sanitized = {};

  for (const key of SETTINGS_KEYS) {
    const defaultValue = SETTINGS_DEFAULTS[key];
    const value = raw[key];

    if (key === "compactSidebarMode") {
      sanitized[key] = MODE_VALUES.has(value) ? value : defaultValue;
      continue;
    }

    if (TEXT_SETTING_KEYS.has(key)) {
      const normalized = typeof value === "string" ? value.trim() : "";
      sanitized[key] = normalized.length > 0 ? normalized : defaultValue;
      continue;
    }

    sanitized[key] = typeof value === "boolean" ? value : defaultValue;
  }

  return sanitized;
}

async function loadAndNormalizeSettings() {
  const stored = await storageGet(SETTINGS_KEYS);
  const sanitized = sanitizeSettings(stored);
  const patch = {};

  for (const key of SETTINGS_KEYS) {
    if (stored[key] !== sanitized[key]) {
      patch[key] = sanitized[key];
    }
  }

  if (Object.keys(patch).length > 0) {
    await storageSet(patch);
  }

  return sanitized;
}

function updateActionBadge(enabled) {
  const text = enabled ? "ON" : "OFF";
  const color = enabled ? "#006b37" : "#3f4655";
  const title = enabled
    ? "Compact sidebar is ON. Open settings to change mode."
    : "Compact sidebar is OFF. Open settings to enable.";

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setTitle({ title });
}

async function refreshBadgeFromStorage() {
  const settings = await loadAndNormalizeSettings();
  updateActionBadge(settings.compactSidebarEnabled);
}

chrome.runtime.onInstalled.addListener(async () => {
  await refreshBadgeFromStorage();
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshBadgeFromStorage();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes.compactSidebarEnabled) {
    return;
  }

  const nextValue = changes.compactSidebarEnabled.newValue;
  if (typeof nextValue !== "boolean") {
    return;
  }

  updateActionBadge(nextValue);
});
