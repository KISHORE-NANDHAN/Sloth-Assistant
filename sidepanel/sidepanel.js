// sidepanel/sidepanel.js - Real Gemini with Auto OCR Injection

const captureBtn = document.getElementById("capture-overlay");
const statusEl = document.getElementById("status");
const geminiFrame = document.getElementById("gemini-frame");

let pendingOcrText = null;

console.log("[sidepanel.js] Real Gemini side panel loaded.");

// Event Listeners
captureBtn.addEventListener("click", startCapture);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[sidepanel.js] Message received:", message);
  
  if (message.type === "OCR_TEXT_READY") {
    console.log("[sidepanel.js] OCR text ready for injection:", message.text);
    pendingOcrText = message.text;
    injectTextIntoGemini(message.text);
    sendResponse({ success: true });
  }
  
  if (message.type === "CAPTURE_STATUS") {
    showStatus(message.status, message.duration);
    sendResponse({ success: true });
  }
});

// Check for pending OCR text on load
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const result = await chrome.storage.local.get(["pendingOcrText"]);
    if (result.pendingOcrText) {
      console.log("[sidepanel.js] Found pending OCR text on load.");
      pendingOcrText = result.pendingOcrText;
      // Wait for Gemini to load, then inject
      setTimeout(() => {
        injectTextIntoGemini(result.pendingOcrText);
      }, 3000);
      // Clear the pending text
      chrome.storage.local.remove(["pendingOcrText"]);
    }
  } catch (error) {
    console.error("[sidepanel.js] Error checking for pending OCR text:", error);
  }
});

async function startCapture() {
  console.log("[sidepanel.js] Starting OCR capture.");
  showStatus("Click and drag to select text region...", 0);
  
  try {
    const response = await chrome.runtime.sendMessage({ type: "START_OCR_COMMAND" });
    if (!response || !response.ok) {
      showStatus("Failed to start capture", 3000);
    }
  } catch (error) {
    console.error("[sidepanel.js] Error starting capture:", error);
    showStatus("Error starting capture", 3000);
  }
}

function injectTextIntoGemini(text) {
  if (!text || !text.trim()) {
    console.warn("[sidepanel.js] No text to inject.");
    return;
  }
  
  console.log("[sidepanel.js] Injecting text into Gemini iframe.");
  showStatus("Injecting OCR text into Gemini...", 2000);
  
  try {
    // Send message to the iframe content
    geminiFrame.contentWindow.postMessage({
      type: "INJECT_OCR_TEXT",
      text: text.trim()
    }, "https://gemini.google.com");
    
    console.log("[sidepanel.js] Text injection message sent to Gemini iframe.");
    
  } catch (error) {
    console.error("[sidepanel.js] Error injecting text:", error);
    showStatus("Failed to inject text", 3000);
  }
}

function showStatus(message, duration = 2000) {
  console.log(`[sidepanel.js] Status: ${message}`);
  statusEl.textContent = message;
  statusEl.style.display = "block";
  
  if (duration > 0) {
    setTimeout(() => {
      statusEl.style.display = "none";
    }, duration);
  }
}

// Handle iframe load
geminiFrame.addEventListener("load", () => {
  console.log("[sidepanel.js] Gemini iframe loaded.");
  
  // If we have pending text, inject it after a delay
  if (pendingOcrText) {
    setTimeout(() => {
      injectTextIntoGemini(pendingOcrText);
      pendingOcrText = null;
    }, 2000);
  }
});

console.log("[sidepanel.js] Side panel script initialized.");