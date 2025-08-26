// content/gemini_inject.js - Handles text injection in Gemini iframe

console.log("[gemini_inject.js] Content script loaded for Gemini iframe.");

// Listen for messages from the side panel
window.addEventListener("message", async (event) => {
  // Security: Only accept messages from our extension's origin
  if (event.origin !== window.location.origin) {
    return;
  }
  
  const message = event.data;
  if (!message || message.type !== "INJECT_OCR_TEXT") {
    return;
  }
  
  console.log("[gemini_inject.js] Received text injection request:", message.text);
  
  try {
    await injectTextIntoInput(message.text);
  } catch (error) {
    console.error("[gemini_inject.js] Error injecting text:", error);
  }
});

async function injectTextIntoInput(text) {
  console.log("[gemini_inject.js] Attempting to inject text into Gemini input.");
  
  // Wait for page to be ready
  await waitForPageReady();
  
  // Multiple strategies to find the input
  const input = await findGeminiInput();
  
  if (!input) {
    console.error("[gemini_inject.js] Could not find Gemini input field.");
    return;
  }
  
  console.log("[gemini_inject.js] Found input field, injecting text.");
  
  // Focus the input
  input.focus();
  
  // Clear existing content
  if (input.value !== undefined) {
    input.value = "";
  } else if (input.textContent !== undefined) {
    input.textContent = "";
  }
  
  // Set the new text
  if (input.value !== undefined) {
    input.value = text;
  } else if (input.textContent !== undefined) {
    input.textContent = text;
  }
  
  // Trigger events to notify React/Vue/etc
  const events = [
    new Event("input", { bubbles: true }),
    new Event("change", { bubbles: true }),
    new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }),
    new KeyboardEvent("keyup", { key: "a", ctrlKey: true, bubbles: true })
  ];
  
  events.forEach(event => {
    try {
      input.dispatchEvent(event);
    } catch (e) {
      console.warn("[gemini_inject.js] Failed to dispatch event:", e);
    }
  });
  
  console.log("[gemini_inject.js] Text injected successfully.");
}

async function findGeminiInput() {
  const selectors = [
    'textarea[placeholder*="Enter a prompt"]',
    'textarea[placeholder*="Message"]',
    'textarea[aria-label*="Message"]',
    'textarea[placeholder*="Ask"]',
    '.ql-editor.textarea',
    '[contenteditable="true"]',
    'textarea:not([readonly]):not([disabled])'
  ];
  
  for (let attempt = 0; attempt < 10; attempt++) {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.width > 100 && rect.height > 30;
        const isInteractable = !element.disabled && !element.readOnly;
        
        if (isVisible && isInteractable) {
          console.log(`[gemini_inject.js] Found input with selector: ${selector}`);
          return element;
        }
      }
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return null;
}

async function waitForPageReady() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
      return;
    }
    
    const checkReady = () => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        setTimeout(checkReady, 100);
      }
    };
    
    checkReady();
  });
}