const HIDE_OPTIONS = Object.freeze([
  { key: "hideProfile", label: "Profile", defaultValue: false },
  { key: "hideMessages", label: "Messages", defaultValue: false },
  { key: "hideFriends", label: "Friends", defaultValue: false },
  { key: "hideAvatar", label: "Avatar", defaultValue: false },
  { key: "hideInventory", label: "Inventory", defaultValue: false },
  { key: "hideTrade", label: "Trade", defaultValue: false },
  { key: "hideCommunities", label: "Communities", defaultValue: false },
  { key: "hideBlog", label: "Blog", defaultValue: true },
  { key: "hideOfficialStore", label: "Official Store", defaultValue: true },
  { key: "hideBuyGiftCards", label: "Buy Gift Cards", defaultValue: false },
  { key: "hideGetPremium", label: "Get Premium", defaultValue: true },
  { key: "hideFavorites", label: "Favorites", defaultValue: false },
  { key: "hideExperienceEvents", label: "Experience Events", defaultValue: true }
]);

const NAVBAR_LABEL_DEFAULTS = Object.freeze({
  topNavMarketplaceLabel: "Catalog",
  topNavChartsLabel: "Games"
});

const NAVBAR_LABEL_KEY_SET = new Set(Object.keys(NAVBAR_LABEL_DEFAULTS));

const SETTINGS_DEFAULTS = Object.freeze({
  compactSidebarEnabled: true,
  compactSidebarMode: "icon",
  hideNavbarHome: true,
  renameNavbarEnabled: true,
  ...NAVBAR_LABEL_DEFAULTS,
  ...Object.fromEntries(HIDE_OPTIONS.map((option) => [option.key, option.defaultValue]))
});

const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS);
const MODE_VALUES = new Set(["icon", "compact"]);

const CONTROL_TO_KEY = Object.freeze({
  compactEnabled: "compactSidebarEnabled",
  hideNavbarHome: "hideNavbarHome",
  renameNavbarEnabled: "renameNavbarEnabled"
});

const TEXT_CONTROL_TO_KEY = Object.freeze({
  topNavMarketplaceLabel: "topNavMarketplaceLabel",
  topNavChartsLabel: "topNavChartsLabel"
});

let statusTimeout = null;

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
  const settings = {};

  for (const key of SETTINGS_KEYS) {
    const defaultValue = SETTINGS_DEFAULTS[key];
    const value = raw[key];

    if (key === "compactSidebarMode") {
      settings[key] = MODE_VALUES.has(value) ? value : defaultValue;
      continue;
    }

    if (NAVBAR_LABEL_KEY_SET.has(key)) {
      const normalized = typeof value === "string" ? value.trim() : "";
      settings[key] = normalized.length > 0 ? normalized : defaultValue;
      continue;
    }

    settings[key] = typeof value === "boolean" ? value : defaultValue;
  }

  return settings;
}

