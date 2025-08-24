// sidepanel/sidepanel.js with Debugging

const promptEl = document.getElementById("prompt");
const statusEl = document.getElementById("status");
const langEl = document.getElementById("lang");
const captureBtn = document.getElementById("captureBtn");
const ocrBtn = document.getElementById("ocrBtn");
const askGeminiBtn = document.getElementById("askGeminiBtn");

let lastCaptureDataUrl = null; // holds screenshot data from overlay

console.log("[sidepanel.js] Script loaded.");

// --- Event Listeners ---

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["lastOcrText"]).then(({ lastOcrText }) => {
    if (lastOcrText) {
      console.log("[sidepanel.js] Loaded last OCR text from storage.");
      promptEl.value = lastOcrText;
    }
  });
});

captureBtn.addEventListener("click", async () => {
  console.log("[sidepanel.js] 'Capture (OCR)' button clicked.");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    console.log(`[sidepanel.js] Sending 'START_REGION_SELECT' to tabId: ${tab.id}`);
    // This now messages the background script to perform the injection
    chrome.runtime.sendMessage({ type: "START_OCR_COMMAND" });
    status("Select a region on the page...");
  } else {
    console.warn("[sidepanel.js] No active tab found to start capture.");
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
  await runOcr(lastCaptureDataUrl, langEl.value);
});

askGeminiBtn.addEventListener("click", async () => {
  console.log("[sidepanel.js] 'Ask Gemini' button clicked.");
  const text = promptEl.value.trim();
  if (!text) {
    console.warn("[sidepanel.js] Prompt is empty. Nothing to send.");
    return status("Nothing to send.");
  }
  await sendToGemini(text);
});


// --- Functions ---

function status(t, duration = 2500) { 
  console.log(`[sidepanel.js] Status update: ${t}`);
  statusEl.textContent = t; 
  if (duration > 0) {
    setTimeout(() => statusEl.textContent = "", duration);
  }
}

async function runOcr(dataUrl, lang = "eng") {
  status("Starting OCR...", 0);
  try {
    console.log(`[sidepanel.js] Creating Tesseract worker for language: ${lang}`);
    const worker = await Tesseract.createWorker({ 
      logger: m => console.log(`[Tesseract Worker] ${m.status}: ${(m.progress * 100).toFixed(2)}%`) 
    });
    console.log("[sidepanel.js] Loading language...");
    await worker.loadLanguage(lang);
    console.log("[sidepanel.js] Initializing language...");
    await worker.initialize(lang);
    console.log("[sidepanel.js] Recognizing text from image...");
    const { data: { text } } = await worker.recognize(dataUrl);
    console.log("[sidepanel.js] OCR recognition complete.");
    await worker.terminate();
    console.log("[sidepanel.js] Tesseract worker terminated.");
    
    promptEl.value = text.trim();
    await chrome.storage.local.set({ lastOcrText: promptEl.value });
    status("OCR done!");
  } catch (error) {
    console.error("[sidepanel.js] OCR process failed:", error);
    status("OCR failed. See console.");
  }
}

// Listen for the screenshot data forwarded from the background script
chrome.runtime.onMessage.addListener((msg) => {
  console.log("[sidepanel.js] Message received:", msg);
  if (msg?.type === "REGION_CAPTURE_READY") {
    console.log("[sidepanel.js] Received captured region dataUrl.");
    lastCaptureDataUrl = msg.dataUrl;
    status("Region captured. Click 'Run OCR'.");
  }
});

async function ensureGeminiTab() {
  console.log("[sidepanel.js] Ensuring Gemini tab exists.");
  const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
  if (tabs.length) {
    console.log(`[sidepanel.js] Found existing Gemini tab: ${tabs[0].id}`);
    return tabs[0];
  }
  console.log("[sidepanel.js] No Gemini tab found. Creating a new one.");
  return await chrome.tabs.create({ url: "https://gemini.google.com/app" });
}

async function sendToGemini(text) {
  status("Sending to Gemini...", 0);
  try {
    const tab = await ensureGeminiTab();
    console.log(`[sidepanel.js] Focusing Gemini tabId: ${tab.id} and injecting script.`);
    
    await chrome.tabs.update(tab.id, { active: true });
    
    // Inject the interaction logic into the Gemini tab
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (payload) => {
        // This function runs in the context of the Gemini page
        window.postMessage({ __GEMINI_EXT__: true, type: "PASTE_AND_SEND", payload }, "*");
      },
      args: [{ text }]
    });
    
    status("Sent to Gemini.");
  } catch (error) {
    console.error("[sidepanel.js] Failed to send to Gemini:", error);
    status("Failed to send. See console.");
  }
}