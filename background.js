// Background service worker (Manifest V3)
// - Stores API key and language settings in chrome.storage.local
// - Fetches images cross-origin and sends them to Gemini for OCR+translation
// - Returns structured results with bounding boxes in percentages

const DEFAULT_SETTINGS = {
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
    chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
      resolve(items);
    });
  });
}

function setSettings(partial) {
  return new Promise((resolve) => {
    chrome.storage.local.set(partial, resolve);
  });
}

async function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fetchImageAsBase64(url) {
  const response = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!response.ok) {
    throw new Error(
      `Image fetch failed: ${response.status} ${response.statusText}`
    );
  }
  const buffer = await response.arrayBuffer();
  const mime = response.headers.get("content-type") || "image/jpeg";
  const base64 = await arrayBufferToBase64(buffer);
  return { base64, mime };
}

function buildPrompt(sourceLanguage, targetLanguage) {
  const src =
    sourceLanguage === "auto"
      ? "the source language (likely Japanese/Korean/Chinese)"
      : sourceLanguage;
  return (
    `You are an OCR+translation assistant for manga/comics images.\n` +
    `- Detect all text in ${src}.\n` +
    `- Translate into ${targetLanguage}.\n` +
    `- Return tight bounding boxes around each text block.\n` +
    `Return STRICT JSON only in this schema (no markdown fences, no extra text):\n` +
    `{"texts":[{"source":"string","translation":"string","x":0,"y":0,"width":0,"height":0}]}` +
    `\nCoordinates are percentages (0-100) of the image from the top-left. Use multiple entries for separate bubbles/lines.`
  );
}

async function callGeminiVision({
  apiKey,
  model,
  base64,
  mime,
  sourceLanguage,
  targetLanguage,
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
  const prompt = buildPrompt(sourceLanguage, targetLanguage);

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mime,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topK: 32,
      topP: 1,
      maxOutputTokens: 4096,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gemini request failed: ${response.status} ${response.statusText} ${text}`
    );
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Try to parse as strict JSON; if the model returned extra text, extract the first JSON object
  let jsonText = content.trim();
  const match = jsonText.match(/\{[\s\S]*\}/);
  if (match) jsonText = match[0];

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    // Fallback to a minimal schema if parsing fails
    parsed = { texts: [] };
  }

  if (!parsed || !Array.isArray(parsed.texts)) {
    parsed = { texts: [] };
  }

  // Normalize items and clamp values
  parsed.texts = parsed.texts.map((t) => ({
    source: String(t.source || t.japanese || t.original || ""),
    translation: String(t.translation || t.english || t.translated || ""),
    x: Math.max(0, Math.min(100, Number(t.x ?? 0))),
    y: Math.max(0, Math.min(100, Number(t.y ?? 0))),
    width: Math.max(0, Math.min(100, Number(t.width ?? 20))),
    height: Math.max(0, Math.min(100, Number(t.height ?? 10))),
  }));

  return parsed;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "GET_SETTINGS") {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.type === "SET_SETTINGS") {
    setSettings(message.payload || {}).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "TRANSLATE_IMAGE") {
    (async () => {
      try {
        const settings = await getSettings();
        if (!settings.apiKey) {
          throw new Error(
            "Missing Gemini API key. Set it in the extension options."
          );
        }

        const {
          url,
          inlineBase64,
          inlineMime,
          tabId,
          elementRect,
          pageScale,
          overrideSourceLanguage,
          overrideTargetLanguage,
        } = message.payload;
        const resolvedTabId = tabId || (sender && sender.tab && sender.tab.id);

        let base64, mime;
        if (inlineBase64) {
          base64 = inlineBase64;
          mime = inlineMime || "image/png";
        } else {
          try {
            ({ base64, mime } = await fetchImageAsBase64(url));
          } catch (e) {
            if (resolvedTabId && elementRect) {
              const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
                format: "png",
              });
              const cropResp = await chrome.tabs.sendMessage(resolvedTabId, {
                type: "MT_CROP_SCREENSHOT",
                payload: { dataUrl, elementRect, pageScale },
              });
              if (!cropResp || !cropResp.ok) throw e;
              base64 = cropResp.base64;
              mime = "image/png";
            } else {
              throw e;
            }
          }
        }
        const result = await callGeminiVision({
          apiKey: settings.apiKey,
          model: settings.model || DEFAULT_SETTINGS.model,
          base64,
          mime,
          sourceLanguage:
            overrideSourceLanguage ||
            settings.sourceLanguage ||
            DEFAULT_SETTINGS.sourceLanguage,
          targetLanguage:
            overrideTargetLanguage ||
            settings.targetLanguage ||
            DEFAULT_SETTINGS.targetLanguage,
        });
        sendResponse({ ok: true, result });
      } catch (err) {
        sendResponse({
          ok: false,
          error: String(err && err.message ? err.message : err),
        });
      }
    })();
    return true; // keep the message channel open for async
  }
});

// Context menu: right-click → Translate this image
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: "translate-image",
      title: "Translate image with Gemini",
      contexts: ["image"],
    });
  } catch {}
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "translate-image" || !info.srcUrl || !tab?.id) return;
  try {
    const settings = await getSettings();
    if (!settings.apiKey) {
      await chrome.tabs.sendMessage(tab.id, {
        type: "MT_NOTIFY",
        payload: { message: "Set Gemini API key in extension options" },
      });
      return;
    }
    const { base64, mime } = await fetchImageAsBase64(info.srcUrl);
    const result = await callGeminiVision({
      apiKey: settings.apiKey,
      model: settings.model || DEFAULT_SETTINGS.model,
      base64,
      mime,
      sourceLanguage:
        settings.sourceLanguage || DEFAULT_SETTINGS.sourceLanguage,
      targetLanguage:
        settings.targetLanguage || DEFAULT_SETTINGS.targetLanguage,
    });
    await chrome.tabs.sendMessage(tab.id, {
      type: "MT_OVERLAY_RESULT",
      payload: { url: info.srcUrl, result },
    });
  } catch (err) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "MT_NOTIFY",
        payload: {
          message: `Translate failed: ${String(
            err && err.message ? err.message : err
          )}`,
        },
      });
    } catch {}
  }
});
