# GPT Translator Chrome Extension

A minimalist Chrome extension that translates web pages using ChatGPT while preserving the original formatting.

## Installation

1. **Download the extension files**
   - `manifest.json`
   - `popup.html`
   - `popup.js`
   - `content.js`

2. **Load into Chrome**
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the folder containing the extension files

## Setup

1. **Get an OpenAI API Key**
   - Visit https://platform.openai.com/api-keys
   - Create a new API key
   - Copy the key (starts with `sk-`)

2. **Configure the extension**
   - Click the extension icon in Chrome toolbar (look for puzzle piece if not visible)
   - Paste your API key in the input field
   - The key is saved locally for future use

## Usage

1. Navigate to any website you want to translate
2. Click the GPT Translator extension icon
3. Select your target language from the dropdown
4. Click "Translate Page"
5. Wait for translation (status shows at bottom)

## Features

- **Preserves formatting** - Only text content is translated, layout remains intact
- **Batch processing** - Translates multiple text blocks efficiently
- **Smart translation** - Uses ChatGPT for context-aware translation
- **Multiple languages** - Spanish, French, German, Japanese, Chinese, Russian

## Notes

- Uses GPT-3.5-turbo model for cost efficiency
- Processes up to 100 text blocks per API call
- Skips script and style elements
- API key is stored locally in Chrome storage

## Troubleshooting

- **Can't see extension icon**: Click the puzzle piece icon in toolbar and pin GPT Translator
- **Translation fails**: Check your API key is valid and has credits
- **Some text not translated**: Very short text (1 character) is skipped

## Cost

- Each page translation uses OpenAI API credits
- Cost depends on page text length
- Approximately $0.002 per 1000 tokens