async function loadSettings() {
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

function setStatus(message) {
  const statusElement = document.getElementById("saveStatus");
  statusElement.textContent = message;

  if (statusTimeout) {
    clearTimeout(statusTimeout);
  }

  statusTimeout = setTimeout(() => {
    statusElement.textContent = "";
  }, 900);
}

function setModeSectionDisabled(disabled) {
  const modeSection = document.getElementById("modeSection");
  modeSection.style.opacity = disabled ? "0.65" : "1";

  for (const input of modeSection.querySelectorAll("input")) {
    input.disabled = disabled;
  }
}

function createHideOptionControl(option) {
  const controlId = `setting-${option.key}`;

  const label = document.createElement("label");
  label.className = "row";
  label.htmlFor = controlId;

  const labelText = document.createElement("span");
  labelText.textContent = option.label;

  const input = document.createElement("input");
  input.id = controlId;
  input.type = "checkbox";
  input.dataset.settingKey = option.key;

  label.appendChild(labelText);
  label.appendChild(input);

  return label;
}

function renderHideOptions() {
  const optionList = document.getElementById("hideOptions");
  optionList.textContent = "";

  for (const option of HIDE_OPTIONS) {
    optionList.appendChild(createHideOptionControl(option));
  }
}

function renderForm(settings) {
  document.getElementById("compactEnabled").checked = settings.compactSidebarEnabled;
  document.getElementById("modeIconOnly").checked = settings.compactSidebarMode === "icon";
  document.getElementById("modeCompact").checked = settings.compactSidebarMode === "compact";
  document.getElementById("hideNavbarHome").checked = settings.hideNavbarHome;
  document.getElementById("renameNavbarEnabled").checked = settings.renameNavbarEnabled;
  document.getElementById("topNavMarketplaceLabel").value = settings.topNavMarketplaceLabel;
  document.getElementById("topNavChartsLabel").value = settings.topNavChartsLabel;

  for (const option of HIDE_OPTIONS) {
    const control = document.getElementById(`setting-${option.key}`);
    if (control) {
      control.checked = !settings[option.key];
    }
  }

  setModeSectionDisabled(!settings.compactSidebarEnabled);
}

async function saveSetting(key, value) {
  await storageSet({ [key]: value });
  setStatus("Saved");
}

function bindBooleanControls() {
  for (const [controlId, settingKey] of Object.entries(CONTROL_TO_KEY)) {
    const control = document.getElementById(controlId);
    control.addEventListener("change", async () => {
      await saveSetting(settingKey, control.checked);

      if (controlId === "compactEnabled") {
        setModeSectionDisabled(!control.checked);
      }
    });
  }

  const hideControls = document.querySelectorAll("input[data-setting-key]");
  for (const control of hideControls) {
    control.addEventListener("change", async () => {
      const settingKey = control.dataset.settingKey;
      if (!settingKey) {
        return;
      }

      await saveSetting(settingKey, !control.checked);
    });
  }
}

function bindModeControls() {
  const modeInputs = document.querySelectorAll('input[name="compactSidebarMode"]');

  for (const input of modeInputs) {
    input.addEventListener("change", async () => {
      if (!input.checked) {
        return;
      }

      await saveSetting("compactSidebarMode", input.value);
    });
  }
}

function bindTextControls() {
  for (const [controlId, settingKey] of Object.entries(TEXT_CONTROL_TO_KEY)) {
    const control = document.getElementById(controlId);
    control.addEventListener("change", async () => {
      const value = control.value.trim();
      const fallback = NAVBAR_LABEL_DEFAULTS[settingKey];
      await saveSetting(settingKey, value.length > 0 ? value : fallback);
      control.value = value.length > 0 ? value : fallback;
    });
  }
}

async function checkForUpdates() {
  try {
    const response = await fetch("https://api.github.com/repos/fowntain/roblox-site-tweaks/releases/latest");
    if (!response.ok) return;

    const data = await response.json();
    let latestVersion = data.tag_name || "";
    if (latestVersion.startsWith("v")) latestVersion = latestVersion.substring(1);

    const currentVersion = chrome.runtime.getManifest().version;
    
    // Simple version comparison (assumes semver formatting e.g. 1.0.0)
    const isNewer = latestVersion && latestVersion !== currentVersion && 
      latestVersion.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0;

    if (isNewer) {
      chrome.storage.local.get(["ignoredUpdateVersion"], (result) => {
        if (result.ignoredUpdateVersion !== latestVersion) {
          const banner = document.getElementById("updateBanner");
          document.getElementById("latestVersionText").textContent = latestVersion;
          banner.style.display = "flex";

          document.getElementById("dismissUpdateBtn").addEventListener("click", () => {
            chrome.storage.local.set({ ignoredUpdateVersion: latestVersion });
            banner.style.display = "none";
          });
        }
      });
    }
  } catch (error) {
    console.error("Failed to check for updates", error);
  }
}

async function initialize() {
  renderHideOptions();
  const settings = await loadSettings();
  renderForm(settings);
  bindBooleanControls();
  bindModeControls();
  bindTextControls();
  checkForUpdates();
}

void initialize();
