// content/overlay.js with Enhanced Debugging and Security Fixes

let overlay, rect, tip;
let startX = 0, startY = 0, endX = 0, endY = 0;
let selecting = false;
let overlayActive = false;

// Security: Mark that this script has been injected
window.ocrOverlayInjected = true;

console.log("[overlay.js] Content script loaded and initialized.");

// Enhanced message listener with validation
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[overlay.js] Message received:", msg, "from sender:", sender);
  
  // Security: Validate message structure
  if (!msg || typeof msg !== 'object') {
    console.warn("[overlay.js] Invalid message format received.");
    sendResponse({ ok: false, error: "Invalid message format" });
    return;
  }

  // Security: Ensure message comes from our extension
  if (sender.id !== chrome.runtime.id) {
    console.warn("[overlay.js] Message from unauthorized sender:", sender.id);
    sendResponse({ ok: false, error: "Unauthorized sender" });
    return;
  }

  try {
    if (msg.type === "START_REGION_SELECT") {
      startRegionSelect();
      sendResponse({ ok: true, message: "Region selection started" });
    } else {
      console.warn("[overlay.js] Unknown message type:", msg.type);
      sendResponse({ ok: false, error: "Unknown message type" });
    }
  } catch (error) {
    console.error("[overlay.js] Error handling message:", error);
    sendResponse({ ok: false, error: error.message });
  }
});

function startRegionSelect() {
  if (overlayActive || overlay) {
    console.warn("[overlay.js] Overlay already exists. Cleaning up first.");
    cleanup();
    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      createOverlay();
    }, 100);
    return;
  }
  
  createOverlay();
}

function createOverlay() {
  console.log("[overlay.js] Starting region selection.");
  
  try {
    // Create overlay elements with enhanced security
    overlay = document.createElement("div");
    overlay.id = "gemini-ocr-overlay";
    
    rect = document.createElement("div");
    rect.id = "gemini-ocr-rect";
    
    tip = document.createElement("div");
    tip.id = "gemini-ocr-tip";
    tip.textContent = "Drag to select region. Release to capture. ESC to cancel.";
    
    // Security: Prevent any potential XSS by ensuring clean elements
    overlay.innerHTML = "";
    rect.innerHTML = "";
    
    overlay.appendChild(rect);
    document.body.appendChild(overlay);
    document.body.appendChild(tip);

    // Add event listeners with proper error handling
    overlay.addEventListener("mousedown", onDown, { capture: true, passive: false });
    overlay.addEventListener("mousemove", onMove, { capture: true, passive: false });
    overlay.addEventListener("mouseup", onUp, { capture: true, passive: false });
    overlay.addEventListener("contextmenu", onContextMenu, { capture: true, passive: false });
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
    
    console.log("[overlay.js] Overlay created and event listeners attached.");
    overlayActive = true;
    
  } catch (error) {
    console.error("[overlay.js] Failed to create overlay:", error);
    cleanup();
  }
}

function onDown(e) {
  e.preventDefault();
  e.stopPropagation();
  
  selecting = true;
  startX = e.clientX;
  startY = e.clientY;
  console.log(`[overlay.js] Mouse Down at (${startX}, ${startY})`);
  updateRect(e);
}

function onMove(e) {
  if (!selecting) return;
  e.preventDefault();
  e.stopPropagation();
  updateRect(e);
}

function onUp(e) {
  if (!selecting) return;
  e.preventDefault();
  e.stopPropagation();
  
  selecting = false;
  updateRect(e);
  console.log(`[overlay.js] Mouse Up at (${e.clientX}, ${e.clientY}). Capturing region.`);
  
  // Small delay to ensure rect is properly updated
  setTimeout(() => {
    captureRegion();
    cleanup();
  }, 50);
}

function onContextMenu(e) {
  e.preventDefault();
  e.stopPropagation();
  console.log("[overlay.js] Context menu prevented during selection.");
}

function onKey(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    console.log("[overlay.js] Escape key pressed. Canceling selection.");
    cleanup();
  }
}

