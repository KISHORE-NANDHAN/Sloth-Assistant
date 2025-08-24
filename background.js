// background.js with Enhanced Debugging and Security Fixes

chrome.runtime.onInstalled.addListener(() => {
  console.log("[background.js] Extension installed.");
  try {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    console.log("[background.js] Side panel options set successfully.");
  } catch (error) {
    console.error("[background.js] Failed to set side panel options:", error);
  }
});

// Handle action click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  console.log("[background.js] Extension action clicked.");
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log("[background.js] Side panel opened via action click.");
  } catch (error) {
    console.error("[background.js] Failed to open side panel:", error);
  }
});

chrome.commands.onCommand.addListener(async (cmd) => {
  console.log(`[background.js] Command received: ${cmd}`);
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (cmd === "toggle-sidepanel") {
      if (tab?.id) {
        console.log(`[background.js] Toggling side panel for tabId: ${tab.id}`);
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log("[background.js] Side panel opened successfully.");
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

      // Security: Check if we can inject scripts into this tab
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
        console.warn("[background.js] Cannot inject scripts into protected pages:", tab.url);
        // Notify user through side panel
        chrome.storage.local.set({ 
          lastError: "Cannot capture from protected pages (chrome://, extension pages, etc.)" 
        });
        await chrome.sidePanel.open({ windowId: tab.windowId });
        return;
      }

      console.log(`[background.js] Attempting to inject OCR scripts into tabId: ${tab.id}, URL: ${tab.url}`);
      
      try {
        // Check if content script is already injected
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.hasOwnProperty('ocrOverlayInjected')
        });

        if (!results[0]?.result) {
          console.log("[background.js] Injecting CSS and JS for OCR overlay.");
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content/overlay.css'],
          });
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/overlay.js'],
          });
          console.log("[background.js] OCR scripts injected successfully.");
        } else {
          console.log("[background.js] OCR scripts already injected.");
        }
        
        // Send message with error handling
        try {
          await chrome.tabs.sendMessage(tab.id, { type: "START_REGION_SELECT" });
          console.log("[background.js] Sent 'START_REGION_SELECT' message to content script.");
        } catch (messageError) {
          console.error("[background.js] Failed to send message to content script:", messageError);
          // Retry after a short delay
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, { type: "START_REGION_SELECT" });
              console.log("[background.js] Retry: Sent 'START_REGION_SELECT' message successfully.");
            } catch (retryError) {
              console.error("[background.js] Retry failed:", retryError);
            }
          }, 100);
        }
      } catch (injectionError) {
        console.error("[background.js] Failed to inject scripts:", injectionError);
        // Store error for side panel to display
        chrome.storage.local.set({ 
          lastError: `Failed to inject scripts: ${injectionError.message}` 
        });
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    }
  } catch (error) {
    console.error("[background.js] Error in command handler:", error);
  }
});

