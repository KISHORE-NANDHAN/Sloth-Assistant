// content/gemini_interact.js with Debugging

console.log("[gemini_interact.js] Content script loaded and listening for messages.");

window.addEventListener("message", async (e) => {
  const msg = e.data;
  
  // Basic validation
  if (!msg || !msg.__GEMINI_EXT__ || msg.type !== "PASTE_AND_SEND") return;
  
  console.log("[gemini_interact.js] Received message:", msg);
  const text = msg.payload?.text || "";
  if (!text) {
    console.warn("[gemini_interact.js] Message received, but payload text is empty.");
    return;
  }

  // Find Gemini input box; Gemini UI can change, so we try a few selectors.
  const candidates = [
    'textarea[aria-label="Message Gemini"]',
    'textarea[placeholder*="Message Gemini"]',
    '.ql-editor.textarea', // A selector seen in Gemini's rich text editor
    'textarea'
  ];
  let input = null;
  for (const sel of candidates) {
    input = document.querySelector(sel);
    if (input) {
      console.log(`[gemini_interact.js] Found input box with selector: '${sel}'`);
      break;
    }
  }

  if (!input) {
    console.error("[gemini_interact.js] Could not find Gemini input textarea.");
    return;
  }

  console.log("[gemini_interact.js] Focusing input and setting its value.");
  input.focus();
  input.value = text;

  // Dispatch events to ensure UI frameworks like React detect the change
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  // Wait a moment for the UI to update (e.g., enabling the send button)
  await new Promise(resolve => setTimeout(resolve, 100));

  // Try to find and click the send button
  const sendBtn = document.querySelector('button[aria-label*="Send"], button[aria-label*="submit"], button[data-id][aria-label]');
  
  if (sendBtn) {
    console.log("[gemini_interact.js] Found send button. Clicking it.", sendBtn);
    sendBtn.click();
  } else {
    // Fallback: simulate Enter key press if button not found
    console.warn("[gemini_interact.js] Could not find send button. Falling back to simulating 'Enter' key.");
    const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true });
    input.dispatchEvent(ev);
  }
});