# 🌐 Image Text Translator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://developer.chrome.com/docs/extensions/)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

A powerful browser extension that translates text on images (manga, comics, screenshots, etc.) directly on webpages using multiple AI models. Features real-time translation overlays with support for **Google Gemini**, **OpenAI ChatGPT**, and **DeepSeek** models.

## ✨ Features

- **🤖 Multi-Model Support**: Choose between Gemini, ChatGPT, and DeepSeek AI models
- **🎯 One-Click Translation**: Floating translate buttons appear on images automatically
- **⌨️ Keyboard Shortcuts**: Alt+T to toggle translation mode on/off
- **🖱️ Context Menu**: Right-click any image to translate instantly
- **🎨 Customizable Overlays**: Adjust colors, opacity, and positioning of translation boxes
- **🌍 Multi-Language**: Support for Japanese, Korean, Chinese, and many target languages
- **📱 Cross-Browser**: Works on Chrome, Edge, and other Chromium-based browsers
- **🔒 Privacy-First**: API keys stored locally, no data collection

## Installation (Chromium browsers)

### Chrome / Edge (Unpacked)

1. Open the browser and go to `chrome://extensions/` (Edge: `edge://extensions/`).
2. Enable "Developer mode" (top right).
3. Click "Load unpacked".
4. Select the folder that contains `manifest.json` (this repo's `translator_image` directory).

After loading, you should see the extension icon in the toolbar.

## 🚀 Quick Start

### 1. Choose Your AI Provider

Select one of the supported AI models and get an API key:

| Provider | Models Available | Get API Key |
|----------|------------------|-------------|
| **Google Gemini** | 1.5 Flash, 1.5 Pro | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| **OpenAI ChatGPT** | GPT-4o, GPT-4o Mini, GPT-4 Turbo | [OpenAI Platform](https://platform.openai.com/api-keys) |
| **DeepSeek** | Chat, Coder | [DeepSeek Platform](https://platform.deepseek.com/api_keys) |

### 2. Configure the Extension

1. Click the extension icon in your browser toolbar
2. Click **⚙️Settings** to expand the configuration panel
3. Select your preferred **AI Model Provider**
4. Enter your **API Key** for the chosen provider
5. Choose **Source Language** (Japanese, Korean, Chinese, or Auto-detect)
6. Choose **Target Language** (English, Spanish, French, German, Portuguese, etc.)
7. Select specific **Model** (optional - defaults will work fine)
8. Customize overlay appearance if desired
9. Click **Save Settings**

## 📖 How to Use

### Basic Usage
1. **Activate Translation**: Click the extension icon and toggle "Translator: On" or press `Alt+T`
2. **Translate Images**: Hover over images to see translate buttons appear, then click to translate
3. **View Results**: Translation overlays will appear on top of the original text

### Advanced Features
- **Bulk Translation**: Click "Translate All Texts" to process all images on the page
- **Context Menu**: Right-click any image → "Translate image" for direct translation
- **Keyboard Toggle**: Press `Alt+T` anywhere on the page to enable/disable
- **Custom Styling**: Adjust overlay colors and opacity in settings

### Supported Content
- 📚 Manga and comics
- 🎮 Game screenshots
- 📱 Social media images with text
- 📄 Document screenshots
- 🖼️ Any image with readable text

## ⚙️ Configuration Options

### AI Model Settings
- **Model Provider**: Choose between Gemini, OpenAI, or DeepSeek
- **API Keys**: Separate secure storage for each provider
- **Specific Models**: Fine-tune model selection per provider

### Language Settings
- **Source Languages**: Japanese (`ja`), Korean (`ko`), Chinese (`zh`), Auto-detect (`auto`)
- **Target Languages**: English (`en`), Spanish (`es`), French (`fr`), German (`de`), Portuguese (`pt`), and more

### Visual Customization
- **Overlay Colors**: Customize background and text colors
- **Opacity Control**: Adjust transparency (0-100%)
- **Positioning**: Automatic smart positioning over detected text

## 🔧 Technical Architecture

### How It Works
1. **Image Detection**: Content script scans for images ≥120px and injects translate buttons
2. **Image Processing**: Background worker fetches image data or captures screenshots as fallback
3. **AI Processing**: Images sent to selected AI provider with OCR + translation prompts
4. **Result Rendering**: Translation overlays positioned using AI-provided bounding box coordinates

### Multi-Model Support
- **Gemini**: Uses Google's Generative Language API
- **OpenAI**: Leverages Chat Completions API with vision capabilities
- **DeepSeek**: Integrates with DeepSeek's vision-enabled chat API
- **Unified Interface**: Consistent experience regardless of chosen provider

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

## 🛠️ Development

### Prerequisites
- Node.js (for development tools, optional)
- Chromium-based browser (Chrome, Edge, etc.)
- Text editor or IDE

### Local Development Setup
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Abhivera/image_text_translator_extension.git
   cd image-text-translator
   ```

2. **Load extension in browser**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory

3. **Make changes**:
   - Edit files directly (no build step required)
   - Click "Reload" on the extension card after changes
   - Background script changes require extension reload

### Project Structure
```
translator_image/
├── manifest.json          # Extension configuration
├── background.js          # Service worker, API calls, settings
├── content.js            # Page injection, UI, overlays
├── popup.html/js         # Extension popup interface
├── options.html/js       # Full settings page
├── icons/               # Extension icons
└── README.md           # This file
```

### Key Components
- **Background Script**: Handles API routing, settings storage, context menus
- **Content Script**: Manages on-page UI, image detection, overlay rendering
- **Popup Interface**: Quick controls and settings management
- **Options Page**: Comprehensive configuration interface

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute
- 🐛 **Bug Reports**: Open an issue with details and reproduction steps
- 💡 **Feature Requests**: Suggest new features or improvements
- 🔧 **Code Contributions**: Submit pull requests with bug fixes or new features
- 📖 **Documentation**: Help improve README, code comments, or add examples
- 🌍 **Translations**: Add support for more languages

### Development Guidelines
1. **Fork the repository** and create a feature branch
2. **Follow existing code style** and conventions
3. **Test thoroughly** across different browsers and scenarios
4. **Update documentation** for any new features
5. **Submit a pull request** with clear description of changes

### Code Style
- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Follow JavaScript ES6+ standards
- Keep functions focused and modular

## 🐛 Troubleshooting

### Common Issues
| Problem | Solution |
|---------|----------|
| **Missing API key error** | Configure API key in Settings for your chosen provider |
| **No translate buttons appear** | Press Alt+T to enable, ensure images are ≥120px |
| **CORS fetch fails** | Extension automatically falls back to screenshot method |
| **Translations don't appear** | Check API key validity and quota limits |
| **Extension not updating** | Reload extension from `chrome://extensions/` |

### API-Specific Issues
- **Gemini**: Check quota at [Google AI Studio](https://makersuite.google.com/)
- **OpenAI**: Verify credits and rate limits at [OpenAI Platform](https://platform.openai.com/)
- **DeepSeek**: Check account status at [DeepSeek Platform](https://platform.deepseek.com/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all contributors who help improve this project
- Inspired by the need for accessible manga and comic translation
- Built with modern web extension APIs and AI vision models

## 📞 Support

- 📋 **Issues**: [GitHub Issues](https://github.com/Abhivera/image_text_translator_extension/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Abhivera/image_text_translator_extension/discussions)
- 📧 **Email**: abhijitakadeveloper@gmail.com

---

**⭐ If you find this project helpful, please consider giving it a star on GitHub!**