// Enhanced message relay with input validation and security checks
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[background.js] Message received:", msg, "from sender:", sender);

  // Security: Validate message structure and sender
  if (!msg || typeof msg !== 'object') {
    console.warn("[background.js] Invalid message format received.");
    sendResponse({ ok: false, error: "Invalid message format" });
    return;
  }

  // Security: Ensure message comes from our extension
  if (sender.id !== chrome.runtime.id) {
    console.warn("[background.js] Message from unauthorized sender:", sender.id);
    sendResponse({ ok: false, error: "Unauthorized sender" });
    return;
  }

  try {
    if (msg.type === "REQUEST_TAB_CAPTURE") {
      console.log("[background.js] Received REQUEST_TAB_CAPTURE message.");
      
      // Capture the visible tab
      chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 90 }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error("[background.js] Failed to capture tab:", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else if (dataUrl) {
          console.log("[background.js] Tab captured successfully. Sending dataUrl back.");
          sendResponse({ success: true, dataUrl: dataUrl });
        } else {
          console.error("[background.js] No capture data received.");
          sendResponse({ success: false, error: "No capture data received" });
        }
      });
      return true; // Indicates async response
    }
    
    if (msg.type === "OCR_TEXT_READY") {
      console.log("[background.js] Received OCR text. Storing and opening side panel.");
      
      // Security: Validate and sanitize text input
      const text = typeof msg.text === 'string' ? msg.text.slice(0, 50000) : ""; // Limit text size
      // Open Gemini directly with the OCR text
      await openGeminiWithText(text);
      sendResponse({ ok: true, message: "Gemini opened with OCR text." });
      return true; // Indicates async response
    }
    
    if (msg.type === "REGION_CAPTURE_READY") {
      console.log("[background.js] Received REGION_CAPTURE_READY. Forwarding to side panel.");
      
      // Security: Validate dataUrl format
      if (msg.dataUrl && typeof msg.dataUrl === 'string' && msg.dataUrl.startsWith('data:image/')) {
        // Store the capture data for the side panel to retrieve
        chrome.storage.local.set({ 
          lastCaptureData: msg.dataUrl,
          captureTimestamp: Date.now()
        }).then(() => {
          console.log("[background.js] Capture data stored successfully.");
        }).catch(error => {
          console.error("[background.js] Failed to store capture data:", error);
        });
        sendResponse({ ok: true, message: "Capture data forwarded." });
      } else {
        console.warn("[background.js] Invalid dataUrl in REGION_CAPTURE_READY message.");
        sendResponse({ ok: false, error: "Invalid capture data" });
      }
      return true; // Indicates async response
    }

    if (msg.type === "START_OCR_COMMAND") {
      console.log("[background.js] Received START_OCR_COMMAND from side panel.");
      // Trigger the OCR command programmatically
      chrome.commands.onCommand.dispatch("start-ocr");
      sendResponse({ ok: true, message: "OCR command triggered." });
      return;
    }

    // Unknown message type
    console.warn("[background.js] Unknown message type:", msg.type);
    sendResponse({ ok: false, error: "Unknown message type" });
    
  } catch (error) {
    console.error("[background.js] Error processing message:", error);
    sendResponse({ ok: false, error: error.message });
  }
});

// Handle extension errors
chrome.runtime.onStartup.addListener(() => {
  console.log("[background.js] Extension startup.");
});

// Clean up on extension suspend
chrome.runtime.onSuspend.addListener(() => {
  console.log("[background.js] Extension suspending.");
});

// Function to open Gemini with OCR text
async function openGeminiWithText(text) {
  try {
    console.log("[background.js] Opening Gemini with OCR text.");
    
    // Find or create Gemini tab
    let geminiTab = await findOrCreateGeminiTab();
    
    // Wait for tab to load if needed
    if (geminiTab.status !== 'complete') {
      await waitForTabToLoad(geminiTab.id);
    }
    
    // Focus the Gemini tab
    await chrome.tabs.update(geminiTab.id, { active: true });
    
    // Wait a moment for tab to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Inject script to fill the text
    await chrome.scripting.executeScript({
      target: { tabId: geminiTab.id },
      func: fillGeminiInput,
      args: [text]
    });
    
    console.log("[background.js] OCR text filled in Gemini successfully.");
    
  } catch (error) {
    console.error("[background.js] Failed to open Gemini with text:", error);
    // Fallback: open side panel
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.storage.local.set({ lastOcrText: text });
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
}

async function findOrCreateGeminiTab() {
  // Look for existing Gemini tab
  const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
  
  if (tabs.length > 0) {
    console.log("[background.js] Found existing Gemini tab.");
    return tabs[0];
  }
  
  // Create new Gemini tab
  console.log("[background.js] Creating new Gemini tab.");
  return await chrome.tabs.create({ 
    url: "https://gemini.google.com/app",
    active: true
  });
}

async function waitForTabToLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (changedTabId, changeInfo) => {
      if (changedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 10000);
  });
}

// Function to be injected into Gemini page
function fillGeminiInput(text) {
  console.log("[Injected Script] Filling Gemini input with OCR text.");
  
  // Multiple strategies to find the input
  const selectors = [
    'textarea[placeholder*="Enter a prompt here"]',
    'textarea[aria-label*="Message"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Ask"]',
    '.ql-editor.textarea',
    '[contenteditable="true"]',
    'textarea:not([readonly]):not([disabled])'
  ];
  
  let input = null;
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 30) { // Reasonable size
        input = element;
        break;
      }
    }
    if (input) break;
  }
  
  if (!input) {
    console.warn("[Injected Script] Could not find Gemini input field.");
    return;
  }
  
  // Focus and fill the input
  input.focus();
  
  if (input.contentEditable === 'true') {
    // For contenteditable elements
    input.textContent = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // For textarea elements
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  console.log("[Injected Script] OCR text filled successfully.");