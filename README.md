# Expand Header Buttons

![Foundry VTT](https://img.shields.io/badge/Foundry%20VTT-v14-informational)
![Version](https://img.shields.io/badge/version-1.0.1-green)
![License](https://img.shields.io/badge/license-MIT-blue)

A Foundry VTT v14 module that shows the buttons normally hidden in the three-dot header menu as always-visible, clickable icons.

![Preview](https://raw.githubusercontent.com/arcanolab/expand-header-buttons/main/images/preview.png)

## Features

- **Three positions** — a bar on the left of the window, a bar on the right, or icons inside the window header (each user picks their own)
- **Per-button toggle** — choose which buttons are expanded and which stay in the three-dot menu
- **Sheets only** — by default only document sheets (actors, items, journals…) are affected; can be extended to every window
- **GM-only mode** — optionally restrict the expanded buttons to the Game Master
- **Works with other modules** — buttons added by other modules to the header menu are expanded too
- **Applies instantly** — every setting takes effect on open windows, no reload
- **English and Brazilian Portuguese**
- **Lightweight** — no dependencies, vanilla JS + CSS

## Installation

### Manifest URL
1. Open Foundry VTT and go to **Add-on Modules**
2. Click **Install Module**
3. Paste this URL in the **Manifest URL** field at the bottom:
```
https://github.com/arcanolab/expand-header-buttons/releases/latest/download/module.json
```
4. Click **Install**

## Configuration

**Settings → Module Settings → Expand Header Buttons**:

- **Button position** (per user) — left bar, right bar, or inside the header. Detached windows always use the header.
- **Sheets only** — expand buttons only on document sheets.
- **GM only** — only the GM gets the expanded buttons.
- **Configure buttons** — toggle each button individually. The list remembers every button you have already seen, so no sheet needs to be open.

## Compatibility

| | Version |
|---|---|
| **Foundry VTT** | v14 (verified on build 361) |
| **Systems** | Any system using ApplicationV2 sheets (tested with D&D 5e 5.3) |

Foundry v13 users should stay on the previous release (tagged v6.1.0).

## Changelog

### 1.0.1
- Foundry v14 support. v14 builds the three-dot menu on demand instead of keeping a dropdown in the page, so the module now reads the header controls directly instead of copying them from the page.
- New: button position (left, right, header), sheets-only mode, check all / uncheck all.
- New: settings apply immediately; the configuration window no longer needs an open sheet.
- New: English and Brazilian Portuguese translations.
- Configuration window rebuilt on ApplicationV2.
- Lists of disabled buttons saved by the previous release keep working.

## Support

Found a bug or have a suggestion? Open an issue on [GitHub](https://github.com/arcanolab/expand-header-buttons/issues).

## License

This module is released under the [MIT License](LICENSE).
