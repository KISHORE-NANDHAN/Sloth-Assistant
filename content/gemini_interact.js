// We listen for a postMessage from sidepanel.js then paste & submit in Gemini UI.
window.addEventListener("message", async (e) => {
  const msg = e.data;
  if (!msg || !msg.__GEMINI_EXT__ || msg.type !== "PASTE_AND_SEND") return;
  const text = msg.payload?.text || "";

  // Find Gemini input box; Gemini UI can change, so we try a few selectors.
  const candidates = [
    'textarea[aria-label="Message Gemini"]',
    'textarea[placeholder*="Message Gemini"]',
    'textarea'
  ];
  let input = null;
  for (const sel of candidates) {
    input = document.querySelector(sel);
    if (input) break;
  }

  if (!input) {
    console.warn("Gemini input not found.");
    return;
  }

  input.focus();
  input.value = text;

  // Ensure React/Vue-like UIs get the change
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  // Try to find the send button
  const sendBtn = document.querySelector('button[aria-label*="Send"], button[aria-label*="submit"], button[type="submit"]') 
               || input.closest("form")?.querySelector('button:not([disabled])');

  if (sendBtn) {
    sendBtn.click();
  } else {
    // Fallback: simulate Enter
    const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true });
    input.dispatchEvent(ev);
  }
});
