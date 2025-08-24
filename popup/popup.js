// popup.js
const toggleSidebarBtn = document.getElementById("toggleSidebar");
if (toggleSidebarBtn) {
  toggleSidebarBtn.addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Message failed:", chrome.runtime.lastError.message);
      } else {
        console.log("Response:", response);
      }
    });
  });
}

const greetBtn = document.getElementById("greetBtn");
if (greetBtn) {
  greetBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GREET" }, (response) => {
      if (response) {
        document.getElementById("response").textContent = response.reply;
      }
    });
  });
}
