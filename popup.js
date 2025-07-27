const $ = id => document.getElementById(id);

let isTranslating = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const settings = await chrome.storage.local.get(['apiKey', 'targetLang', 'autoTranslate', 'stats']);
  
  if (settings.apiKey) $('apiKey').value = settings.apiKey;
  if (settings.targetLang) $('targetLang').value = settings.targetLang;
  if (settings.autoTranslate) {
    $('autoToggle').classList.add('active');
  }
  
  // Update stats
  updateStats(settings.stats || {});
  
  // Check if currently translating
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, response => {
    if (response?.isTranslating) {
      showProgress(response.progress, response.message);
    }
  });
});

// Toggle auto-translate
$('autoToggle').onclick = async () => {
  const isActive = $('autoToggle').classList.toggle('active');
  await chrome.storage.local.set({ autoTranslate: isActive });
  
  if (isActive) {
    showSuccess('Auto-translate enabled');
    // Translate current page if not already translated
    translateCurrentPage();
  } else {
    showSuccess('Auto-translate disabled');
  }
};

// Save settings on change
$('apiKey').onchange = async () => {
  await chrome.storage.local.set({ apiKey: $('apiKey').value });
};

$('targetLang').onchange = async () => {
  await chrome.storage.local.set({ targetLang: $('targetLang').value });
  // Auto-translate if enabled
  const settings = await chrome.storage.local.get(['autoTranslate']);
  if (settings.autoTranslate) {
    translateCurrentPage();
  }
};

// Translate current page
async function translateCurrentPage() {
  if (isTranslating) return;
  
  const apiKey = $('apiKey').value;
  const targetLang = $('targetLang').value;
  
  if (!apiKey) {
    showError('Please enter your OpenAI API key');
    return;
  }
  
  isTranslating = true;
  hideMessages();
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(
    tab.id,
    { action: 'translate', apiKey, targetLang },
    response => {
      isTranslating = false;
      if (response?.error) {
        showError(response.error);
        hideProgress();
      } else if (response?.success) {
        showSuccess('Translation complete!');
        updateStats(response.stats);
        hideProgress();
      }
    }
  );
}

// Progress handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'progress') {
    showProgress(request.progress, request.message);
  }
});

function showProgress(percent, message) {
  $('progressSection').style.display = 'block';
  $('progressFill').style.width = percent + '%';
  $('progressText').textContent = message;
}

function hideProgress() {
  $('progressSection').style.display = 'none';
}

// Messages
function showError(message) {
  $('error').textContent = message;
  $('error').style.display = 'block';
  setTimeout(hideMessages, 5000);
}

function showSuccess(message) {
  $('success').textContent = message;
  $('success').style.display = 'block';
  setTimeout(hideMessages, 3000);
}

function hideMessages() {
  $('error').style.display = 'none';
  $('success').style.display = 'none';
}

// Stats
async function updateStats(newStats) {
  const today = new Date().toDateString();
  const stats = await chrome.storage.local.get(['stats']);
  const currentStats = stats.stats || { pagesTotal: 0, wordsToday: 0, date: today };
  
  // Reset daily counter if new day
  if (currentStats.date !== today) {
    currentStats.wordsToday = 0;
    currentStats.date = today;
  }
  
  // Update with new stats
  if (newStats.pages) currentStats.pagesTotal = (currentStats.pagesTotal || 0) + newStats.pages;
  if (newStats.words) currentStats.wordsToday = (currentStats.wordsToday || 0) + newStats.words;
  
  // Save and display
  await chrome.storage.local.set({ stats: currentStats });
  $('pagesTranslated').textContent = currentStats.pagesTotal || 0;
  $('wordsTranslated').textContent = formatNumber(currentStats.wordsToday || 0);
}

function formatNumber(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}