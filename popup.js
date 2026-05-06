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
  enableByDefault: false,
};

function getActive(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: "MT_GET_ACTIVE" }, (resp) => {
        if (chrome.runtime.lastError) return resolve(false);
        resolve(Boolean(resp && resp.active));
      });
    } catch {
      resolve(false);
    }
  });
}

function setActive(tabId, active) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(
        tabId,
        { type: "MT_SET_ACTIVE", active },
        (resp) => {
          if (chrome.runtime.lastError) return resolve(false);
          resolve(Boolean(resp && resp.active));
        }
      );
    } catch {
      resolve(false);
    }
  });
}

function sendTranslateOnce(tabId) {
  chrome.tabs
    .sendMessage(tabId, { type: "MT_TRANSLATE_ONCE" })
    .catch(() => {});
}

function getContinuous(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: "MT_GET_CONTINUOUS" }, (resp) => {
        if (chrome.runtime.lastError) return resolve(false);
        resolve(Boolean(resp && resp.ok && resp.enabled));
      });
    } catch {
      resolve(false);
    }
  });
}

function setContinuous(tabId, enabled) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(
        tabId,
        { type: "MT_SET_CONTINUOUS", enabled },
        (resp) => {
          if (chrome.runtime.lastError) return resolve({ ok: false });
          resolve(resp || { ok: false });
        }
      );
    } catch {
      resolve({ ok: false });
    }
  });
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentSettings = await new Promise((resolve) =>
    chrome.storage.local.get(DEFAULTS, (items) => resolve(items))
  );

  const toggleInput = document.getElementById("toggleActive");
  const toggleStateText = document.getElementById("toggleStateText");
  function updateTranslatorToggleUi(on) {
    if (toggleInput) toggleInput.checked = Boolean(on);
    if (toggleStateText) toggleStateText.textContent = on ? "On" : "Off";
  }

  const translateOnceBtn = document.getElementById("translateOnce");
  const translateContinuousBtn = document.getElementById("translateContinuous");
  const modelProviderSelect = document.getElementById("modelProvider");
  const geminiApiKeyInput = document.getElementById("geminiApiKey");
  const openaiApiKeyInput = document.getElementById("openaiApiKey");
  const deepseekApiKeyInput = document.getElementById("deepseekApiKey");
  const groqApiKeyInput = document.getElementById("groqApiKey");
  const ollamaApiKeyInput = document.getElementById("ollamaApiKey");
  const ollamaBaseUrlInput = document.getElementById("ollamaBaseUrl");
  const sourceSelect = document.getElementById("sourceLanguage");
  const targetSelect = document.getElementById("targetLanguage");
  const modelSelect = document.getElementById("model");
  const compactOverlayModeInput = document.getElementById("compactOverlayMode");
  const replaceTextBlocksInput = document.getElementById("replaceTextBlocks");
  const autoTranslateThenEditInput = document.getElementById(
    "autoTranslateThenEdit"
  );
  const saveBtn = document.getElementById("saveSettings");
  const saveStatus = document.getElementById("saveStatus");
  const apiWarning = document.getElementById("apiWarning");

  function updateContinuousButtonUi(on) {
    if (!translateContinuousBtn) return;
    translateContinuousBtn.textContent = on
      ? "Translate as I Scroll: On"
      : "Translate as I Scroll: Off";
    translateContinuousBtn.classList.remove("btn-red", "btn-green");
    translateContinuousBtn.classList.add(on ? "btn-green" : "btn-red");
  }

  function providerLabel(provider) {
    const map = {
      gemini: "Gemini",
      openai: "OpenAI",
      deepseek: "DeepSeek",
      groq: "Groq",
      ollama: "Ollama",
    };
    return map[provider] || String(provider || "Provider");
  }

  function hasRequiredCredential(provider, current) {
    if (provider === "ollama") return true; // local endpoint; key optional
    const keyName = `${provider}ApiKey`;
    return Boolean(String(current?.[keyName] || "").trim());
  }

  function updateApiWarning(current, activeProvider) {
    if (!apiWarning) return;
    const provider = activeProvider || current?.modelProvider || "gemini";
    if (!hasRequiredCredential(provider, current)) {
      apiWarning.textContent = `${providerLabel(
        provider
      )} API key is missing. Add it in Settings before translating.`;
      apiWarning.classList.add("show");
    } else {
      apiWarning.textContent = "";
      apiWarning.classList.remove("show");
    }
  }

  if (!tab?.id) {
    toggleInput.disabled = true;
    updateTranslatorToggleUi(false);
    if (translateOnceBtn) translateOnceBtn.disabled = true;
    if (translateContinuousBtn) translateContinuousBtn.disabled = true;
  } else {
    const current = await getActive(tab.id);
    updateTranslatorToggleUi(current);

    const cont = await getContinuous(tab.id);
    updateContinuousButtonUi(cont);
    updateApiWarning(
      currentSettings,
      currentSettings.modelProvider || "gemini"
    );

    toggleInput.addEventListener("change", async () => {
      const now = await getActive(tab.id);
      const next = Boolean(toggleInput.checked);
      const final = await setActive(tab.id, next);
      updateTranslatorToggleUi(final);

      // If state update fails, keep UI in sync with actual tab state.
      if (final !== next) {
        const confirmed = await getActive(tab.id);
        updateTranslatorToggleUi(confirmed);
      }
    });

    translateOnceBtn.addEventListener("click", async () => {
      const originalText = translateOnceBtn.textContent;
      translateOnceBtn.disabled = true;
      translateOnceBtn.textContent = "Translating...";
      const active = await getActive(tab.id);
      if (!active) {
        translateOnceBtn.textContent = "Turn Translator On first";
        translateOnceBtn.disabled = false;
        setTimeout(() => {
          translateOnceBtn.textContent = originalText || "Translate Once";
        }, 1500);
        return;
      }
      const latest = await new Promise((resolve) =>
        chrome.storage.local.get(DEFAULTS, (items) => resolve(items))
      );
      const provider = latest.modelProvider || "gemini";
      if (!hasRequiredCredential(provider, latest)) {
        updateApiWarning(latest, provider);
        translateOnceBtn.disabled = false;
        translateOnceBtn.textContent = originalText || "Translate Once";
        return;
      }
      sendTranslateOnce(tab.id);
      translateOnceBtn.textContent = "Translating...";
      window.close();
    });

    translateContinuousBtn.addEventListener("click", async () => {
      const prevLabel = translateContinuousBtn.textContent;
      translateContinuousBtn.disabled = true;
      translateContinuousBtn.textContent = "Updating...";
      const active = await getActive(tab.id);
      if (!active) {
        translateContinuousBtn.textContent = "Turn Translator On first";
        translateContinuousBtn.disabled = false;
        setTimeout(async () => {
          updateContinuousButtonUi(await getContinuous(tab.id));
        }, 1500);
        return;
      }
      const latest = await new Promise((resolve) =>
        chrome.storage.local.get(DEFAULTS, (items) => resolve(items))
      );
      const provider = latest.modelProvider || "gemini";
      if (!hasRequiredCredential(provider, latest)) {
        updateApiWarning(latest, provider);
        translateContinuousBtn.disabled = false;
        translateContinuousBtn.textContent =
          prevLabel || "Translate as I Scroll: Off";
        return;
      }
      const now = await getContinuous(tab.id);
      const resp = await setContinuous(tab.id, !now);
      translateContinuousBtn.disabled = false;
      if (resp && resp.ok) {
        updateContinuousButtonUi(Boolean(resp.enabled));
      } else {
        translateContinuousBtn.textContent = "Could not update";
        setTimeout(async () => {
          updateContinuousButtonUi(await getContinuous(tab.id));
        }, 1500);
      }
    });
  }

  document.getElementById("openOptions").addEventListener("click", (e) => {
    e.preventDefault();
    const panel = document.getElementById("quickSettings");
    if (panel) {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    }
  });

  // Function to show/hide API key sections based on provider
  function updateApiKeySections(provider, preferredModel) {
    const sections = {
      gemini: document.getElementById("geminiApiSection"),
      openai: document.getElementById("openaiApiSection"),
      deepseek: document.getElementById("deepseekApiSection"),
      groq: document.getElementById("groqApiSection"),
      ollama: document.getElementById("ollamaApiSection"),
    };
    
    Object.keys(sections).forEach(key => {
      if (sections[key]) {
        sections[key].style.display = key === provider ? "block" : "none";
      }
    });
    
    // Update model options based on provider
    const modelOptions = modelSelect.querySelectorAll("option");
    modelOptions.forEach(option => {
      const optionProvider = option.getAttribute("data-provider");
      if (optionProvider) {
        option.style.display = optionProvider === provider ? "block" : "none";
      }
    });
    
    // Set default model for provider
    const defaultModels = {
      gemini: "gemini-1.5-flash",
      openai: "gpt-4o-mini",
      deepseek: "deepseek-chat",
      groq: "meta-llama/llama-4-scout-17b-16e-instruct",
      ollama: "llava:latest",
    };
    
    if (modelSelect && defaultModels[provider]) {
      const isPreferredForProvider = Boolean(
        preferredModel &&
          modelSelect.querySelector(
            `option[data-provider="${provider}"][value="${preferredModel}"]`
          )
      );
      modelSelect.value =
        isPreferredForProvider
          ? preferredModel
          : defaultModels[provider];
    }
  }

  // Load current settings into quick settings form
  if (modelProviderSelect) {
    modelProviderSelect.value = currentSettings.modelProvider || "gemini";
    updateApiKeySections(
      currentSettings.modelProvider || "gemini",
      currentSettings.model || "gemini-1.5-flash"
    );
  }
  
  if (geminiApiKeyInput) geminiApiKeyInput.value = currentSettings.geminiApiKey || "";
  if (openaiApiKeyInput) openaiApiKeyInput.value = currentSettings.openaiApiKey || "";
  if (deepseekApiKeyInput) deepseekApiKeyInput.value = currentSettings.deepseekApiKey || "";
  if (groqApiKeyInput) groqApiKeyInput.value = currentSettings.groqApiKey || "";
  if (ollamaApiKeyInput) ollamaApiKeyInput.value = currentSettings.ollamaApiKey || "";
  if (ollamaBaseUrlInput) {
    ollamaBaseUrlInput.value =
      currentSettings.ollamaBaseUrl || "http://localhost:11434";
  }
  if (sourceSelect) sourceSelect.value = currentSettings.sourceLanguage || "ja";
  if (targetSelect) targetSelect.value = currentSettings.targetLanguage || "en";
  if (modelSelect)
    modelSelect.value = currentSettings.model || "gemini-1.5-flash";
  if (compactOverlayModeInput) {
    compactOverlayModeInput.checked = Boolean(
      currentSettings.compactOverlayMode
    );
  }
  if (replaceTextBlocksInput) {
    replaceTextBlocksInput.checked = Boolean(currentSettings.replaceTextBlocks);
  }
  if (autoTranslateThenEditInput) {
    autoTranslateThenEditInput.checked = Boolean(
      currentSettings.autoTranslateThenEdit
    );
  }
  
  // Add event listener for model provider changes
  if (modelProviderSelect) {
    modelProviderSelect.addEventListener("change", () => {
      updateApiKeySections(modelProviderSelect.value, "");
      const snapshot = {
        modelProvider: modelProviderSelect.value,
        geminiApiKey: geminiApiKeyInput?.value || "",
        openaiApiKey: openaiApiKeyInput?.value || "",
        deepseekApiKey: deepseekApiKeyInput?.value || "",
        groqApiKey: groqApiKeyInput?.value || "",
        ollamaApiKey: ollamaApiKeyInput?.value || "",
      };
      updateApiWarning(snapshot, modelProviderSelect.value);
    });
  }

  // Save settings handler
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const payload = {
        modelProvider: modelProviderSelect?.value || "gemini",
        geminiApiKey: (geminiApiKeyInput?.value || "").trim(),
        openaiApiKey: (openaiApiKeyInput?.value || "").trim(),
        deepseekApiKey: (deepseekApiKeyInput?.value || "").trim(),
        groqApiKey: (groqApiKeyInput?.value || "").trim(),
        ollamaApiKey: (ollamaApiKeyInput?.value || "").trim(),
        ollamaBaseUrl:
          (ollamaBaseUrlInput?.value || "http://localhost:11434").trim(),
        sourceLanguage: sourceSelect?.value || "ja",
        targetLanguage: targetSelect?.value || "en",
        model: modelSelect?.value || "gemini-1.5-flash",
        compactOverlayMode: Boolean(compactOverlayModeInput?.checked),
        replaceTextBlocks: Boolean(replaceTextBlocksInput?.checked),
        autoTranslateThenEdit: Boolean(autoTranslateThenEditInput?.checked),
      };
      await new Promise((resolve) =>
        chrome.storage.local.set(payload, resolve)
      );
      updateApiWarning(payload, payload.modelProvider);
      if (saveStatus) {
        saveStatus.textContent = "Saved";
        setTimeout(() => (saveStatus.textContent = ""), 1200);
      }
    });
  }

}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
