// content/gemini_interact.js with Enhanced Security and Debugging

console.log("[gemini_interact.js] Content script loaded and listening for messages.");

// Security: Track message origins and rate limiting
const messageLog = new Map();
const MAX_MESSAGES_PER_MINUTE = 10;

function isRateLimited(origin) {
  const now = Date.now();
  const key = origin || 'unknown';
  
  if (!messageLog.has(key)) {
    messageLog.set(key, []);
  }
  
  const timestamps = messageLog.get(key);
  // Remove timestamps older than 1 minute
  const recentTimestamps = timestamps.filter(t => now - t < 60000);
  messageLog.set(key, recentTimestamps);
  
  if (recentTimestamps.length >= MAX_MESSAGES_PER_MINUTE) {
    console.warn(`[gemini_interact.js] Rate limit exceeded for origin: ${key}`);
    return true;
  }
  
  recentTimestamps.push(now);
  return false;
}

window.addEventListener("message", async (e) => {
  try {
    const msg = e.data;
    
    // Security: Validate message structure and origin
    if (!msg || typeof msg !== 'object') {
      console.warn("[gemini_interact.js] Invalid message format received.");
      return;
    }
    
    if (!msg.__GEMINI_EXT__ || msg.type !== "PASTE_AND_SEND") {
      return; // Not our message
    }
    
    // Security: Rate limiting
    if (isRateLimited(e.origin)) {
      console.warn("[gemini_interact.js] Message rate limited.");
      return;
    }
    
    console.log("[gemini_interact.js] Received valid message:", msg);
    
    // Security: Validate and sanitize text input
    const text = msg.payload?.text;
    if (!text || typeof text !== 'string') {
      console.warn("[gemini_interact.js] Message received, but payload text is invalid.");
      return;
    }
    
    // Security: Limit text length to prevent abuse
    const sanitizedText = text.slice(0, 10000); // Limit to 10k characters
    if (text.length > 10000) {
      console.warn("[gemini_interact.js] Text truncated due to length limit.");
    }

    await pasteAndSendToGemini(sanitizedText);
    
  } catch (error) {
    console.error("[gemini_interact.js] Error processing message:", error);
  }
});

async function pasteAndSendToGemini(text) {
  console.log("[gemini_interact.js] Attempting to paste and send text to Gemini.");
  
  try {
    // Enhanced input box detection with multiple strategies
    const input = await findGeminiInput();
    
    if (!input) {
      console.error("[gemini_interact.js] Could not find Gemini input textarea.");
      return;
    }

    console.log("[gemini_interact.js] Found input box. Setting text and triggering events.");
    
    // Focus the input
    input.focus();
    
    // Clear existing content first
    input.value = '';
    
    // Set new content
    input.value = text;
    
    // Trigger comprehensive events for different frameworks
    const events = [
      new Event("input", { bubbles: true, cancelable: true }),
      new Event("change", { bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }),
      new KeyboardEvent("keyup", { key: "a", ctrlKey: true, bubbles: true }),
      new Event("paste", { bubbles: true, cancelable: true })
    ];
    
    events.forEach(event => {
      try {
        input.dispatchEvent(event);
      } catch (eventError) {
        console.warn("[gemini_interact.js] Failed to dispatch event:", event.type, eventError);
      }
    });

    // Wait for UI to update
    await new Promise(resolve => setTimeout(resolve, 200));

    // Enhanced send button detection and clicking
    const success = await clickSendButton();
    
    if (!success) {
      console.warn("[gemini_interact.js] Could not click send button. Trying keyboard shortcut.");
      await simulateEnterKey(input);
    }
    
  } catch (error) {
    console.error("[gemini_interact.js] Error in pasteAndSendToGemini:", error);
  }
}

