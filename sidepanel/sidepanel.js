// sidepanel/sidepanel.js with Enhanced Security and Debugging

const promptEl = document.getElementById("prompt");
const statusEl = document.getElementById("status");
const langEl = document.getElementById("lang");
const captureBtn = document.getElementById("captureBtn");
const ocrBtn = document.getElementById("ocrBtn");
const askGeminiBtn = document.getElementById("askGeminiBtn");

let lastCaptureDataUrl = null; // holds screenshot data from overlay
let ocrWorker = null; // Tesseract worker instance

console.log("[sidepanel.js] Script loaded and initialized.");

// --- Enhanced Event Listeners with Error Handling ---

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[sidepanel.js] DOM content loaded.");
  
  try {
    // Load saved data
    const result = await chrome.storage.local.get(["lastOcrText", "lastError"]);
    
    if (result.lastOcrText) {
      console.log("[sidepanel.js] Loaded last OCR text from storage.");
      promptEl.value = result.lastOcrText;
    }
    
    if (result.lastError) {
      console.log("[sidepanel.js] Displaying last error:", result.lastError);
      status(result.lastError, 5000);
      // Clear the error after displaying
      chrome.storage.local.remove(["lastError"]);
    }
    
  } catch (error) {
    console.error("[sidepanel.js] Error loading saved data:", error);
    status("Error loading saved data.");
  }
});

captureBtn.addEventListener("click", async () => {
  console.log("[sidepanel.js] 'Capture (OCR)' button clicked.");
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      console.warn("[sidepanel.js] No active tab found to start capture.");
      status("No active tab found.");
      return;
    }
    
    // Security: Check if tab URL is capturable
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      status("Cannot capture from protected pages.");
      return;
    }
    
    console.log(`[sidepanel.js] Sending capture request for tabId: ${tab.id}`);
    
    // Send message to background script to start OCR
    const response = await chrome.runtime.sendMessage({ type: "START_OCR_COMMAND" });
    
    if (response && response.ok) {
      status("Select a region on the page...", 0);
    } else {
      console.error("[sidepanel.js] Failed to start OCR:", response?.error);
      status("Failed to start capture.");
    }
    
  } catch (error) {
    console.error("[sidepanel.js] Error starting capture:", error);
    status("Error starting capture.");
  }
});

ocrBtn.addEventListener("click", async () => {
  console.log("[sidepanel.js] 'Run OCR' button clicked.");
  
  if (!lastCaptureDataUrl) {
    const msg = "No capture data found. Click 'Capture (OCR)' first.";
    console.warn(`[sidepanel.js] ${msg}`);
    status(msg);
    return;
  }
  
  // Security: Validate dataUrl format
  if (!lastCaptureDataUrl.startsWith('data:image/')) {
    console.error("[sidepanel.js] Invalid capture data format.");
    status("Invalid capture data.");
    return;
  }
  
  await runOcr(lastCaptureDataUrl, langEl.value);
});

askGeminiBtn.addEventListener("click", async () => {
  console.log("[sidepanel.js] 'Ask Gemini' button clicked.");
  
  const text = promptEl.value.trim();
  if (!text) {
    console.warn("[sidepanel.js] Prompt is empty. Nothing to send.");
    status("Nothing to send.");
    return;
  }
  
  // Security: Validate text length
  if (text.length > 10000) {
    console.warn("[sidepanel.js] Text too long. Truncating to 10000 characters.");
    promptEl.value = text.slice(0, 10000);
  }
  
  await sendToGemini(promptEl.value.trim());
});

// Auto-save text changes
promptEl.addEventListener("input", debounce(async () => {
  try {
    await chrome.storage.local.set({ lastOcrText: promptEl.value });
    console.log("[sidepanel.js] Text auto-saved.");
  } catch (error) {
    console.error("[sidepanel.js] Failed to auto-save text:", error);
  }
}, 1000));

// --- Enhanced Functions with Security and Error Handling ---

function status(text, duration = 2500) {
  console.log(`[sidepanel.js] Status update: ${text}`);
  
  // Security: Sanitize status text
  const sanitizedText = String(text).slice(0, 200); // Limit length
  statusEl.textContent = sanitizedText;
  
  if (duration > 0) {
    setTimeout(() => {
      statusEl.textContent = "";
    }, duration);
  }
}

