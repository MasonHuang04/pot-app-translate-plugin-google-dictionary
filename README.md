# Google Translate Dictionary for Pot

A lightweight [Pot](https://github.com/pot-app/pot-desktop) plugin for word meanings, parts of speech, definitions, synonyms, and examples. Sentences fall back to regular translation.

## Install

1. Download the `.potext` file from [Releases](https://github.com/MasonHuang04/pot-app-translate-plugin-google-dictionary/releases/latest).
2. In Pot, open **Preferences → Services → Translation → Add external plugin → Install external plugin**.
3. Select the file, add **Google Translate 词典增强** to your services, and save.

## Options

- **Request URL:** optional; defaults to `https://translate.google.com`.
- **Output:** dictionary cards or full text for copying.

This plugin uses an unofficial Google web endpoint. Network access is required; Google may block requests with HTTP 429. Dictionary content varies by language and word.

## Development

This is the development branch. Release packages are built from `main`.

```sh
npm test
python3 scripts/package.py
# Optional live check (requires access to Google):
npm run test:live
```

GPL-3.0-only. Independent plugin; not affiliated with Pot or Google.
