(() => {
  const BUTTON_CLASS = "manga-translator-btn";
  const OVERLAY_CLASS = "manga-translation-overlay";
  const BADGE_CLASS = "manga-translation-badge";

  let isActive = false;
  let settings = {
    apiKey: "",
    sourceLanguage: "ja",
    targetLanguage: "en",
    overlayBgColor: "#ffffff",
    overlayBgOpacity: 95,
    overlayTextColor: "#111111",
  };

  function log(...args) {
    // console.log("[MangaTranslator]", ...args);
  }

  function requestSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (resp) => {
        if (resp) {
          settings = resp;
        }
        resolve(settings);
      });
    });
  }

  function ensureStyles() {
    if (document.getElementById("manga-translator-style")) return;
    const style = document.createElement("style");
    style.id = "manga-translator-style";
    style.textContent = `
      .${BUTTON_CLASS} {
        position: absolute;
        z-index: 2147483646;
        background: linear-gradient(135deg,#667eea,#764ba2);
        color: #fff;
        border: none;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transform: translate(0, -110%);
      }
      .${BUTTON_CLASS}:hover { opacity: 0.95; }
      .${OVERLAY_CLASS} {
        position: absolute;
        z-index: 2147483645;
        background: rgba(255,255,255,0.95);
        color: #111;
        padding: 4px 6px;
        border-radius: 6px;
        border: 1px solid rgba(0,0,0,0.1);
        font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        max-width: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        pointer-events: none;
      }
      .${BADGE_CLASS} {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 2147483647;
        background: rgba(17,17,17,0.85);
        color: #fff;
        padding: 8px 10px;
        border-radius: 999px;
        font-size: 12px;
        box-shadow: 0 6px 14px rgba(0,0,0,0.25);
      }
    `;
    document.documentElement.appendChild(style);
  }

  function createBadge() {
    const badge = document.createElement("div");
    badge.className = BADGE_CLASS;
    badge.textContent = "Manga Translator: On";
    badge.title = "Click to toggle";
    badge.style.cursor = "pointer";
    badge.addEventListener("click", () => {
      isActive = !isActive;
      badge.textContent = isActive
        ? "Manga Translator: On"
        : "Manga Translator: Off";
      if (isActive) scanAllImages();
      else cleanupAll();
    });
    document.documentElement.appendChild(badge);
    return badge;
  }

  function addTranslateButton(img) {
    if (img.dataset.mangaTranslatorHasButton === "1") return;
    img.dataset.mangaTranslatorHasButton = "1";

    const rect = img.getBoundingClientRect();
    const button = document.createElement("button");
    button.className = BUTTON_CLASS;
    button.textContent = "Translate";
    button.style.left = `${Math.max(0, rect.left + window.scrollX + 10)}px`;
    button.style.top = `${Math.max(0, rect.top + window.scrollY + 10)}px`;

    const onPosition = () => {
      const r = img.getBoundingClientRect();
      button.style.left = `${Math.max(0, r.left + window.scrollX + 10)}px`;
      button.style.top = `${Math.max(0, r.top + window.scrollY + 10)}px`;
    };
    const ro = new ResizeObserver(onPosition);
    ro.observe(img);
    window.addEventListener("scroll", onPosition, { passive: true });

    button.addEventListener("click", async (e) => {
      e.stopPropagation();
      button.disabled = true;
      button.textContent = "Translating...";
      try {
        const rect = img.getBoundingClientRect();
        const elementRect = {
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
        };
        const resp = await translateImage(
          img.src,
          elementRect,
          window.devicePixelRatio || 1
        );
        overlayTranslations(img, resp);
      } catch (err) {
        console.warn("translate error", err);
        alert(
          "Translate failed: " + String(err && err.message ? err.message : err)
        );
      } finally {
        button.disabled = false;
        button.textContent = "Translate";
      }
    });

    document.documentElement.appendChild(button);

    const cleanup = () => {
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener("scroll", onPosition);
      button.remove();
    };
    img.addEventListener("remove", cleanup, { once: true });
  }

  function overlayTranslations(img, result) {
    const rect = img.getBoundingClientRect();
    const pageX = rect.left + window.scrollX;
    const pageY = rect.top + window.scrollY;

    // clear previous overlays for this image
    document
      .querySelectorAll(`.${OVERLAY_CLASS}[data-for="${cssEscape(img.src)}"]`)
      .forEach((el) => el.remove());

    const texts =
      (result && result.result && result.result.texts) ||
      (result && result.texts) ||
      [];
    for (const t of texts) {
      if (!t.translation) continue;
      const div = document.createElement("div");
      div.className = OVERLAY_CLASS;
      div.dataset.for = img.src;

      div.textContent = t.translation;
      applyOverlayColorStyles(div);
      const left = pageX + (Number(t.x) / 100) * rect.width;
      const top = pageY + (Number(t.y) / 100) * rect.height;
      const width = (Number(t.width) / 100) * rect.width;
      // height is not used directly; overlays autosize by content

      div.style.left = `${left}px`;
      div.style.top = `${top}px`;
      if (width > 0) div.style.maxWidth = `${Math.max(80, width)}px`;

      document.documentElement.appendChild(div);
    }
  }

  function hexToRgb(hex) {
    if (!hex || typeof hex !== "string") return null;
    let h = hex.trim();
    if (h.startsWith("#")) h = h.slice(1);
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return { r, g, b };
    }
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return { r, g, b };
    }
    return null;
  }

  function applyOverlayColorStyles(element) {
    if (!element) return;
    try {
      const alphaPct = Number(settings.overlayBgOpacity);
      const alpha = isFinite(alphaPct)
        ? Math.max(0, Math.min(100, alphaPct)) / 100
        : 0.95;
      const rgb = hexToRgb(settings.overlayBgColor || "#ffffff") || {
        r: 255,
        g: 255,
        b: 255,
      };
      element.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    } catch {}
    if (settings.overlayTextColor) {
      element.style.color = settings.overlayTextColor;
    }
  }

  function cssEscape(s) {
    try {
      // Modern browsers
      // eslint-disable-next-line no-undef
      return CSS.escape(s);
    } catch {
      return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
    }
  }

  function scanAllImages() {
    if (!isActive) return;
    const images = Array.from(document.images).filter(
      (img) => img.width >= 120 && img.height >= 120
    );
    images.forEach(addTranslateButton);
  }

  function cleanupAll() {
    document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((el) => el.remove());
    Array.from(document.images).forEach((img) => {
      delete img.dataset.mangaTranslatorHasButton;
    });
  }

  function translateImage(url, elementRect, pageScale) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "TRANSLATE_IMAGE",
          payload: {
            url,
            tabId: null, // background will infer from sender if needed
            elementRect,
            pageScale,
            overrideSourceLanguage: settings.sourceLanguage,
            overrideTargetLanguage: settings.targetLanguage,
          },
        },
        (resp) => {
          if (!resp || !resp.ok)
            return reject(
              new Error(resp && resp.error ? resp.error : "Unknown error")
            );
          resolve(resp);
        }
      );
    });
  }

  function addGlobalKeyboardShortcut() {
    window.addEventListener("keydown", (e) => {
      if (e.altKey && e.key.toLowerCase() === "t") {
        isActive = !isActive;
        if (isActive) scanAllImages();
        else cleanupAll();
      }
    });
  }

  async function init() {
    ensureStyles();
    await requestSettings();
    addGlobalKeyboardShortcut();
    createBadge();
    isActive = true;
    scanAllImages();

    const observer = new MutationObserver(() => {
      scanAllImages();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        const keys = [
          "apiKey",
          "sourceLanguage",
          "targetLanguage",
          "overlayBgColor",
          "overlayBgOpacity",
          "overlayTextColor",
        ];
        let needsRestyle = false;
        for (const k of keys) {
          if (changes[k] && Object.prototype.hasOwnProperty.call(changes, k)) {
            settings[k] = changes[k].newValue;
            if (
              k === "overlayBgColor" ||
              k === "overlayBgOpacity" ||
              k === "overlayTextColor"
            ) {
              needsRestyle = true;
            }
          }
        }
        if (needsRestyle) {
          document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((el) => {
            applyOverlayColorStyles(el);
          });
        }
      });
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Listen to background notifications and overlay results from context menu
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    if (message.type === "MT_NOTIFY" && message.payload?.message) {
      alert(message.payload.message);
    }
    if (message.type === "MT_CROP_SCREENSHOT") {
      // Not used here; background requests crop via sendMessage and expects response directly
    }
    if (
      message.type === "MT_OVERLAY_RESULT" &&
      message.payload?.url &&
      message.payload?.result
    ) {
      const img = Array.from(document.images).find(
        (i) => i.src === message.payload.url
      );
      if (img) overlayTranslations(img, message.payload.result);
    }
  });

  // Handler to crop a screenshot data URL to the element rect and return base64
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "MT_CROP_SCREENSHOT") return;
    const { dataUrl, elementRect, pageScale } = message.payload || {};
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Number(pageScale) || 1;
          const sx = Math.max(0, Math.round(elementRect.left * scale));
          const sy = Math.max(0, Math.round(elementRect.top * scale));
          const sw = Math.max(1, Math.round(elementRect.width * scale));
          const sh = Math.max(1, Math.round(elementRect.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          const out = canvas.toDataURL("image/png");
          sendResponse({ ok: true, base64: out.split(",")[1] });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      };
      img.onerror = () =>
        sendResponse({ ok: false, error: "screenshot decode failed" });
      img.src = dataUrl;
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true; // async response
  });
})();
