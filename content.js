(() => {
  const bootFlag = "__rsbCompactSidebarLoaded";
  if (window[bootFlag]) {
    return;
  }
  window[bootFlag] = true;

  const SETTINGS_DEFAULTS = Object.freeze({
    compactSidebarEnabled: true,
    compactSidebarMode: "icon",
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

  const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS);
  const MODE_VALUES = new Set(["icon", "compact"]);

  const ROOT_CLASSES = Object.freeze({
    compactDisabled: "rsb-compact-disabled",
    hasSidebar: "rsb-has-roblox-sidebar",
    modeIcon: "rsb-mode-icon",
    modeCompact: "rsb-mode-compact"
  });

  const HIDE_CLASS_BY_SETTING = Object.freeze({
    hideProfile: "rsb-hide-profile",
    hideMessages: "rsb-hide-messages",
    hideFriends: "rsb-hide-friends",
    hideAvatar: "rsb-hide-avatar",
    hideInventory: "rsb-hide-inventory",
    hideTrade: "rsb-hide-trade",
    hideCommunities: "rsb-hide-communities",
    hideBlog: "rsb-hide-blog",
    hideOfficialStore: "rsb-hide-official-store",
    hideBuyGiftCards: "rsb-hide-buy-gift-cards",
    hideGetPremium: "rsb-hide-get-premium",
    hideFavorites: "rsb-hide-favorites",
    hideExperienceEvents: "rsb-hide-experience-events"
  });

  const SIDEBAR_SELECTORS = ["#left-navigation-container .left-nav", ".rbx-left-col"];

  let mutationObserver = null;
  let updateQueued = false;
  const settingsState = { ...SETTINGS_DEFAULTS };

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

  function applySettingsClasses() {
    const root = document.documentElement;
    const isCompactEnabled = settingsState.compactSidebarEnabled;
    const isIconMode = settingsState.compactSidebarMode === "icon";

    root.classList.toggle(ROOT_CLASSES.compactDisabled, !isCompactEnabled);
    root.classList.toggle(ROOT_CLASSES.modeIcon, isIconMode);
    root.classList.toggle(ROOT_CLASSES.modeCompact, !isIconMode);

    for (const [settingKey, className] of Object.entries(HIDE_CLASS_BY_SETTING)) {
      root.classList.toggle(className, settingsState[settingKey]);
    }
  }

  function applySettingsPatch(nextSettings) {
    Object.assign(settingsState, nextSettings);
    applySettingsClasses();
  }

  function hasSidebarInDOM() {
    return SIDEBAR_SELECTORS.some((selector) => document.querySelector(selector));
  }

  function updateSidebarPresenceClass() {
    const hasSidebar = hasSidebarInDOM();
    document.documentElement.classList.toggle(ROOT_CLASSES.hasSidebar, hasSidebar);
  }

  function queueSidebarPresenceUpdate() {
    if (updateQueued) {
      return;
    }

    updateQueued = true;
    requestAnimationFrame(() => {
      updateQueued = false;
      updateSidebarPresenceClass();
    });
  }

  function onStorageChanged(changes, areaName) {
    if (areaName !== "sync") {
      return;
    }

    const patch = {};
    for (const key of SETTINGS_KEYS) {
      if (!changes[key]) {
        continue;
      }

      patch[key] = changes[key].newValue;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    const normalized = sanitizeSettings({ ...settingsState, ...patch });
    applySettingsPatch(normalized);
  }

  function installHistoryHooks() {
    const originalPushState = history.pushState;
    history.pushState = function pushStateWrapper(...args) {
      const result = originalPushState.apply(this, args);
      queueSidebarPresenceUpdate();
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function replaceStateWrapper(...args) {
      const result = originalReplaceState.apply(this, args);
      queueSidebarPresenceUpdate();
      return result;
    };

    window.addEventListener("popstate", queueSidebarPresenceUpdate, { passive: true });
  }

  function installMutationObserver() {
    if (mutationObserver) {
      return;
    }

    mutationObserver = new MutationObserver(() => {
      queueSidebarPresenceUpdate();
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  async function initialize() {
    chrome.storage.onChanged.addListener(onStorageChanged);

    installHistoryHooks();
    installMutationObserver();
    queueSidebarPresenceUpdate();

    const initialSettings = await loadAndNormalizeSettings();
    applySettingsPatch(initialSettings);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void initialize();
    });
  } else {
    void initialize();
  }
})();
