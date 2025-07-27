// Background service worker for the Chrome extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('ChatGPT Web Translator installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup, which is handled by the manifest
});

// Listen for tab updates to potentially auto-translate
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Check if auto-translate is enabled
    const settings = await chrome.storage.sync.get(['autoTranslate', 'apiKey']);
    
    if (settings.autoTranslate && settings.apiKey) {
      // Small delay to ensure page is fully loaded
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          action: 'autoTranslateCheck'
        }, (response) => {
          // Ignore errors if content script isn't loaded yet
          if (chrome.runtime.lastError) {
            console.log('Content script not ready yet');
          }
        });
      }, 1000);
    }
  }
});

// Handle messages between popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward messages if needed
  if (message.action === 'translationProgress' || 
      message.action === 'translationComplete' || 
      message.action === 'translationError') {
    // These messages are handled directly by popup
  }
});

// Set up context menu (optional)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'translateSelection',
      text: info.selectionText
    });
  }
});

// Create context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate selected text',
    contexts: ['selection']
  });
});
