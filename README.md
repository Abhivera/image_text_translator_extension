# Image Text Translator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://developer.chrome.com/docs/extensions/)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

Translate text inside images directly on webpages with clean overlays and one-click controls.
Perfect for manga, manhwa, screenshots, social posts, and any image-heavy content.

## Why This Extension

- Multi-provider AI OCR + translation in one workflow
- Translation overlays rendered directly on top of source image text
- Quick per-tab control (`Alt+T`) and bulk translate support
- Local-first settings (`chrome.storage.local`) with no telemetry

## Highlights

- **AI Providers**: Gemini, OpenAI, DeepSeek, Groq, Ollama (local)
- **One-click Translate**: Floating action button appears on eligible images
- **Translate All**: Process all images on a page with progress HUD
- **Context Menu**: Right-click image -> Translate image
- **Custom Overlay UI**: Background color, opacity, text color
- **Language Control**: Source language or auto-detect + target language

## Supported Providers

| Provider | Example Models | API / Setup |
| --- | --- | --- |
| Google Gemini | `gemini-1.5-flash`, `gemini-1.5-pro` | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| OpenAI | `gpt-4o`, `gpt-4o-mini` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| DeepSeek | `deepseek-chat`, `deepseek-coder` | [DeepSeek Platform](https://platform.deepseek.com/api_keys) |
| Groq | `meta-llama/llama-4-scout-17b-16e-instruct` | [Groq Console](https://console.groq.com/keys) |
| Ollama (Local) | `llava:latest`, `llama3.2-vision:latest` | Local server (`http://localhost:11434`) |

## Install (Chromium Browsers)

1. Open `chrome://extensions/` (Edge: `edge://extensions/`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (the one containing `manifest.json`).

You should now see the extension in the browser toolbar.

## Quick Start

1. Click the extension icon.
2. Open **Settings** in the popup.
3. Choose your **AI Provider**.
4. Add provider credentials:
   - Cloud providers: add API key
   - Ollama: keep local endpoint running (`http://localhost:11434`)
5. Select source + target language.
6. Save settings and enable translator.
7. Hover image -> click translate icon.

## How It Works

1. Content script scans eligible images (`>=120px`).
2. Background worker fetches image bytes (or uses screenshot crop fallback).
3. Selected AI provider performs OCR + translation.
4. Extension normalizes model output and renders overlays over the image.

## Core Features

### Translation Modes

- **Single image translate** from overlay button
- **Bulk translate all images** in current page
- **Context menu translate** for right-clicked image

### Controls

- **Toggle per tab**: popup switch or `Alt+T`
- **Translate all button** in popup
- **Live settings updates** without full page refresh

### Overlay Customization

- Background color
- Text color
- Background opacity (0 to 100)

## Configuration

### Language

- Source: `auto`, `ja`, `ko`, `zh`
- Target: `en`, `es`, `fr`, `de`, `pt` (extendable)

### Providers and Model Selection

- Each provider has independent settings
- Model list updates based on selected provider
- Safe defaults used when model is not explicitly set

## Privacy and Security

- API keys are stored locally in `chrome.storage.local`
- No analytics or telemetry
- Requests are sent only to your selected provider endpoints

## Permissions

From `manifest.json`:

- `storage`: save settings locally
- `activeTab`, `tabs`, `scripting`: tab control and screenshot fallback
- `contextMenus`: add image translation menu actions
- `host_permissions`: page image access + provider API endpoints

## Development

### Local Setup

```bash
git clone https://github.com/Abhivera/image_text_translator_extension.git
cd image_text_translator_extension
```

Load unpacked extension and click **Reload** after code changes.
No build step required.

### Project Structure

```text
image_text_translator_extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── options.html
├── options.js
├── icons/
└── README.md
```

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Missing API key error | Add key for active provider in settings |
| Buttons not visible | Enable translator (`Alt+T`) and ensure image is large enough |
| CORS image fetch fails | Extension auto-fallbacks to screenshot crop |
| Translations do not render | Verify API/model availability and provider quota |
| Changes not applied | Reload extension in `chrome://extensions/` |

## Contributing

Contributions are welcome:

- Bug reports
- Feature requests
- Provider/model improvements
- UI/UX improvements
- Documentation updates

Please open an issue or submit a pull request.

## License

MIT. See [LICENSE](LICENSE).

## Support

- Issues: [GitHub Issues](https://github.com/Abhivera/image_text_translator_extension/issues)
- Discussions: [GitHub Discussions](https://github.com/Abhivera/image_text_translator_extension/discussions)
- Contact: abhijitakadeveloper@gmail.com

---

If this project helps you, consider starring the repo.

