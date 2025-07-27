class WebPageTranslator {
  constructor() {
    this.isTranslating = false;
    this.originalTexts = new Map();
    this.translatedTexts = new Map();
    this.autoTranslateEnabled = false;
    this.observer = null;
    this.init();
  }

  async init() {
    // Load settings
    const settings = await chrome.storage.sync.get(['autoTranslate']);
    this.autoTranslateEnabled = settings.autoTranslate || false;
    
    if (this.autoTranslateEnabled) {
      this.startAutoTranslate();
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message);
    });
  }

  handleMessage(message) {
    switch (message.action) {
      case 'translatePage':
        this.translatePage(message.apiKey, message.targetLanguage);
        break;
      case 'toggleAutoTranslate':
        this.toggleAutoTranslate(message.enabled);
        break;
    }
  }

  toggleAutoTranslate(enabled) {
    this.autoTranslateEnabled = enabled;
    
    if (enabled) {
      this.startAutoTranslate();
    } else {
      this.stopAutoTranslate();
    }
  }

  startAutoTranslate() {
    // Auto-translate when page loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.autoTranslate());
    } else {
      this.autoTranslate();
    }

    // Watch for dynamic content changes
    this.observer = new MutationObserver((mutations) => {
      let hasTextChanges = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          hasTextChanges = true;
        }
      });
      
      if (hasTextChanges && !this.isTranslating) {
        clearTimeout(this.autoTranslateTimeout);
        this.autoTranslateTimeout = setTimeout(() => this.autoTranslate(), 1000);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  stopAutoTranslate() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    clearTimeout(this.autoTranslateTimeout);
  }

  async autoTranslate() {
    const settings = await chrome.storage.sync.get(['apiKey', 'targetLanguage']);
    
    if (settings.apiKey && this.autoTranslateEnabled && !this.isTranslating) {
      this.translatePage(settings.apiKey, settings.targetLanguage || 'spanish');
    }
  }

  async translatePage(apiKey, targetLanguage) {
    if (this.isTranslating) return;
    
    this.isTranslating = true;
    
    try {
      // Extract all text elements
      const textElements = this.extractTextElements();
      
      if (textElements.length === 0) {
        this.sendProgress(100, 'No text found to translate');
        return;
      }

      this.sendProgress(10, 'Extracting text elements...');

      // Group text elements for batch translation
      const batches = this.createBatches(textElements);
      
      this.sendProgress(20, `Processing ${batches.length} batches...`);

      // Translate each batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const progress = 20 + ((i / batches.length) * 70);
        
        this.sendProgress(progress, `Translating batch ${i + 1}/${batches.length}...`);
        
        try {
          const translations = await this.translateBatch(batch, apiKey, targetLanguage);
          this.applyTranslations(batch, translations);
        } catch (error) {
          console.error('Batch translation error:', error);
          // Continue with next batch
        }
        
        // Small delay to prevent rate limiting
        await this.delay(200);
      }

      this.sendProgress(100, 'Translation complete!');
      this.sendMessage({ action: 'translationComplete' });
      
    } catch (error) {
      console.error('Translation error:', error);
      this.sendMessage({ 
        action: 'translationError', 
        error: error.message || 'Unknown error occurred' 
      });
    } finally {
      this.isTranslating = false;
    }
  }

  extractTextElements() {
    const elements = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip script, style, and other non-visible elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if parent is hidden
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Only include text nodes with meaningful content
          const text = node.textContent.trim();
          if (text.length < 3 || /^[\d\s\W]*$/.test(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      elements.push(node);
    }

    return elements;
  }

  createBatches(textElements, maxBatchSize = 10) {
    const batches = [];
    
    for (let i = 0; i < textElements.length; i += maxBatchSize) {
      batches.push(textElements.slice(i, i + maxBatchSize));
    }
    
    return batches;
  }

  async translateBatch(textNodes, apiKey, targetLanguage) {
    const texts = textNodes.map(node => node.textContent.trim());
    
    const prompt = `Translate the following texts to ${targetLanguage}. 
    Return ONLY the translations in the same order, separated by "|||".
    Do not add any explanations or additional text.
    
    Texts to translate:
    ${texts.map((text, i) => `${i + 1}. ${text}`).join('\n')}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const translatedText = data.choices[0].message.content.trim();
    
    // Parse the translations
    const translations = translatedText.split('|||').map(t => t.trim());
    
    // Ensure we have the right number of translations
    if (translations.length !== texts.length) {
      // Fallback: try to split by numbers
      const numberedSplit = translatedText.split(/\d+\.\s*/).filter(t => t.trim());
      if (numberedSplit.length === texts.length) {
        return numberedSplit.map(t => t.trim());
      }
      
      // If we still don't have the right number, return original texts
      console.warn('Translation count mismatch, using original texts');
      return texts;
    }
    
    return translations;
  }

  applyTranslations(textNodes, translations) {
    textNodes.forEach((node, index) => {
      if (index < translations.length && translations[index]) {
        // Store original text if not already stored
        if (!this.originalTexts.has(node)) {
          this.originalTexts.set(node, node.textContent);
        }
        
        // Apply translation
        node.textContent = translations[index];
        this.translatedTexts.set(node, translations[index]);
      }
    });
  }

  sendProgress(progress, text) {
    this.sendMessage({
      action: 'translationProgress',
      progress: Math.round(progress),
      text: text
    });
  }

  sendMessage(message) {
    try {
      chrome.runtime.sendMessage(message);
    } catch (error) {
      // Ignore errors if popup is closed
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize the translator
const translator = new WebPageTranslator();
