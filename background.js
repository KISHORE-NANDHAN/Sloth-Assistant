// background.js with Debugging

chrome.runtime.onInstalled.addListener(() => {
  console.log("[background.js] Extension installed.");
  chrome.sidePanel.setOptions({ path: "sidepanel/sidepanel.html", enabled: true });
});

chrome.commands.onCommand.addListener(async (cmd) => {
  console.log(`[background.js] Command received: ${cmd}`);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (cmd === "toggle-sidepanel") {
    if (tab?.id) {
      console.log(`[background.js] Toggling side panel for tabId: ${tab.id}`);
      await chrome.sidePanel.open({ tabId: tab.id });
    } else {
      console.warn("[background.js] No active tab found to toggle side panel.");
    }
    return;
  }

  if (cmd === "start-ocr") {
    if (!tab?.id) {
      console.warn("[background.js] No active tab found to start OCR.");
      return;
    }

    console.log(`[background.js] Attempting to inject OCR scripts into tabId: ${tab.id}`);
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/overlay.css'],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/overlay.js'],
      });
      console.log("[background.js] OCR scripts injected successfully.");
      
      // Now, we can safely send the message.
      await chrome.tabs.sendMessage(tab.id, { type: "START_REGION_SELECT" });
      console.log("[background.js] Sent 'START_REGION_SELECT' message to content script.");
    } catch (e) {
      console.error("[background.js] Failed to inject scripts or send message:", e);
      // This error might occur on pages where content scripts are not allowed (e.g., chrome:// pages)
    }
  }
});

// Relay messages between different parts of the extension
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[background.js] Message received:", msg);

  if (msg?.type === "OCR_TEXT_READY") {
    console.log("[background.js] Received OCR text. Storing and opening side panel.");
    chrome.storage.local.set({ lastOcrText: msg.text || "" }).then(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
      sendResponse({ ok: true, message: "Text stored and side panel opened." });
    });
    return true; // Indicates async response
  }
  
  if (msg?.type === "REGION_CAPTURE_READY") {
    console.log("[background.js] Received REGION_CAPTURE_READY. Forwarding to side panel.");
    // Forward the message to the side panel
    chrome.runtime.sendMessage(msg); 
    sendResponse({ ok: true, message: "Capture data forwarded." });
    return true; // Indicates async response
  }
});