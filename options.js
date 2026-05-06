const DEFAULTS = {
  modelProvider: "gemini",
  geminiApiKey: "",
  openaiApiKey: "",
  deepseekApiKey: "",
  groqApiKey: "",
  ollamaApiKey: "",
  ollamaBaseUrl: "http://localhost:11434",
  sourceLanguage: "ja",
  targetLanguage: "en",
  model: "gemini-1.5-flash",
  overlayBgColor: "#ffffff",
  overlayBgOpacity: 95,
  overlayTextColor: "#111111",
  autoTranslateAll: false,
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
  document.getElementById("modelProvider").value = s.modelProvider || "gemini";
  document.getElementById("geminiApiKey").value = s.geminiApiKey || "";
  document.getElementById("openaiApiKey").value = s.openaiApiKey || "";
  document.getElementById("deepseekApiKey").value = s.deepseekApiKey || "";
  document.getElementById("groqApiKey").value = s.groqApiKey || "";
  document.getElementById("ollamaApiKey").value = s.ollamaApiKey || "";
  document.getElementById("ollamaBaseUrl").value =
    s.ollamaBaseUrl || "http://localhost:11434";
  document.getElementById("sourceLanguage").value = s.sourceLanguage || "ja";
  document.getElementById("targetLanguage").value = s.targetLanguage || "en";
  const savedModel = s.model || "gemini-1.5-flash";
  document.getElementById("model").value = savedModel;
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
  const autoEl = document.getElementById("autoTranslateAll");
  if (autoEl) autoEl.checked = Boolean(s.autoTranslateAll);
  updateProviderSections(document.getElementById("modelProvider").value, savedModel);
}

function updateProviderSections(provider, preferredModel) {
  const sections = {
    gemini: document.getElementById("geminiApiSection"),
    openai: document.getElementById("openaiApiSection"),
    deepseek: document.getElementById("deepseekApiSection"),
    groq: document.getElementById("groqApiSection"),
    ollama: document.getElementById("ollamaApiSection"),
  };
  Object.keys(sections).forEach((k) => {
    if (sections[k]) sections[k].style.display = k === provider ? "block" : "none";
  });

  const defaultModels = {
    gemini: "gemini-1.5-flash",
    openai: "gpt-4o-mini",
    deepseek: "deepseek-chat",
    groq: "meta-llama/llama-4-scout-17b-16e-instruct",
    ollama: "llava:latest",
  };
  const modelSelect = document.getElementById("model");
  Array.from(modelSelect.options).forEach((option) => {
    const p = option.getAttribute("data-provider");
    option.style.display = p === provider ? "block" : "none";
  });
  modelSelect.value =
    preferredModel && modelSelect.querySelector(`option[value="${preferredModel}"]`)
      ? preferredModel
      : defaultModels[provider] || "gemini-1.5-flash";
}

async function save() {
  const payload = {
    modelProvider: document.getElementById("modelProvider").value,
    geminiApiKey: document.getElementById("geminiApiKey").value.trim(),
    openaiApiKey: document.getElementById("openaiApiKey").value.trim(),
    deepseekApiKey: document.getElementById("deepseekApiKey").value.trim(),
    groqApiKey: document.getElementById("groqApiKey").value.trim(),
    ollamaApiKey: document.getElementById("ollamaApiKey").value.trim(),
    ollamaBaseUrl: document
      .getElementById("ollamaBaseUrl")
      .value.trim() || "http://localhost:11434",
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
    autoTranslateAll: document.getElementById("autoTranslateAll").checked,
  };
  await setSettings(payload);
  const status = document.getElementById("status");
  status.textContent = "Saved";
  setTimeout(() => (status.textContent = ""), 1200);
}

document.getElementById("save").addEventListener("click", save);
document.getElementById("modelProvider").addEventListener("change", (e) => {
  updateProviderSections(e.target.value);
});
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
