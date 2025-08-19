const DEFAULTS = {
  apiKey: "",
  sourceLanguage: "ja",
  targetLanguage: "en",
  model: "gemini-1.5-flash",
  overlayBgColor: "#ffffff",
  overlayBgOpacity: 95,
  overlayTextColor: "#111111",
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULTS, (items) => resolve(items));
  });
}

function setSettings(partial) {
  return new Promise((resolve) => {
    chrome.storage.local.set(partial, resolve);
  });
}

async function init() {
  const s = await getSettings();
  document.getElementById("apiKey").value = s.apiKey || "";
  document.getElementById("sourceLanguage").value = s.sourceLanguage || "ja";
  document.getElementById("targetLanguage").value = s.targetLanguage || "en";
  document.getElementById("model").value = s.model || "gemini-1.5-flash";
  const bg = s.overlayBgColor || DEFAULTS.overlayBgColor;
  const txt = s.overlayTextColor || DEFAULTS.overlayTextColor;
  const op =
    typeof s.overlayBgOpacity === "number"
      ? s.overlayBgOpacity
      : DEFAULTS.overlayBgOpacity;
  const bgEl = document.getElementById("overlayBgColor");
  const txtEl = document.getElementById("overlayTextColor");
  const opEl = document.getElementById("overlayBgOpacity");
  if (bgEl) bgEl.value = bg;
  if (txtEl) txtEl.value = txt;
  if (opEl) opEl.value = String(op);
}

async function save() {
  const payload = {
    apiKey: document.getElementById("apiKey").value.trim(),
    sourceLanguage: document.getElementById("sourceLanguage").value,
    targetLanguage: document.getElementById("targetLanguage").value,
    model: document.getElementById("model").value,
    overlayBgColor:
      document.getElementById("overlayBgColor").value ||
      DEFAULTS.overlayBgColor,
    overlayTextColor:
      document.getElementById("overlayTextColor").value ||
      DEFAULTS.overlayTextColor,
    overlayBgOpacity: parseInt(
      document.getElementById("overlayBgOpacity").value ||
        DEFAULTS.overlayBgOpacity,
      10
    ),
  };
  await setSettings(payload);
  const status = document.getElementById("status");
  status.textContent = "Saved";
  setTimeout(() => (status.textContent = ""), 1200);
}

document.getElementById("save").addEventListener("click", save);
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
