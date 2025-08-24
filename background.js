chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "toggleSidebar") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      func: () => {
        window.dispatchEvent(new CustomEvent("sloth-toggle"));
      }
    });
  }
});
