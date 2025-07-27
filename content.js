// text node walker
const walk = (node, fn) => {
  if (node.nodeType === 3) fn(node);
  else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE')
    for (let child of node.childNodes) walk(child, fn);
};

// collect text nodes
const getTextNodes = () => {
  const nodes = [];
  walk(document.body, n => {
    const text = n.nodeValue.trim();
    if (text.length > 1) nodes.push(n);
  });
  return nodes;
};

// batch translate with gpt
const translate = async (texts, apiKey, targetLang) => {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: `Translate to ${targetLang}. Return ONLY translations, one per line, same order:\n\n${texts.join('\n')}`
      }],
      temperature: 0.3
    })
  });
  
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content.split('\n').filter(t => t.trim());
};

// main handler
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  (async () => {
    try {
      const nodes = getTextNodes();
      const texts = nodes.map(n => n.nodeValue.trim());
      
      // batch process (100 at a time)
      const batchSize = 100;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const translations = await translate(batch, req.apiKey, req.targetLang);
        
        // replace text
        batch.forEach((_, j) => {
          if (translations[j]) {
            nodes[i + j].nodeValue = translations[j];
          }
        });
      }
      
      sendResponse({ status: 'translated' });
    } catch (e) {
      sendResponse({ status: `error: ${e.message}` });
    }
  })();
  
  return true; // async response
});