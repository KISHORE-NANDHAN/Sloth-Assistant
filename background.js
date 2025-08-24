chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "injectContent") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ["content.js"]
    }, () => {
      sendResponse({ status: "Content injected" });
    });
    return true; // async response
  }

  if (message.type === "GREET") {
    sendResponse({ reply: "Hello from background!" });
  }
  // ...add more message handlers as needed...
});
