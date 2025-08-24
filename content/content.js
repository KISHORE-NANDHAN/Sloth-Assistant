let slothSidebar = null;

// content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleSidebar") {
    console.log("Received toggleSidebar from popup");
    toggleSidebar(); // your injected sidebar function
    sendResponse({ status: "Sidebar toggled" });
  }
});

window.addEventListener("sloth-toggle", toggleSidebar);

function toggleSidebar() {
  if (slothSidebar) {
    slothSidebar.remove();
    slothSidebar = null;
    return;
  }

  slothSidebar = document.createElement("div");
  slothSidebar.id = "sloth-sidebar";

  let iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("sidebar/sidebar.html");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";

    slothSidebar.appendChild(iframe);
    document.body.appendChild(slothSidebar);
    console.log("Sidebar added");
}

// Example: Send a message to background when the page loads
chrome.runtime.sendMessage({ type: "GREET" }, (response) => {
  console.log("Background replied:", response.reply);
});

// You can add more logic here, e.g., OCR, sidebar, etc.