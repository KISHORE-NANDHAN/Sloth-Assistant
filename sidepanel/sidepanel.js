// sidepanel/sidepanel.js - Gemini Integration with Auto OCR

const captureBtn = document.getElementById("capture-overlay");
const statusEl = document.getElementById("status");
const promptInput = document.getElementById("prompt-input");
const sendBtn = document.getElementById("send-btn");
const messagesContainer = document.getElementById("messages");

console.log("[sidepanel.js] Gemini side panel loaded.");

// Event Listeners
captureBtn.addEventListener("click", startCapture);
sendBtn.addEventListener("click", sendToGemini);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[sidepanel.js] Message received:", message);
  
  if (message.type === "OCR_TEXT_READY") {
    console.log("[sidepanel.js] OCR text ready:", message.text);
    handleOCRText(message.text);
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
      handleOCRText(result.pendingOcrText);
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

function handleOCRText(text) {
  if (!text || !text.trim()) {
    console.warn("[sidepanel.js] No text to handle.");
    return;
  }
  
  console.log("[sidepanel.js] Handling OCR text:", text);
  
  // Fill the input with OCR text
  promptInput.value = text.trim();
  
  // Add message to chat
  addMessage("OCR Extracted", text.trim(), "user");
  
  // Show success status
  showStatus("OCR text ready! Click 'Send to Gemini' or edit the text first.", 5000);
  
  // Focus the input for editing if needed
  promptInput.focus();
}

function addMessage(sender, content, type) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}`;
  
  const headerDiv = document.createElement("div");
  headerDiv.className = "message-header";
  headerDiv.textContent = sender;
  
  const contentDiv = document.createElement("div");
  contentDiv.textContent = content;
  
  messageDiv.appendChild(headerDiv);
  messageDiv.appendChild(contentDiv);
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendToGemini() {
  const text = promptInput.value.trim();
  
  if (!text) {
    showStatus("Please enter some text to send to Gemini", 3000);
    return;
  }
  
  console.log("[sidepanel.js] Opening Gemini with text:", text);
  
  try {
    // Open Gemini in a new tab with the text
    const geminiUrl = `https://gemini.google.com/app?q=${encodeURIComponent(text)}`;
    
    await chrome.tabs.create({
      url: geminiUrl,
      active: true
    });
    
    addMessage("You", text, "user");
    addMessage("System", "Opened Gemini in new tab with your text!", "assistant");
    
    // Clear the input
    promptInput.value = "";
    
    showStatus("Opened Gemini in new tab!", 3000);
    
  } catch (error) {
    console.error("[sidepanel.js] Error opening Gemini:", error);
    showStatus("Error opening Gemini", 3000);
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

// Handle Enter key in textarea
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    sendToGemini();
  }
});

console.log("[sidepanel.js] Side panel script initialized.");