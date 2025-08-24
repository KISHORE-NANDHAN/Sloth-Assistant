const promptEl = document.getElementById("prompt");
const statusEl = document.getElementById("status");
const langEl = document.getElementById("lang");
const captureBtn = document.getElementById("captureBtn");
const ocrBtn = document.getElementById("ocrBtn");
const askGeminiBtn = document.getElementById("askGeminiBtn");

let lastCaptureDataUrl = null; // holds screenshot data from overlay

// Load last OCR text if any
chrome.storage.local.get(["lastOcrText"]).then(({ lastOcrText }) => {
  if (lastOcrText) promptEl.value = lastOcrText;
});

captureBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "START_REGION_SELECT" });
});

ocrBtn.addEventListener("click", async () => {
  if (!lastCaptureDataUrl) {
    status("No capture yet. Click Capture (OCR) or press Alt+O.");
    return;
  }
  await runOcr(lastCaptureDataUrl, langEl.value);
});

askGeminiBtn.addEventListener("click", async () => {
  const text = promptEl.value.trim();
  if (!text) return status("Nothing to send.");
  await sendToGemini(text);
});

function status(t) { statusEl.textContent = t; setTimeout(()=>statusEl.textContent="", 2500); }

async function runOcr(dataUrl, lang="eng") {
  status("OCR running...");
  const worker = await Tesseract.createWorker({ logger: () => {} });
  await worker.loadLanguage(lang);
  await worker.initialize(lang);
  const { data: { text } } = await worker.recognize(dataUrl);
  await worker.terminate();
  promptEl.value = text.trim();
  await chrome.storage.local.set({ lastOcrText: promptEl.value });
  status("OCR done");
}

// Receive screenshot data from overlay
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "REGION_CAPTURE_READY") {
    lastCaptureDataUrl = msg.dataUrl;
    status("Region captured. Click Run OCR.");
  }
});

async function ensureGeminiTab() {
  const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
  if (tabs.length) return tabs[0];
  return await chrome.tabs.create({ url: "https://gemini.google.com/app" });
}

async function sendToGemini(text) {
  const tab = await ensureGeminiTab();
  // Focus tab then tell gemini_inject to paste & send
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (payload) => window.postMessage({ __GEMINI_EXT__: true, type: "PASTE_AND_SEND", payload }, "*"),
    args: [ { text } ]
  });
  status("Sent to Gemini.");
}
