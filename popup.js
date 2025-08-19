const DEFAULTS = {
  apiKey: "",
  sourceLanguage: "ja",
  targetLanguage: "en",
  model: "gemini-1.5-flash",
  overlayBgColor: "#ffffff",
  overlayBgOpacity: 95,
  overlayTextColor: "#111111",
  autoTranslateAll: false,
  enableByDefault: false,
};

function getActive(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: "MT_GET_ACTIVE" }, (resp) => {
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
          resolve(Boolean(resp && resp.active));
        }
      );
    } catch {
      resolve(false);
    }
  });
}

function sendTranslateAll(tabId) {
  chrome.tabs
    .sendMessage(tabId, { type: "MT_TRANSLATE_ALL_NOW" })
    .catch(() => {});
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const toggleBtn = document.getElementById("toggleActive");
  const translateAllBtn = document.getElementById("translateAll");
  const apiKeyInput = document.getElementById("apiKey");
  const sourceSelect = document.getElementById("sourceLanguage");
  const targetSelect = document.getElementById("targetLanguage");
  const modelSelect = document.getElementById("model");
  const bgInput = document.getElementById("overlayBgColor");
  const textInput = document.getElementById("overlayTextColor");
  const opacityInput = document.getElementById("overlayBgOpacity");
  const opacityValue = document.getElementById("opacityValue");
  const saveBtn = document.getElementById("saveSettings");
  const saveStatus = document.getElementById("saveStatus");

  if (!tab?.id) {
    toggleBtn.disabled = true;
    translateAllBtn.disabled = true;
  } else {
    const current = await getActive(tab.id);
toggleBtn.textContent = current ? "Translator: On" : "Translator: Off";
toggleBtn.classList.remove("btn-red", "btn-green");
toggleBtn.classList.add(current ? "btn-green" : "btn-red");

toggleBtn.addEventListener("click", async () => {
  const now = await getActive(tab.id);
  const next = !now;
  const final = await setActive(tab.id, next);

  toggleBtn.textContent = final ? "Translator: On" : "Translator: Off";
  toggleBtn.classList.remove("btn-red", "btn-green");
  toggleBtn.classList.add(final ? "btn-green" : "btn-red");

  window.close();
});


    translateAllBtn.addEventListener("click", () => {
      sendTranslateAll(tab.id);
      window.close();
    });
  }

  document.getElementById("openOptions").addEventListener("click", (e) => {
    e.preventDefault();
    const panel = document.getElementById("quickSettings");
    if (panel) {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    }
  });

  // Load current settings into quick settings form
  const currentSettings = await new Promise((resolve) =>
    chrome.storage.local.get(DEFAULTS, (items) => resolve(items))
  );
  if (apiKeyInput) apiKeyInput.value = currentSettings.apiKey || "";
  if (sourceSelect) sourceSelect.value = currentSettings.sourceLanguage || "ja";
  if (targetSelect) targetSelect.value = currentSettings.targetLanguage || "en";
  if (modelSelect)
    modelSelect.value = currentSettings.model || "gemini-1.5-flash";
  if (bgInput) bgInput.value = currentSettings.overlayBgColor || "#ffffff";
  if (textInput)
    textInput.value = currentSettings.overlayTextColor || "#111111";
  if (opacityInput)
    opacityInput.value = String(
      typeof currentSettings.overlayBgOpacity === "number"
        ? currentSettings.overlayBgOpacity
        : 95
    );
  if (opacityValue && opacityInput) {
    opacityValue.textContent = `${opacityInput.value}%`;
  }

  // Save settings handler
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const payload = {
        apiKey: (apiKeyInput?.value || "").trim(),
        sourceLanguage: sourceSelect?.value || "ja",
        targetLanguage: targetSelect?.value || "en",
        model: modelSelect?.value || "gemini-1.5-flash",
        overlayBgColor: bgInput?.value || "#ffffff",
        overlayTextColor: textInput?.value || "#111111",
        overlayBgOpacity: parseInt(opacityInput?.value || "95", 10),
      };
      await new Promise((resolve) =>
        chrome.storage.local.set(payload, resolve)
      );
      if (saveStatus) {
        saveStatus.textContent = "Saved";
        setTimeout(() => (saveStatus.textContent = ""), 1200);
      }
    });
  }

  if (opacityInput && opacityValue) {
    opacityInput.addEventListener("input", () => {
      opacityValue.textContent = `${opacityInput.value}%`;
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
