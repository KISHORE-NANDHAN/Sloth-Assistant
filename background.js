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
      
      // Send text to side panel
      try {
        // Store text for side panel to retrieve
        await chrome.storage.local.set({ pendingOcrText: text });
        
        // Try to send message to side panel
        chrome.runtime.sendMessage({ 
          type: "OCR_TEXT_READY", 
          text: text 
        }).catch(error => {
          console.log("[background.js] Side panel not ready, text stored for later injection.");
        });
        
        console.log("[background.js] OCR text prepared for side panel injection.");
      } catch (error) {
        console.error("[background.js] Error preparing OCR text:", error);
      }
      
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