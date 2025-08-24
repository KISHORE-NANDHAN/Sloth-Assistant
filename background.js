chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: true });
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd === "toggle-sidepanel") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
  }
  if (cmd === "start-ocr") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "START_REGION_SELECT" });
  }
});

// Relay text from content overlay to side panel
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg?.type === "OCR_TEXT_READY") {
    await chrome.storage.local.set({ lastOcrText: msg.text || "" });
    // Optionally auto-open side panel
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
    sendResponse({ ok: true });
  }
});
