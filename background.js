// Handle tab updates for auto-translate
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if auto-translate is enabled
    const settings = await chrome.storage.local.get(['autoTranslate', 'apiKey', 'targetLang']);
    
    if (settings.autoTranslate && settings.apiKey && settings.targetLang) {
      // Skip chrome:// and extension pages
      if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
        // Small delay to ensure content script is loaded
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            action: 'translate',
            apiKey: settings.apiKey,
            targetLang: settings.targetLang
          });
        }, 500);
      }
    }
  }
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings
    await chrome.storage.local.set({
      autoTranslate: false,
      targetLang: 'Spanish',
      stats: {
        pagesTotal: 0,
        wordsToday: 0,
        date: new Date().toDateString()
      }
    });
  }
});