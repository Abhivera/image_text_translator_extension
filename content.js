(() => {
  const BUTTON_CLASS = "manga-translator-btn";
  const OVERLAY_CLASS = "manga-translation-overlay";
  const BADGE_CLASS = "manga-translation-badge";
  const HUD_ID = "manga-translation-hud";

  let isTabEnabled = false;
  let isBulkTranslating = false;
  let bulkAbort = false;
  let isCurrentTabActive = true;
  /** Session-only: translate images as they enter viewport while scrolling */
  let isContinuousMode = false;
  let scrollIntersectionObserver = null;
  let domMutationTimer = null;
  const CONCURRENCY = 3;
  let lazyQueue = [];
  let lazyQueueSet = new WeakSet();
  let lazyActiveWorkers = 0;

  let settings = {
    modelProvider: "gemini",
    geminiApiKey: "",
    openaiApiKey: "",
    deepseekApiKey: "",
    groqApiKey: "",
    ollamaApiKey: "",
    ollamaBaseUrl: "http://localhost:11434",
    model: "gemini-1.5-flash",
    sourceLanguage: "ja",
    targetLanguage: "en",
    compactOverlayMode: false,
    replaceTextBlocks: true,
    autoTranslateThenEdit: true,
    autoTranslateAll: false,
    enableByDefault: false,
  };

  const urlToResultCache = new Map();
  const editedTranslationsByImage = new Map();

  function log(...args) {
    // console.log("[MangaTranslator]", ...args);
  }

  function notifyActiveChanged() {
    try {
      chrome.runtime.sendMessage({
        type: "SET_TAB_ENABLED",
        enabled: isTabEnabled,
      });
    } catch {}
  }

  function requestTabEnabled() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_TAB_ENABLED" }, (resp) => {
        if (resp && resp.ok) {
          isTabEnabled = resp.enabled;
        }
        resolve(isTabEnabled);
      });
    });
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
        background: transparent;
        color: inherit;
        border: none;
        border-radius: 0;
        padding: 0;
        font-size: 12px;
        cursor: pointer;
        box-shadow: none;
        transform: translate(0, -110%);
      }
      .${BUTTON_CLASS}:hover { opacity: 0.95; }
      .${BUTTON_CLASS} .mt-icon {
        width: 64px;
        height: 64px;
        display: block;
      }
      .${BUTTON_CLASS} .mt-icon.mt-rotating {
        animation: mt-spin 0.8s linear infinite;
      }
      .${OVERLAY_CLASS} {
        position: absolute;
        z-index: 2147483645;
        background: rgba(255,255,255,0.92);
        color: #111;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(15, 23, 42, 0.18);
        font: 650 13px/1.35 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        letter-spacing: 0.01em;
        max-width: 60%;
        box-shadow: 0 6px 20px rgba(0,0,0,0.22);
        backdrop-filter: blur(1.5px);
        -webkit-backdrop-filter: blur(1.5px);
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
        pointer-events: none;
        opacity: 0;
        transform: translateY(3px) scale(0.985);
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .${OVERLAY_CLASS}.mt-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .${OVERLAY_CLASS}.mt-compact {
        padding: 4px 6px;
        border-radius: 7px;
        font: 600 11px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        max-width: 48%;
      }
      .${OVERLAY_CLASS}.mt-overlay-fallback {
        left: 0;
        right: 0;
        margin-left: auto;
        margin-right: auto;
        max-width: min(92vw, 560px);
      }
      .${OVERLAY_CLASS}.mt-replace {
        border-radius: 6px;
        padding: 4px 6px;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      .${OVERLAY_CLASS}.mt-editable {
        pointer-events: auto;
        cursor: text;
        outline: none;
      }
      .${OVERLAY_CLASS}.mt-editable:focus {
        box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.7);
      }
      @media (prefers-reduced-motion: reduce) {
        .${OVERLAY_CLASS} {
          transition: none;
          transform: none;
        }
      }
      .${BADGE_CLASS} {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 2147483647;
        background: rgba(81, 66, 66, 0.85);
        color: #fff;
        padding: 8px 10px;
        border-radius: 999px;
        font-size: 12px;
        box-shadow: 0 6px 14px rgba(0,0,0,0.25);
      }
      #${HUD_ID} {
        position: fixed;
        right: 14px;
        bottom: 56px;
        z-index: 2147483647;
        background: rgba(17,17,17,0.92);
        color: #fff;
        padding: 10px 12px;
        border-radius: 12px;
        font-size: 12px;
        box-shadow: 0 6px 14px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 200px;
      }
      #${HUD_ID} .mt-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: mt-spin 0.8s linear infinite;
      }
      @keyframes mt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      #${HUD_ID} .mt-cancel {
        margin-left: auto;
        background: transparent;
        color: #fff;
        border: 1px solid rgba(255,255,255,0.35);
        border-radius: 999px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 12px;
      }
      #${HUD_ID} .mt-cancel:hover { background: rgba(255,255,255,0.1); }
    `;
    document.documentElement.appendChild(style);
  }

  function createBadge() {
    const badge = document.createElement("div");
    badge.className = BADGE_CLASS;
    badge.textContent = isTabEnabled ? "Translator: On" : "Translator: Off";
    badge.title = "Click to toggle";
    badge.style.cursor = "pointer";
    badge.addEventListener("click", () => {
      isTabEnabled = !isTabEnabled;
      notifyActiveChanged();
      badge.textContent = isTabEnabled ? "Translator: On" : "Translator: Off";
      if (isTabEnabled) {
        scanAllImages();
        if (isContinuousMode) observeEligibleImagesForScroll();
      } else cleanupAll();
    });
    document.documentElement.appendChild(badge);
    return badge;
  }

  function getOrCreateHud(mode) {
    let hud = document.getElementById(HUD_ID);
    if (hud) {
      hud.dataset.mtMode = mode || "once";
      setHudMode(mode || "once");
      return hud;
    }
    hud = document.createElement("div");
    hud.id = HUD_ID;
    hud.dataset.mtMode = mode || "once";
    hud.innerHTML = `
      <div class="mt-spinner" aria-hidden="true"></div>
      <div class="mt-text">Preparing…</div>
      <button class="mt-cancel" type="button">Cancel</button>
    `;
    hud.querySelector(".mt-cancel").addEventListener("click", () => {
      const m = hud.dataset.mtMode;
      if (m === "scroll") {
        disableContinuousMode();
      } else {
        bulkAbort = true;
      }
    });
    document.documentElement.appendChild(hud);
    setHudMode(mode || "once");
    return hud;
  }

  function setHudMode(mode) {
    const hud = document.getElementById(HUD_ID);
    if (hud) hud.dataset.mtMode = mode;
    const btn = hud?.querySelector(".mt-cancel");
    if (btn) btn.textContent = mode === "scroll" ? "Stop" : "Cancel";
  }

  function updateHud(done, total) {
    const hud = getOrCreateHud("once");
    const txt = hud.querySelector(".mt-text");
    if (txt) txt.textContent = `Translating images… ${done}/${total}`;
  }

  function updateScrollHud(message) {
    const hud = getOrCreateHud("scroll");
    setHudMode("scroll");
    const txt = hud.querySelector(".mt-text");
    if (txt) txt.textContent = message || "Translating as you scroll…";
    const spin = hud.querySelector(".mt-spinner");
    if (spin) spin.style.display = lazyQueue.length > 0 ? "block" : "none";
  }

  function hideHud() {
    const hud = document.getElementById(HUD_ID);
    if (hud) hud.remove();
  }

  async function translateSingleImage(img) {
    let result;
    const cached = urlToResultCache.get(img.src);
    if (cached) {
      result = cached;
    } else {
      const rect = img.getBoundingClientRect();
      const elementRect = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
      result = await translateImage(
        img.src,
        elementRect,
        window.devicePixelRatio || 1
      );
      urlToResultCache.set(img.src, result);
    }
    overlayTranslations(img, result, {
      editable: Boolean(settings.autoTranslateThenEdit),
    });
    img.dataset.mangaTranslatorTranslated = "1";
  }

  function disconnectScrollObserver() {
    if (scrollIntersectionObserver) {
      scrollIntersectionObserver.disconnect();
      scrollIntersectionObserver = null;
    }
  }

  function ensureScrollObserver() {
    if (scrollIntersectionObserver) return scrollIntersectionObserver;
    scrollIntersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target;
          if (!(img instanceof HTMLImageElement)) continue;
          try {
            scrollIntersectionObserver.unobserve(img);
          } catch {}
          enqueueLazyTranslate(img);
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.05 }
    );
    return scrollIntersectionObserver;
  }

  function observeEligibleImagesForScroll() {
    if (!isContinuousMode || !isTabEnabled || !isCurrentTabActive) return;
    const io = ensureScrollObserver();
    eligibleImages().forEach((img) => {
      if (img.dataset.mangaTranslatorTranslated === "1") return;
      try {
        io.observe(img);
      } catch {}
    });
  }

  function enqueueLazyTranslate(img) {
    if (!isContinuousMode || !isTabEnabled || !isCurrentTabActive) return;
    if (!img || !img.isConnected) return;
    if (img.dataset.mangaTranslatorTranslated === "1") return;
    if (img.width < 120 || img.height < 120) return;
    if (lazyQueueSet.has(img)) return;
    lazyQueueSet.add(img);
    lazyQueue.push(img);
    updateScrollHud();
    pumpLazyQueue();
  }

  function pumpLazyQueue() {
    while (
      lazyActiveWorkers < CONCURRENCY &&
      lazyQueue.length &&
      isContinuousMode &&
      isTabEnabled &&
      isCurrentTabActive
    ) {
      const img = lazyQueue.shift();
      if (img) {
        try {
          lazyQueueSet.delete(img);
        } catch {}
      }
      if (!img || !img.isConnected) continue;
      lazyActiveWorkers += 1;
      translateSingleImage(img)
        .catch((err) => console.warn("lazy translate error", err))
        .finally(() => {
          lazyActiveWorkers -= 1;
          if (
            isContinuousMode &&
            isTabEnabled &&
            isCurrentTabActive &&
            img.isConnected &&
            img.dataset.mangaTranslatorTranslated !== "1"
          ) {
            try {
              ensureScrollObserver().observe(img);
            } catch {}
          }
          updateScrollHud();
          pumpLazyQueue();
        });
    }
  }

  function disableContinuousMode() {
    isContinuousMode = false;
    lazyQueue = [];
    lazyQueueSet = new WeakSet();
    disconnectScrollObserver();
    const hud = document.getElementById(HUD_ID);
    if (hud && hud.dataset.mtMode === "scroll") hideHud();
  }

  function enableContinuousMode() {
    if (!isTabEnabled || !isCurrentTabActive) return;
    isContinuousMode = true;
    lazyQueue = [];
    lazyQueueSet = new WeakSet();
    getOrCreateHud("scroll");
    setHudMode("scroll");
    updateScrollHud("Translating as you scroll…");
    observeEligibleImagesForScroll();
  }

  function addTranslateButton(img) {
    if (img.dataset.mangaTranslatorHasButton === "1") return;
    img.dataset.mangaTranslatorHasButton = "1";

    const rect = img.getBoundingClientRect();
    const button = document.createElement("button");
    button.className = BUTTON_CLASS;
    button.setAttribute("aria-label", "Translate");
    button.title = "Translate";
    const icon = document.createElement("img");
    icon.className = "mt-icon";
    icon.src = chrome.runtime.getURL("icons/translate_icon_32.svg");
    icon.alt = "Translate";
    icon.onerror = () => {
      icon.remove();
      button.textContent = "Translate";
      button.style.padding = "6px 10px";
      button.style.borderRadius = "8px";
      button.style.background = "rgba(2, 132, 199, 0.9)";
      button.style.color = "#fff";
      button.style.font = "600 12px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    };
    button.appendChild(icon);
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
      icon.classList.add("mt-rotating");
      try {
        await translateSingleImage(img);
      } catch (err) {
        console.warn("translate error", err);
        alert(
          "Translate failed: " + String(err && err.message ? err.message : err)
        );
      } finally {
        button.disabled = false;
        icon.classList.remove("mt-rotating");
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

  function getEditKey(imgSrc, index) {
    return `${imgSrc}::${index}`;
  }

  function applyEditableBehavior(div, img, index, textItem) {
    if (!div) return;
    const key = getEditKey(img.src, index);
    const initialText = String(div.textContent || "").trim();
    const saved = editedTranslationsByImage.get(key);
    if (saved) div.textContent = saved;
    div.classList.add("mt-editable");
    div.setAttribute("contenteditable", "plaintext-only");
    div.setAttribute("spellcheck", "true");
    div.title = "Click to edit translation";

    const save = () => {
      const next = String(div.textContent || "").trim();
      if (!next) {
        div.textContent = editedTranslationsByImage.get(key) || initialText;
        return;
      }
      editedTranslationsByImage.set(key, next);
      if (textItem && typeof textItem === "object") {
        textItem.translation = next;
      }
    };

    div.addEventListener("blur", save);
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        div.blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        div.textContent = editedTranslationsByImage.get(key) || initialText;
        div.blur();
      }
    });
  }

  function overlayTranslations(img, result, options = {}) {
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
    const imagePadding = 6;
    let fallbackRow = 0;
    const placedRects = [];

    function intersects(a, b) {
      return (
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top
      );
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function resolveCollision(initialLeft, initialTop, boxWidth, boxHeight) {
      const minLeft = pageX + imagePadding;
      const maxLeft = pageX + Math.max(imagePadding, rect.width - imagePadding - boxWidth);
      const minTop = pageY + imagePadding;
      const maxTop = pageY + Math.max(imagePadding, rect.height - imagePadding - boxHeight);

      let left = clamp(initialLeft, minLeft, maxLeft);
      let top = clamp(initialTop, minTop, maxTop);
      let candidate = { left, top, right: left + boxWidth, bottom: top + boxHeight };

      if (!placedRects.some((r) => intersects(r, candidate))) return candidate;

      const yStep = settings.compactOverlayMode ? 14 : 20;
      const xStep = settings.compactOverlayMode ? 12 : 18;
      for (let pass = 0; pass < 2; pass++) {
        for (let attempt = 0; attempt < 28; attempt++) {
          if (pass === 0) {
            top = clamp(top + yStep, minTop, maxTop);
          } else {
            left = clamp(left + xStep, minLeft, maxLeft);
            top = clamp(initialTop + (attempt % 8) * yStep, minTop, maxTop);
          }
          candidate = { left, top, right: left + boxWidth, bottom: top + boxHeight };
          if (!placedRects.some((r) => intersects(r, candidate))) return candidate;
        }
      }
      return candidate;
    }

    for (const [index, t] of texts.entries()) {
      if (!t.translation) continue;
      const div = document.createElement("div");
      div.className = OVERLAY_CLASS;
      div.dataset.for = img.src;
      div.dataset.index = String(index);
      if (settings.compactOverlayMode) div.classList.add("mt-compact");

      const editKey = getEditKey(img.src, index);
      const editedTranslation = editedTranslationsByImage.get(editKey);
      div.textContent = editedTranslation || t.translation;
      applyOverlayColorStyles(div, img, t);
      const hasXY = Number.isFinite(Number(t.x)) && Number.isFinite(Number(t.y));
      const widthPct = Number(t.width);
      const heightPct = Number(t.height);
      const preferredLeft = hasXY
        ? pageX + (Number(t.x) / 100) * rect.width
        : pageX + imagePadding;
      const preferredTop = hasXY
        ? pageY + (Number(t.y) / 100) * rect.height
        : pageY + imagePadding + fallbackRow * 30;
      const width = Number.isFinite(widthPct) ? (widthPct / 100) * rect.width : 0;
      const height = Number.isFinite(heightPct) ? (heightPct / 100) * rect.height : 0;
      const replaceMode =
        settings.replaceTextBlocks && hasXY && width > 0 && height > 0;

      const maxWidthPx = width > 0 ? Math.max(100, width) : Math.max(160, rect.width * 0.6);
      if (replaceMode) {
        div.classList.add("mt-replace");
        const paddedWidth = Math.max(64, width + 12);
        const paddedHeight = Math.max(28, height + 10);
        div.style.maxWidth = `${Math.min(
          rect.width - imagePadding * 2,
          paddedWidth
        )}px`;
        div.style.width = `${Math.min(rect.width - imagePadding * 2, paddedWidth)}px`;
        div.style.minHeight = `${paddedHeight}px`;
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.justifyContent = "center";
        div.style.textAlign = "center";
        applyReplacementStyles(div, img, t);
      } else {
        div.style.maxWidth = `${Math.min(rect.width - imagePadding * 2, maxWidthPx)}px`;
      }

      if (options.editable) {
        applyEditableBehavior(div, img, index, t);
      }

      // Measure then position with collision-avoidance.
      div.style.visibility = "hidden";
      document.documentElement.appendChild(div);
      const measured = div.getBoundingClientRect();
      const positioned = replaceMode
        ? {
            left: clamp(preferredLeft, pageX + imagePadding, pageX + Math.max(imagePadding, rect.width - imagePadding - Math.max(40, measured.width))),
            top: clamp(preferredTop, pageY + imagePadding, pageY + Math.max(imagePadding, rect.height - imagePadding - Math.max(20, measured.height))),
            right: 0,
            bottom: 0,
          }
        : resolveCollision(
            preferredLeft,
            preferredTop,
            Math.max(40, measured.width),
            Math.max(20, measured.height)
          );
      div.style.left = `${positioned.left}px`;
      div.style.top = `${positioned.top}px`;
      if (!replaceMode) {
        placedRects.push(positioned);
      }

      if (!hasXY) {
        div.classList.add("mt-overlay-fallback");
        fallbackRow += 1;
      }
      div.style.visibility = "visible";
      requestAnimationFrame(() => div.classList.add("mt-visible"));
    }
  }

  function estimateImageLuminance(img, xPct, yPct) {
    try {
      if (!img || !img.naturalWidth || !img.naturalHeight) return null;
      const cx = Math.max(
        1,
        Math.min(img.naturalWidth - 2, Math.round((xPct / 100) * img.naturalWidth))
      );
      const cy = Math.max(
        1,
        Math.min(img.naturalHeight - 2, Math.round((yPct / 100) * img.naturalHeight))
      );
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, cx - 1, cy - 1, 2, 2, 0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      return 0.2126 * data[0] + 0.7152 * data[1] + 0.0722 * data[2];
    } catch {
      return null;
    }
  }

  function applyOverlayColorStyles(element, img, textItem) {
    if (!element) return;
    const centerX = Number.isFinite(Number(textItem?.x))
      ? Number(textItem.x) + Number(textItem.width || 0) / 2
      : 50;
    const centerY = Number.isFinite(Number(textItem?.y))
      ? Number(textItem.y) + Number(textItem.height || 0) / 2
      : 50;
    const luminance = estimateImageLuminance(img, centerX, centerY);
    const useDarkOverlay =
      luminance == null
        ? !window.matchMedia("(prefers-color-scheme: dark)").matches
        : luminance > 145;

    if (useDarkOverlay) {
      element.style.background = "rgba(15, 23, 42, 0.84)";
      element.style.color = "#f8fafc";
      element.style.borderColor = "rgba(148, 163, 184, 0.35)";
    } else {
      element.style.background = "rgba(248, 250, 252, 0.9)";
      element.style.color = "#0f172a";
      element.style.borderColor = "rgba(15, 23, 42, 0.24)";
    }
  }

  function applyReplacementStyles(element, img, textItem) {
    if (!element) return;
    const centerX = Number.isFinite(Number(textItem?.x))
      ? Number(textItem.x) + Number(textItem.width || 0) / 2
      : 50;
    const centerY = Number.isFinite(Number(textItem?.y))
      ? Number(textItem.y) + Number(textItem.height || 0) / 2
      : 50;
    const luminance = estimateImageLuminance(img, centerX, centerY);
    const useDarkText = luminance == null ? true : luminance > 145;
    // Opaque replacement style to hide source text under the box.
    element.style.background = useDarkText ? "#f8fafc" : "#0f172a";
    element.style.color = useDarkText ? "#0f172a" : "#f8fafc";
    element.style.borderColor = useDarkText ? "#cbd5e1" : "#334155";
    element.style.opacity = "1";
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

  function eligibleImages() {
    return Array.from(document.images).filter(
      (img) => img.width >= 120 && img.height >= 120
    );
  }

  function scanAllImages() {
    if (!isTabEnabled || !isCurrentTabActive) return;
    eligibleImages().forEach(addTranslateButton);
  }

  function cleanupAll() {
    disableContinuousMode();
    bulkAbort = true;
    document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((el) => el.remove());
    Array.from(document.images).forEach((img) => {
      delete img.dataset.mangaTranslatorHasButton;
      delete img.dataset.mangaTranslatorTranslated;
    });
    hideHud();
    isBulkTranslating = false;
    bulkAbort = false;
    lazyActiveWorkers = 0;
  }

  /** One-shot: translate all eligible images currently in the document (this viewport load only). */
  async function translateOnce() {
    if (!isTabEnabled || !isCurrentTabActive) return;
    if (isBulkTranslating) return;
    isBulkTranslating = true;
    bulkAbort = false;

    const list = eligibleImages();
    const targets = list.filter(
      (img) => img.dataset.mangaTranslatorTranslated !== "1"
    );
    if (targets.length === 0) {
      isBulkTranslating = false;
      bulkAbort = false;
      try {
        alert("No translatable images found on this page.");
      } catch {}
      return;
    }

    getOrCreateHud("once");
    setHudMode("once");
    updateHud(0, targets.length);

    let done = 0;
    let idx = 0;

    const runWorker = async () => {
      while (!bulkAbort) {
        const i = idx++;
        if (i >= targets.length) break;
        const img = targets[i];
        try {
          await translateSingleImage(img);
        } catch (err) {
          console.warn("translate-once error", err);
        } finally {
          done += 1;
          updateHud(done, targets.length);
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => runWorker());
    await Promise.all(workers);

    hideHud();
    isBulkTranslating = false;
    bulkAbort = false;
    if (isContinuousMode && isTabEnabled && isCurrentTabActive) {
      getOrCreateHud("scroll");
      setHudMode("scroll");
      updateScrollHud("Translating as you scroll…");
      observeEligibleImagesForScroll();
    }
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
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
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
        isTabEnabled = !isTabEnabled;
        notifyActiveChanged();
        const badge = document.querySelector(`.${BADGE_CLASS}`);
        if (badge) {
          badge.textContent = isTabEnabled
            ? "Translator: On"
            : "Translator: Off";
        }
        if (isTabEnabled && isCurrentTabActive) {
          scanAllImages();
          if (isContinuousMode) observeEligibleImagesForScroll();
        } else cleanupAll();
      }
    });
  }

  function handleTabVisibilityChange() {
    isCurrentTabActive = !document.hidden;
    if (!isCurrentTabActive) {
      disconnectScrollObserver();
      bulkAbort = true;
      lazyQueue = [];
      lazyQueueSet = new WeakSet();
      const hud = document.getElementById(HUD_ID);
      if (hud && hud.dataset.mtMode === "scroll") hideHud();
      isBulkTranslating = false;
      bulkAbort = false;
    } else if (isTabEnabled) {
      scanAllImages();
      if (isContinuousMode) {
        getOrCreateHud("scroll");
        setHudMode("scroll");
        updateScrollHud("Translating as you scroll…");
        observeEligibleImagesForScroll();
      }
    }
  }

  async function init() {
    ensureStyles();
    await requestSettings();
    await requestTabEnabled();
    addGlobalKeyboardShortcut();

    // Listen for tab visibility changes
    document.addEventListener("visibilitychange", handleTabVisibilityChange);

    notifyActiveChanged();
    if (isTabEnabled && isCurrentTabActive) {
      scanAllImages();
    }

    const observer = new MutationObserver(() => {
      if (domMutationTimer) clearTimeout(domMutationTimer);
      domMutationTimer = setTimeout(() => {
        domMutationTimer = null;
        scanAllImages();
        if (isContinuousMode && isTabEnabled && isCurrentTabActive) {
          observeEligibleImagesForScroll();
        }
      }, 250);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        const keys = [
          "modelProvider",
          "geminiApiKey",
          "openaiApiKey",
          "deepseekApiKey",
          "groqApiKey",
          "ollamaApiKey",
          "ollamaBaseUrl",
          "model",
          "sourceLanguage",
          "targetLanguage",
          "compactOverlayMode",
          "replaceTextBlocks",
          "autoTranslateThenEdit",
          "enableByDefault",
        ];
        let needsRestyle = false;
        for (const k of keys) {
          if (changes[k] && Object.prototype.hasOwnProperty.call(changes, k)) {
            settings[k] = changes[k].newValue;
            if (
              k === "compactOverlayMode" ||
              k === "replaceTextBlocks" ||
              k === "autoTranslateThenEdit"
            ) {
              needsRestyle = true;
            }
          }
        }
        if (needsRestyle) {
          document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((el) => {
            const url = el.dataset.for;
            const img = url
              ? Array.from(document.images).find((i) => i.src === url)
              : null;
            if (settings.compactOverlayMode) el.classList.add("mt-compact");
            else el.classList.remove("mt-compact");
            if (img) {
              applyOverlayColorStyles(el, img, {
                x: 50,
                y: 50,
                width: 10,
                height: 10,
              });
            }
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
      if (img) {
        overlayTranslations(img, message.payload.result, {
          editable: Boolean(settings.autoTranslateThenEdit),
        });
      }
    }
    if (message.type === "MT_TRANSLATE_ALL_NOW") {
      translateOnce();
    }
  });

  // Per-tab activation handlers for popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;
    if (message.type === "MT_GET_ACTIVE") {
      sendResponse({ ok: true, active: isTabEnabled });
      return;
    }
    if (message.type === "MT_GET_CONTINUOUS") {
      sendResponse({ ok: true, enabled: isContinuousMode });
      return;
    }
    if (message.type === "MT_SET_CONTINUOUS") {
      const want = Boolean(message.enabled);
      if (want && (!isTabEnabled || !isCurrentTabActive)) {
        sendResponse({
          ok: false,
          enabled: false,
          error: "Turn Translator on for this tab first.",
        });
        return;
      }
      if (want) enableContinuousMode();
      else disableContinuousMode();
      sendResponse({ ok: true, enabled: isContinuousMode });
      return;
    }
    if (message.type === "MT_TRANSLATE_ONCE") {
      if (!isTabEnabled || !isCurrentTabActive) {
        sendResponse({ ok: false, error: "Translator is off or tab inactive." });
        return;
      }
      translateOnce();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "MT_SET_ACTIVE") {
      const desired = Boolean(message.active);
      if (desired !== isTabEnabled) {
        isTabEnabled = desired;
        notifyActiveChanged();
        const badge = document.querySelector(`.${BADGE_CLASS}`);
        if (badge) {
          badge.textContent = isTabEnabled
            ? "Translator: On"
            : "Translator: Off";
        }
        if (isTabEnabled && isCurrentTabActive) {
          scanAllImages();
          if (isContinuousMode) observeEligibleImagesForScroll();
        } else {
          cleanupAll();
        }
      }
      sendResponse({ ok: true, active: isTabEnabled });
      return;
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
