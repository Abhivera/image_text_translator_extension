## Image Text Translator

Translate text on images (e.g., manga/comics) directly on webpages using LLM. Adds a floating toggle, context menu entry, and overlays translated text boxes on top of images.

### Features

- **Inline translate button**: Hover/scroll near images and click "Translate" to OCR + translate.
- **Keyboard toggle**: Alt+T to enable/disable scanning on the current page.
- **Context menu**: Right‑click an image → "Translate image with Gemini".
- **Configurable**: Source/target language, model, overlay background/text colors, and opacity.
- **On‑page overlays**: Translations are drawn with bounding boxes positioned over detected text.

## Installation (Chromium browsers)

### Chrome / Edge (Unpacked)

1. Open the browser and go to `chrome://extensions/` (Edge: `edge://extensions/`).
2. Enable "Developer mode" (top right).
3. Click "Load unpacked".
4. Select the folder that contains `manifest.json` (this repo's `translator_image` directory).

After loading, you should see the extension icon in the toolbar.

## Setup

1. Click the extension icon to open the popup, or open Options.
2. **Enter your  API key**.
   -Eg, Get one from Google AI Studio: `https://makersuite.google.com/app/apikey`.
3. Choose source and target languages.
4. Optionally select model (`gemini-1.5-flash` or `gemini-1.5-pro`) and adjust overlay styles.
5. Click **Save**.

## Usage

- **Toggle On/Off**: Use the popup button or press Alt+T.
- **Translate an image**: When active, click the floating "Translate" button that appears near large images.
- **Right‑click translate**: Context menu → "Translate image with Gemini" works even if auto‑scan fails.
- **Overlays**: Translations render as small boxes. Colors/opacity are configurable in Options.

## Options

- **API Key**: Required to call the model.
- **Source Language**: `ja`, `ko`, `zh`, or `auto`.
- **Target Language**: e.g., `en`, `es`, `fr`, `de`, `pt`.
- **Model**: `gemini-1.5-flash` (faster) or `gemini-1.5-pro` (higher quality).
- **Overlay Styles**: Background color, text color, and background opacity.

## How it works

- The content script scans for sufficiently large images and injects a small "Translate" button.
- On click, the background service worker fetches the image bytes (CORS) or screenshots/crops the page as a fallback.
- The image is sent to Gemini with a structured prompt requesting OCR + translation + bounding boxes.
- The content script overlays translated text boxes positioned by percentage coordinates returned from the model.

## Permissions

Declared in `manifest.json`:

- **storage**: Save user settings (API key, preferences) locally.
- **activeTab, tabs, scripting**: Support toggling, injecting script, and screenshot/crop fallback.
- **contextMenus**: Adds the right‑click "Translate image" entry.
- **host_permissions**: `<all_urls>` to access images on pages; `https://generativelanguage.googleapis.com/*` to call Gemini.

## Privacy & Security

- **API key storage**: Saved in `chrome.storage.local` on your device, never hard‑coded.
- **Network**: Images are sent to Google's Gemini API for OCR/translation.
- **No analytics/telemetry**: The extension does not collect personal data.

## Development

- No build step; the code is plain JS/HTML/CSS.
- Edit files under the `translator_image` directory, then reload the extension at `chrome://extensions/`.
- Background script is a service worker (Manifest V3); after edits, click **Reload** on the extension card.

### File overview

- `manifest.json`: Extension metadata and permissions.
- `background.js`: Stores settings, fetches images, calls Gemini, context menu.
- `content.js`: Injects UI, handles on‑page overlays and keyboard toggle.
- `popup.html` / `popup.js`: Quick controls and settings.
- `options.html` / `options.js`: Full settings page.

## Troubleshooting

- **Missing API key**: Set it in Options or the popup; otherwise requests will fail.
- **CORS fetch fails**: The extension falls back to screenshot + crop when possible.
- **No overlay appears**: Ensure Alt+T is toggled on and the image is large enough (>= ~120px each dimension).
- **Service worker not updating**: Reload the extension from `chrome://extensions/`.
- **Rate limits/quotas**: Check your Gemini API quota in Google AI Studio.


---

