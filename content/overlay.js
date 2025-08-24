let overlay, rect, tip;
let startX=0, startY=0, endX=0, endY=0;
let selecting = false;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "START_REGION_SELECT") startRegionSelect();
});

function startRegionSelect() {
  if (overlay) return;
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

function onDown(e){ selecting = true; startX = e.clientX; startY = e.clientY; updateRect(e); }
function onMove(e){ if (!selecting) return; updateRect(e); }
function onUp(e){ if (!selecting) return; selecting = false; updateRect(e); captureRegion(); cleanup(); }
function onKey(e){ if (e.key === "Escape") { cleanup(); } }

function updateRect(e){
  endX = e.clientX; endY = e.clientY;
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(startX - endX);
  const h = Math.abs(startY - endY);
  rect.style.left = x + "px"; rect.style.top = y + "px";
  rect.style.width = w + "px"; rect.style.height = h + "px";
}

async function captureRegion() {
  const x = parseInt(rect.style.left), y = parseInt(rect.style.top);
  const w = parseInt(rect.style.width), h = parseInt(rect.style.height);
  if (!w || !h) return;

  const dataUrl = await captureVisibleArea(x, y, w, h);
  chrome.runtime.sendMessage({ type: "REGION_CAPTURE_READY", dataUrl });
  chrome.runtime.sendMessage({ type: "OCR_TEXT_READY", text: "" }); // optional trigger
}

function cleanup(){
  if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
  if (tip?.parentNode) tip.parentNode.removeChild(tip);
  overlay = rect = tip = null;
  selecting = false;
}

// captureVisibleTab + crop using canvas
async function captureVisibleArea(x, y, w, h) {
  const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
  const img = new Image();
  const done = new Promise((res) => img.onload = res);
  img.src = dataUrl; await done;

  const devicePixelRatio = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * devicePixelRatio);
  canvas.height = Math.round(h * devicePixelRatio);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    img,
    Math.round(x * devicePixelRatio), Math.round(y * devicePixelRatio),
    Math.round(w * devicePixelRatio), Math.round(h * devicePixelRatio),
    0, 0, canvas.width, canvas.height
  );
  return canvas.toDataURL("image/png");
}
