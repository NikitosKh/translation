const $ = id => document.getElementById(id);

// load saved key
chrome.storage.local.get(['apiKey'], r => {
  if (r.apiKey) $('apiKey').value = r.apiKey;
});

$('translate').onclick = async () => {
  const apiKey = $('apiKey').value;
  const targetLang = $('targetLang').value;
  
  if (!apiKey) {
    $('status').textContent = 'need api key';
    return;
  }
  
  // save key
  chrome.storage.local.set({ apiKey });
  
  $('status').textContent = 'translating...';
  
  // send to content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { apiKey, targetLang }, response => {
    $('status').textContent = response?.status || 'done';
  });
};