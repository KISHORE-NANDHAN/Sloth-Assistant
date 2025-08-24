// content/overlay.js with Debugging

let overlay, rect, tip;
let startX=0, startY=0, endX=0, endY=0;
let selecting = false;

console.log("[overlay.js] Content script loaded.");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[overlay.js] Message received:", msg);
  if (msg?.type === "START_REGION_SELECT") {
    startRegionSelect();
    sendResponse({ ok: true });
  }
});

function startRegionSelect() {
  if (overlay) {
    console.warn("[overlay.js] Overlay already exists. Ignoring request.");
    return;
  }
  console.log("[overlay.js] Starting region selection.");
  
  overlay = document.createElement("div");
  overlay.id = "gemini-ocr-overlay";
  rect = document.createElement("div");
  rect.id = "gemini-ocr-rect";
  tip = document.createElement("div");
  tip.id = "gemini-ocr-tip";
  tip.textContent = "Drag to select region. Release to capture. ESC to cancel.";
  
  overlay.appendChild(rect);
  document.body.appendChild(overlay);
  document.body.appendChild(tip);

  overlay.addEventListener("mousedown", onDown, true);
  overlay.addEventListener("mousemove", onMove, true);
  overlay.addEventListener("mouseup", onUp, true);
  window.addEventListener("keydown", onKey, true);
}

function onDown(e){ 
  selecting = true; 
  startX = e.clientX; 
  startY = e.clientY;
  console.log(`[overlay.js] Mouse Down at (${startX}, ${startY})`);
  updateRect(e); 
}

function onMove(e){ 
  if (!selecting) return; 
  updateRect(e); 
}

function onUp(e){ 
  if (!selecting) return; 
  selecting = false; 
  updateRect(e);
  console.log(`[overlay.js] Mouse Up at (${e.clientX}, ${e.clientY}). Capturing region.`);
  captureRegion(); 
  cleanup(); 
}

function onKey(e){ 
  if (e.key === "Escape") {
    console.log("[overlay.js] Escape key pressed. Canceling selection.");
    cleanup(); 
  } 
}

function updateRect(e){
  endX = e.clientX; endY = e.clientY;
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(startX - endX);
  const h = Math.abs(startY - endY);
  rect.style.left = x + "px"; 
  rect.style.top = y + "px";
  rect.style.width = w + "px"; 
  rect.style.height = h + "px";
}

async function captureRegion() {
  const x = parseInt(rect.style.left), y = parseInt(rect.style.top);
  const w = parseInt(rect.style.width), h = parseInt(rect.style.height);

  if (!w || !h) {
    console.warn("[overlay.js] Capture region has zero width or height. Aborting.");
    return;
  }

  console.log(`[overlay.js] Capturing area: { x: ${x}, y: ${y}, w: ${w}, h: ${h} }`);
  try {
    const tab = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
    const dataUrl = await cropImage(tab, x, y, w, h);
    console.log("[overlay.js] Capture successful. Sending dataUrl to background.");
    chrome.runtime.sendMessage({ type: "REGION_CAPTURE_READY", dataUrl });
  } catch(e) {
    console.error("[overlay.js] Failed to capture or process region:", e);
  }
}

function cleanup(){
  console.log("[overlay.js] Cleaning up overlay elements and listeners.");
  if (overlay) {
    overlay.removeEventListener("mousedown", onDown, true);
    overlay.removeEventListener("mousemove", onMove, true);
    overlay.removeEventListener("mouseup", onUp, true);
    overlay.parentNode.removeChild(overlay);
  }
  if (tip?.parentNode) tip.parentNode.removeChild(tip);
  window.removeEventListener("keydown", onKey, true);
  
  overlay = rect = tip = null;
  selecting = false;
}

function cropImage(dataUrl, x, y, w, h) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * devicePixelRatio);
      canvas.height = Math.round(h * devicePixelRatio);
      const ctx = canvas.getContext("2d");
      
      ctx.drawImage(
        img,
        Math.round(x * devicePixelRatio), Math.round(y * devicePixelRatio), // source x, y
        Math.round(w * devicePixelRatio), Math.round(h * devicePixelRatio), // source width, height
        0, 0, // destination x, y
        canvas.width, canvas.height // destination width, height
      );
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}