document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const targetLanguageSelect = document.getElementById('targetLanguage');
  const autoTranslateToggle = document.getElementById('autoTranslate');
  const translateButton = document.getElementById('translateNow');
  const statusDiv = document.getElementById('status');
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  // Load saved settings
  const settings = await chrome.storage.sync.get(['apiKey', 'targetLanguage', 'autoTranslate']);
  
  if (settings.apiKey) {
    apiKeyInput.value = settings.apiKey;
  }
  
  if (settings.targetLanguage) {
    targetLanguageSelect.value = settings.targetLanguage;
  }
  
  if (settings.autoTranslate) {
    autoTranslateToggle.classList.add('active');
  }

  // Save settings on change
  apiKeyInput.addEventListener('input', () => {
    chrome.storage.sync.set({ apiKey: apiKeyInput.value });
  });

  targetLanguageSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ targetLanguage: targetLanguageSelect.value });
  });

  autoTranslateToggle.addEventListener('click', () => {
    autoTranslateToggle.classList.toggle('active');
    const isActive = autoTranslateToggle.classList.contains('active');
    chrome.storage.sync.set({ autoTranslate: isActive });
    
    // Send message to content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'toggleAutoTranslate',
        enabled: isActive
      });
    });
  });

  translateButton.addEventListener('click', () => {
    if (!apiKeyInput.value.trim()) {
      showStatus('Please enter your OpenAI API key', 'error');
      return;
    }

    showProgress();
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'translatePage',
        apiKey: apiKeyInput.value,
        targetLanguage: targetLanguageSelect.value
      });
    });
  });

  function showStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  function showProgress() {
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Preparing translation...';
  }

  function hideProgress() {
    progressContainer.style.display = 'none';
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translationProgress') {
      progressFill.style.width = `${message.progress}%`;
      progressText.textContent = message.text;
    } else if (message.action === 'translationComplete') {
      hideProgress();
      showStatus('Translation completed successfully!', 'success');
    } else if (message.action === 'translationError') {
      hideProgress();
      showStatus(`Error: ${message.error}`, 'error');
    }
  });
});
