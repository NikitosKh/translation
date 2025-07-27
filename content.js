let translationCache = new Map();
let isTranslating = false;
let originalTexts = new Map();

// Enhanced text node collector with better filtering
function collectTextNodes() {
  const nodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip if parent is script, style, or contenteditable
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip if contenteditable
        if (parent.isContentEditable || parent.contentEditable === 'true') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip if invisible
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Check text content
        const text = node.nodeValue.trim();
        if (text.length < 2) return NodeFilter.FILTER_REJECT;
        
        // Skip if only numbers or special characters
        if (!/[a-zA-Z\u0080-\uFFFF]{2,}/.test(text)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    nodes.push(node);
    // Store original text
    originalTexts.set(node, node.nodeValue);
  }
  
  return nodes;
}

// Smart text chunking for better context
function chunkTexts(nodes, maxChunkSize = 2000) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;
  
  for (let i = 0; i < nodes.length; i++) {
    const text = nodes[i].nodeValue.trim();
    const textSize = text.length;
    
    // Start new chunk if size exceeded
    if (currentSize + textSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }
    
    currentChunk.push({ node: nodes[i], text, index: i });
    currentSize += textSize;
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Robust translation with retry
async function translateBatch(texts, apiKey, targetLang, retries = 2) {
  const cacheKey = texts.join('|||') + targetLang;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: `You are a professional translator. Translate the following texts to ${targetLang}. 
                   Maintain the exact number of lines. Each line is separated by |||.
                   Preserve formatting, capitalization patterns, and punctuation.
                   Return ONLY the translations, separated by |||.`
        }, {
          role: 'user',
          content: texts.join('|||')
        }],
        temperature: 0.3,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Translation failed');
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    const translations = content.split('|||').map(t => t.trim());
    
    // Cache the result
    translationCache.set(cacheKey, translations);
    
    return translations;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return translateBatch(texts, apiKey, targetLang, retries - 1);
    }
    throw error;
  }
}

// Progress reporter
function reportProgress(percent, message) {
  chrome.runtime.sendMessage({
    action: 'progress',
    progress: Math.round(percent),
    message
  });
}

// Main translation handler
async function translatePage(apiKey, targetLang) {
  if (isTranslating) return { error: 'Already translating' };
  
  isTranslating = true;
  let wordCount = 0;
  
  try {
    reportProgress(0, 'Analyzing page structure...');
    
    // Collect all text nodes
    const nodes = collectTextNodes();
    if (nodes.length === 0) {
      return { error: 'No translatable text found' };
    }
    
    reportProgress(10, `Found ${nodes.length} text elements`);
    
    // Create chunks for batch processing
    const chunks = chunkTexts(nodes);
    const totalChunks = chunks.length;
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const texts = chunk.map(item => item.text);
      
      reportProgress(
        10 + (i / totalChunks) * 80,
        `Translating batch ${i + 1} of ${totalChunks}...`
      );
      
      try {
        const translations = await translateBatch(texts, apiKey, targetLang);
        
        // Apply translations
        chunk.forEach((item, j) => {
          if (translations[j] && translations[j] !== item.text) {
            item.node.nodeValue = translations[j];
            wordCount += item.text.split(/\s+/).length;
          }
        });
      } catch (error) {
        console.error(`Batch ${i + 1} failed:`, error);
        // Continue with other batches
      }
      
      // Small delay between batches
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    reportProgress(95, 'Finalizing translation...');
    
    // Mark page as translated
    document.documentElement.setAttribute('data-gpt-translated', targetLang);
    
    reportProgress(100, 'Translation complete!');
    
    return {
      success: true,
      stats: {
        pages: 1,
        words: wordCount
      }
    };
    
  } catch (error) {
    return { error: error.message };
  } finally {
    isTranslating = false;
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    translatePage(request.apiKey, request.targetLang).then(sendResponse);
    return true; // Async response
  }
  
  if (request.action === 'getStatus') {
    sendResponse({ isTranslating, progress: 0, message: '' });
    return false;
  }
  
  if (request.action === 'restore') {
    // Restore original text
    originalTexts.forEach((originalText, node) => {
      if (node.parentNode) {
        node.nodeValue = originalText;
      }
    });
    document.documentElement.removeAttribute('data-gpt-translated');
    sendResponse({ success: true });
    return false;
  }
});

// Auto-translate on page load if enabled
window.addEventListener('load', async () => {
  const settings = await chrome.storage.local.get(['autoTranslate', 'apiKey', 'targetLang']);
  
  if (settings.autoTranslate && settings.apiKey && settings.targetLang) {
    // Check if already translated
    if (!document.documentElement.hasAttribute('data-gpt-translated')) {
      setTimeout(() => {
        translatePage(settings.apiKey, settings.targetLang);
      }, 1000); // Small delay to ensure page is fully loaded
    }
  }
});