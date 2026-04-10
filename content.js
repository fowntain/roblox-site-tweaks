(() => {
  const bootFlag = "__rsbCompactSidebarLoaded";
  if (window[bootFlag]) {
    return;
  }
  window[bootFlag] = true;

  const SETTINGS_DEFAULTS = Object.freeze({
    compactSidebarEnabled: true,
    compactSidebarMode: "icon",
    hideNavbarHome: true,
    renameNavbarEnabled: true,
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

  const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS);
  const MODE_VALUES = new Set(["icon", "compact"]);
  const TEXT_SETTING_KEYS = new Set(["topNavMarketplaceLabel", "topNavChartsLabel"]);

  const ROOT_CLASSES = Object.freeze({
    compactDisabled: "rsb-compact-disabled",
    hasSidebar: "rsb-has-roblox-sidebar",
    modeIcon: "rsb-mode-icon",
    modeCompact: "rsb-mode-compact",
    hideNavbarHome: "rsb-hide-navbar-home"
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
  const NAVBAR_ROOT_SELECTORS = [
    "#header",
    "#navigation-container",
    "header",
    "nav[role='navigation']",
    "[data-testid*='navigation']",
    "[class*='navigation-header']"
  ];
  const NAVBAR_LINK_SELECTOR = [
    "a#nav-marketplace-md-link",
    "a#nav-marketplace-sm-link",
    "a#nav-charts-md-link",
    "a#nav-charts-sm-link",
    "a#nav-discover-md-link",
    "a#nav-discover-sm-link",
    "a.nav-menu-title[href*='/charts']",
    "a.nav-menu-title[href*='/catalog']",
    "a.nav-menu-title[href*='/discover']",
    "a[href*='/charts']",
    "a[href*='/catalog']",
    "a[href*='/marketplace']",
    "a[href*='/discover']"
  ].join(", ");

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

  function applySettingsClasses() {
    const root = document.documentElement;
    const isCompactEnabled = settingsState.compactSidebarEnabled;
    const isIconMode = settingsState.compactSidebarMode === "icon";

    root.classList.toggle(ROOT_CLASSES.compactDisabled, !isCompactEnabled);
    root.classList.toggle(ROOT_CLASSES.modeIcon, isIconMode);
    root.classList.toggle(ROOT_CLASSES.modeCompact, !isIconMode);
    root.classList.toggle(ROOT_CLASSES.hideNavbarHome, settingsState.hideNavbarHome);

    for (const [settingKey, className] of Object.entries(HIDE_CLASS_BY_SETTING)) {
      root.classList.toggle(className, settingsState[settingKey]);
    }
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getNavbarRoots() {
    const roots = new Set();

    for (const selector of NAVBAR_ROOT_SELECTORS) {
      for (const element of document.querySelectorAll(selector)) {
        roots.add(element);
      }
    }

    if (roots.size === 0) {
      roots.add(document.documentElement);
    }

    return Array.from(roots);
  }

  function queryWithinRootsIncludingShadow(roots, selector) {
    const matches = new Set();
    const queue = [...roots];
    const seen = new Set();

    while (queue.length > 0) {
      const currentRoot = queue.shift();
      if (!currentRoot || seen.has(currentRoot) || !currentRoot.querySelectorAll) {
        continue;
      }

      seen.add(currentRoot);

      for (const match of currentRoot.querySelectorAll(selector)) {
        matches.add(match);
      }

      for (const element of currentRoot.querySelectorAll("*")) {
        if (element.shadowRoot) {
          queue.push(element.shadowRoot);
        }
      }
    }

    return Array.from(matches);
  }

  function isSidebarLink(link) {
    return Boolean(link.closest("#left-navigation-container, .left-nav, .rbx-left-col"));
  }

  function isLikelyTopNavbarLink(link) {
    return Boolean(
      link.closest(
        "#header, #navigation-container, header, nav[role='navigation'], [class*='navbar'], [class*='navigation']"
      )
    );
  }

  function getTopNavbarLinks() {
    const roots = getNavbarRoots();
    const links = queryWithinRootsIncludingShadow(roots, NAVBAR_LINK_SELECTOR);

    return links.filter((link) => {
      if (!(link instanceof HTMLAnchorElement)) {
        return false;
      }

      if (isSidebarLink(link)) {
        return false;
      }

      if (link.classList.contains("new-navbar-search-anchor") || (link.getAttribute("href") && link.getAttribute("href").includes("Keyword="))) {
        return false;
      }

      return isLikelyTopNavbarLink(link) || link.classList.contains("nav-menu-title");
    });
  }

  function setLinkLabel(link, labelText) {
    // Strip RoPro classes that may override text via CSS ::before/::after
    if (link.classList.contains("ropro-most-played-hard-nav")) {
      link.classList.remove("ropro-most-played-hard-nav");
    }
    
    // Check for inner span (used by newer React layouts or other extensions)
    const spanTextNodes = Array.from(link.querySelectorAll("span")).flatMap(span => 
      Array.from(span.childNodes).filter(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0
      )
    );

    const textNodes = Array.from(link.childNodes).filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0
    ).concat(spanTextNodes);

    if (textNodes.length > 0) {
      for (const textNode of textNodes) {
        if (textNode.textContent !== labelText) {
          textNode.textContent = labelText;
        }
      }
    } else if (link.textContent !== labelText) {
      link.textContent = labelText;
    }

    if (link.getAttribute("aria-label") !== null && link.getAttribute("aria-label") !== labelText) {
      link.setAttribute("aria-label", labelText);
    }

    if (link.title && link.title !== labelText) {
      link.title = labelText;
    }
  }

  function setNavbarLabelByPredicate(predicate, labelText) {
    const links = getTopNavbarLinks();

    for (const link of links) {
      if (!predicate(link)) {
        continue;
      }

      setLinkLabel(link, labelText);
    }
  }

  function isMarketplaceTopLink(link) {
    const id = (link.id || "").toLowerCase();
    const href = (link.getAttribute("href") || "").toLowerCase();
    const text = normalizeText(link.textContent);

    return (
      id.includes("marketplace") ||
      href.includes("/catalog") ||
      href.includes("/marketplace") ||
      text === "marketplace" ||
      text === "catalog"
    );
  }

  function isChartsTopLink(link) {
    const id = (link.id || "").toLowerCase();
    const href = (link.getAttribute("href") || "").toLowerCase();
    const text = normalizeText(link.textContent);

    return (
      id.includes("charts") ||
      id.includes("discover") ||
      href.includes("/charts") ||
      href.includes("/discover") ||
      text === "charts" ||
      text === "discover" ||
      text === "games" ||
      text === "most played"
    );
  }

  function applyNavbarRenames() {
    if (!settingsState.renameNavbarEnabled) {
      return;
    }
    setNavbarLabelByPredicate(isMarketplaceTopLink, settingsState.topNavMarketplaceLabel);
    setNavbarLabelByPredicate(isChartsTopLink, settingsState.topNavChartsLabel);
  }

  function applySettingsPatch(nextSettings) {
    Object.assign(settingsState, nextSettings);
    applySettingsClasses();
    applyNavbarRenames();
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
      applyNavbarRenames();
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
      subtree: true,
      characterData: true
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