function updateRect(e) {
  if (!rect) return;
  
  endX = e.clientX;
  endY = e.clientY;
  
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
  if (!rect) {
    console.error("[overlay.js] No rect element found for capture.");
    return;
  }

  const x = parseInt(rect.style.left) || 0;
  const y = parseInt(rect.style.top) || 0;
  const w = parseInt(rect.style.width) || 0;
  const h = parseInt(rect.style.height) || 0;

  // Validate capture dimensions
  if (w < 10 || h < 10) {
    console.warn("[overlay.js] Capture region too small. Minimum 10x10 pixels required.");
    return;
  }

  if (w > 5000 || h > 5000) {
    console.warn("[overlay.js] Capture region too large. Maximum 5000x5000 pixels allowed.");
    return;
  }

  console.log(`[overlay.js] Capturing area: { x: ${x}, y: ${y}, w: ${w}, h: ${h} }`);
  
  try {
    // Request background script to capture the visible tab
    console.log("[overlay.js] Requesting tab capture from background script.");
    
    const response = await chrome.runtime.sendMessage({
      type: "REQUEST_TAB_CAPTURE",
      region: { x, y, w, h }
    });

    if (response && response.success && response.dataUrl) {
      console.log("[overlay.js] Received capture data from background. Processing...");
      const croppedDataUrl = await cropImage(response.dataUrl, x, y, w, h);
      
      // Send the cropped image to background for forwarding to sidepanel
      const storeResponse = await chrome.runtime.sendMessage({ 
        type: "REGION_CAPTURE_READY", 
        dataUrl: croppedDataUrl 
      });
      
      if (storeResponse && storeResponse.ok) {
        console.log("[overlay.js] Capture data stored successfully.");
      } else {
        console.error("[overlay.js] Failed to store capture data:", storeResponse?.error);
      }
      
    } else {
      console.error("[overlay.js] Capture request failed:", response?.error || "Unknown error");
    }
    
  } catch (error) {
    console.error("[overlay.js] Failed to capture region:", error);
  }
}

function cleanup() {
  console.log("[overlay.js] Cleaning up overlay elements and listeners.");
  
  try {
    if (overlay) {
      overlay.removeEventListener("mousedown", onDown, { capture: true });
      overlay.removeEventListener("mousemove", onMove, { capture: true });
      overlay.removeEventListener("mouseup", onUp, { capture: true });
      overlay.removeEventListener("contextmenu", onContextMenu, { capture: true });
      
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }
    
    if (tip && tip.parentNode) {
      tip.parentNode.removeChild(tip);
    }
    
    window.removeEventListener("keydown", onKey, { capture: true });
    
  } catch (error) {
    console.error("[overlay.js] Error during cleanup:", error);
  } finally {
    overlay = rect = tip = null;
    selecting = false;
    overlayActive = false;
  }
}

// Enhanced image cropping with error handling
function cropImage(dataUrl, x, y, w, h) {
  return new Promise((resolve, reject) => {
    try {
      // Security: Validate dataUrl format
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        reject(new Error("Invalid dataUrl format"));
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        try {
          const devicePixelRatio = window.devicePixelRatio || 1;
          const canvas = document.createElement("canvas");
          
          // Security: Limit canvas size to prevent memory issues
          const maxCanvasSize = 4096;
          const scaledW = Math.min(Math.round(w * devicePixelRatio), maxCanvasSize);
          const scaledH = Math.min(Math.round(h * devicePixelRatio), maxCanvasSize);
          
          canvas.width = scaledW;
          canvas.height = scaledH;
          
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }
          
          // Security: Clear canvas first
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          ctx.drawImage(
            img,
            Math.round(x * devicePixelRatio), Math.round(y * devicePixelRatio),
            Math.round(w * devicePixelRatio), Math.round(h * devicePixelRatio),
            0, 0,
            canvas.width, canvas.height
          );
          
          const croppedDataUrl = canvas.toDataURL("image/png", 0.9);
          console.log("[overlay.js] Image cropped successfully.");
          resolve(croppedDataUrl);
          
        } catch (error) {
          console.error("[overlay.js] Error during image cropping:", error);
          reject(error);
        }
      };
      
      img.onerror = (error) => {
        console.error("[overlay.js] Error loading image for cropping:", error);
        reject(new Error("Failed to load image for cropping"));
      };
      
      img.src = dataUrl;
      
    } catch (error) {
      console.error("[overlay.js] Error in cropImage function:", error);
      reject(error);
    }
  });
}

// Handle page unload
window.addEventListener("beforeunload", () => {
  console.log("[overlay.js] Page unloading. Cleaning up.");
  cleanup();
});

// Handle visibility change
document.addEventListener("visibilitychange", () => {
  if (document.hidden && overlay) {
    console.log("[overlay.js] Page hidden. Cleaning up overlay.");
    cleanup();
  }
});