async function runOcr(dataUrl, lang = "eng") {
  console.log(`[sidepanel.js] Starting OCR with language: ${lang}`);
  status("Starting OCR...", 0);
  
  // Disable buttons during OCR
  ocrBtn.disabled = true;
  captureBtn.disabled = true;
  
  try {
    // Security: Validate language parameter
    const allowedLanguages = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'rus', 'chi_sim', 'jpn', 'kor'];
    const safeLang = allowedLanguages.includes(lang) ? lang : 'eng';
    
    if (safeLang !== lang) {
      console.warn(`[sidepanel.js] Invalid language '${lang}', using 'eng' instead.`);
    }
    
    console.log(`[sidepanel.js] Creating Tesseract worker for language: ${safeLang}`);
    
    // Create worker with enhanced configuration
    ocrWorker = await Tesseract.createWorker({
      logger: (m) => {
        console.log(`[Tesseract Worker] ${m.status}: ${(m.progress * 100).toFixed(1)}%`);
        if (m.status === 'recognizing text') {
          status(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`, 0);
        }
      },
      errorHandler: (error) => {
        console.error("[Tesseract Worker] Error:", error);
      }
    });
    
    console.log("[sidepanel.js] Loading language...");
    status("Loading OCR language...", 0);
    await ocrWorker.loadLanguage(safeLang);
    
    console.log("[sidepanel.js] Initializing language...");
    status("Initializing OCR...", 0);
    await ocrWorker.initialize(safeLang);
    
    // Configure OCR parameters for better accuracy
    await ocrWorker.setParameters({
      tessedit_char_whitelist: '', // Allow all characters
      tessedit_pageseg_mode: Tesseract.PSM.AUTO, // Automatic page segmentation
      preserve_interword_spaces: '1'
    });
    
    console.log("[sidepanel.js] Recognizing text from image...");
    status("Recognizing text...", 0);
    
    const { data: { text, confidence } } = await ocrWorker.recognize(dataUrl);
    
    console.log(`[sidepanel.js] OCR recognition complete. Confidence: ${confidence}%`);
    
    await ocrWorker.terminate();
    ocrWorker = null;
    
    // Security: Sanitize OCR result
    const sanitizedText = text.trim().slice(0, 50000); // Limit to 50k characters
    
    promptEl.value = sanitizedText;
    await chrome.storage.local.set({ lastOcrText: sanitizedText });
    
    status(`OCR completed! Confidence: ${confidence.toFixed(1)}%`);
    
  } catch (error) {
    console.error("[sidepanel.js] OCR process failed:", error);
    status("OCR failed. Check console for details.");
    
    // Clean up worker on error
    if (ocrWorker) {
      try {
        await ocrWorker.terminate();
      } catch (terminateError) {
        console.error("[sidepanel.js] Failed to terminate OCR worker:", terminateError);
      }
      ocrWorker = null;
    }
  } finally {
    // Re-enable buttons
    ocrBtn.disabled = false;
    captureBtn.disabled = false;
  }
}

// Enhanced message listener with validation
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[sidepanel.js] Message received:", msg, "from sender:", sender);
  
  // Security: Validate message structure and sender
  if (!msg || typeof msg !== 'object') {
    console.warn("[sidepanel.js] Invalid message format received.");
    return;
  }
  
  if (sender.id !== chrome.runtime.id) {
    console.warn("[sidepanel.js] Message from unauthorized sender:", sender.id);
    return;
  }
  
  try {
    if (msg.type === "REGION_CAPTURE_READY") {
      console.log("[sidepanel.js] Received captured region dataUrl.");
      
      // Security: Validate dataUrl
      if (msg.dataUrl && typeof msg.dataUrl === 'string' && msg.dataUrl.startsWith('data:image/')) {
        lastCaptureDataUrl = msg.dataUrl;
        status("Region captured. Click 'Run OCR' to extract text.");
      } else {
        console.error("[sidepanel.js] Invalid capture data received.");
        status("Invalid capture data received.");
      }
    }
  } catch (error) {
    console.error("[sidepanel.js] Error processing message:", error);
  }
});

async function ensureGeminiTab() {
  console.log("[sidepanel.js] Ensuring Gemini tab exists.");
  
  try {
    const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
    
    if (tabs.length > 0) {
      console.log(`[sidepanel.js] Found existing Gemini tab: ${tabs[0].id}`);
      return tabs[0];
    }
    
    console.log("[sidepanel.js] No Gemini tab found. Creating a new one.");
    return await chrome.tabs.create({ 
      url: "https://gemini.google.com/app",
      active: false // Don't immediately switch to the new tab
    });
    
  } catch (error) {
    console.error("[sidepanel.js] Error managing Gemini tab:", error);
    throw error;
  }
}

async function sendToGemini(text) {
  console.log("[sidepanel.js] Preparing to send text to Gemini.");
  status("Sending to Gemini...", 0);
  
  // Disable button during send
  askGeminiBtn.disabled = true;
  
  try {
    // Security: Final text validation and sanitization
    if (!text || typeof text !== 'string') {
      throw new Error("Invalid text format");
    }
    
    const sanitizedText = text.trim().slice(0, 10000);
    if (!sanitizedText) {
      throw new Error("No text to send");
    }
    
    const tab = await ensureGeminiTab();
    console.log(`[sidepanel.js] Using Gemini tabId: ${tab.id}`);
    
    // Wait for tab to load if it's new
    if (tab.status !== 'complete') {
      console.log("[sidepanel.js] Waiting for Gemini tab to load...");
      status("Waiting for Gemini to load...", 0);
      
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
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
    
    // Focus the Gemini tab
    await chrome.tabs.update(tab.id, { active: true });
    
    // Wait a moment for tab to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log("[sidepanel.js] Injecting script to send text to Gemini.");
    
    // Inject the interaction script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (payload) => {
        console.log("[Injected Script] Sending message to Gemini page:", payload);
        window.postMessage({ 
          __GEMINI_EXT__: true, 
          type: "PASTE_AND_SEND", 
          payload 
        }, "*");
      },
      args: [{ text: sanitizedText }]
    });
    
    status("Text sent to Gemini successfully!");
    console.log("[sidepanel.js] Text sent to Gemini successfully.");
    
  } catch (error) {
    console.error("[sidepanel.js] Failed to send to Gemini:", error);
    status(`Failed to send: ${error.message}`);
  } finally {
    // Re-enable button
    askGeminiBtn.disabled = false;
  }
}

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Handle page unload
window.addEventListener("beforeunload", async () => {
  console.log("[sidepanel.js] Page unloading. Cleaning up.");
  
  if (ocrWorker) {
    try {
      await ocrWorker.terminate();
      console.log("[sidepanel.js] OCR worker terminated on unload.");
    } catch (error) {
      console.error("[sidepanel.js] Error terminating OCR worker on unload:", error);
    }
  }
});

// Handle visibility change
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    console.log("[sidepanel.js] Side panel hidden.");
  } else {
    console.log("[sidepanel.js] Side panel visible.");
  }
});