async function findGeminiInput() {
  // Multiple strategies to find the input box
  const strategies = [
    // Strategy 1: Common Gemini selectors
    () => document.querySelector('textarea[aria-label*="Message"]'),
    () => document.querySelector('textarea[placeholder*="Message"]'),
    () => document.querySelector('textarea[placeholder*="Ask"]'),
    
    // Strategy 2: Rich text editor
    () => document.querySelector('.ql-editor.textarea'),
    () => document.querySelector('[contenteditable="true"]'),
    
    // Strategy 3: Generic textarea (last resort)
    () => {
      const textareas = document.querySelectorAll('textarea');
      // Find the largest visible textarea
      let bestTextarea = null;
      let maxArea = 0;
      
      textareas.forEach(ta => {
        const rect = ta.getBoundingClientRect();
        const area = rect.width * rect.height;
        const isVisible = rect.width > 0 && rect.height > 0 && 
                         window.getComputedStyle(ta).display !== 'none';
        
        if (isVisible && area > maxArea) {
          maxArea = area;
          bestTextarea = ta;
        }
      });
      
      return bestTextarea;
    }
  ];
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      const input = strategies[i]();
      if (input) {
        console.log(`[gemini_interact.js] Found input using strategy ${i + 1}`);
        return input;
      }
    } catch (error) {
      console.warn(`[gemini_interact.js] Strategy ${i + 1} failed:`, error);
    }
  }
  
  return null;
}

async function clickSendButton() {
  // Multiple strategies to find and click the send button
  const buttonSelectors = [
    'button[aria-label*="Send"]',
    'button[aria-label*="submit"]',
    'button[data-testid*="send"]',
    'button[type="submit"]',
    'button:has(svg)', // Buttons with icons
    '[role="button"][aria-label*="Send"]'
  ];
  
  for (const selector of buttonSelectors) {
    try {
      const buttons = document.querySelectorAll(selector);
      
      for (const button of buttons) {
        // Check if button is visible and enabled
        const rect = button.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        const isEnabled = !button.disabled && 
                         window.getComputedStyle(button).pointerEvents !== 'none';
        
        if (isVisible && isEnabled) {
          console.log(`[gemini_interact.js] Clicking send button found with selector: ${selector}`);
          
          // Scroll button into view if needed
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Wait a moment for scroll
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Click the button
          button.click();
          
          // Also dispatch a proper click event
          button.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
          
          return true;
        }
      }
    } catch (error) {
      console.warn(`[gemini_interact.js] Error with selector ${selector}:`, error);
    }
  }
  
  return false;
}

async function simulateEnterKey(input) {
  console.log("[gemini_interact.js] Simulating Enter key press.");
  
  const keyEvents = [
    new KeyboardEvent("keydown", { 
      key: "Enter", 
      code: "Enter", 
      keyCode: 13, 
      which: 13, 
      bubbles: true,
      cancelable: true
    }),
    new KeyboardEvent("keypress", { 
      key: "Enter", 
      code: "Enter", 
      keyCode: 13, 
      which: 13, 
      bubbles: true,
      cancelable: true
    }),
    new KeyboardEvent("keyup", { 
      key: "Enter", 
      code: "Enter", 
      keyCode: 13, 
      which: 13, 
      bubbles: true,
      cancelable: true
    })
  ];
  
  keyEvents.forEach(event => {
    try {
      input.dispatchEvent(event);
    } catch (error) {
      console.warn("[gemini_interact.js] Failed to dispatch key event:", error);
    }
  });
}

// Security: Clean up on page unload
window.addEventListener("beforeunload", () => {
  console.log("[gemini_interact.js] Page unloading. Cleaning up.");
  messageLog.clear();
});

// Security: Monitor for suspicious activity
let suspiciousActivityCount = 0;
const MAX_SUSPICIOUS_ACTIVITY = 5;

window.addEventListener("error", (event) => {
  suspiciousActivityCount++;
  if (suspiciousActivityCount > MAX_SUSPICIOUS_ACTIVITY) {
    console.warn("[gemini_interact.js] Suspicious activity detected. Disabling script.");
    window.removeEventListener("message", arguments.callee);
  }
});