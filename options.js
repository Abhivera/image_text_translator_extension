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
  compactOverlayMode: false,
  replaceTextBlocks: true,
  autoTranslateThenEdit: true,
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
  const compactEl = document.getElementById("compactOverlayMode");
  if (compactEl) compactEl.checked = Boolean(s.compactOverlayMode);
  const replaceEl = document.getElementById("replaceTextBlocks");
  if (replaceEl) replaceEl.checked = Boolean(s.replaceTextBlocks);
  const autoEditEl = document.getElementById("autoTranslateThenEdit");
  if (autoEditEl) autoEditEl.checked = Boolean(s.autoTranslateThenEdit);
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
  const isPreferredForProvider = Boolean(
    preferredModel &&
      modelSelect.querySelector(
        `option[data-provider="${provider}"][value="${preferredModel}"]`
      )
  );
  modelSelect.value =
    isPreferredForProvider
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
    compactOverlayMode: document.getElementById("compactOverlayMode").checked,
    replaceTextBlocks: document.getElementById("replaceTextBlocks").checked,
    autoTranslateThenEdit: document.getElementById("autoTranslateThenEdit")
      .checked,
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
