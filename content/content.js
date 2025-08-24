let slothSidebar = null;

// content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", msg);
  sendResponse({ status: "ok" });
  if (message.action === "toggleSidebar") {
    console.log("Received toggleSidebar from popup");
    toggleSidebar(); // your injected sidebar function
    sendResponse({ status: "Sidebar toggled" });
  }
});

window.addEventListener("sloth-toggle", toggleSidebar);

function createSidebar() {
  if (document.getElementById("sloth-sidebar")) return;
  const sidebar = document.createElement("div");
  sidebar.id = "sloth-sidebar";
  sidebar.style.position = "fixed";
  sidebar.style.top = "0";
  sidebar.style.right = "0";
  sidebar.style.width = "300px";
  sidebar.style.height = "100%";
  sidebar.style.background = "#fff";
  sidebar.style.borderLeft = "2px solid #ccc";
  sidebar.style.zIndex = "999999";
  sidebar.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
  sidebar.innerHTML = `
    <div style="padding:16px; font-size:18px; font-weight:bold; border-bottom:1px solid #eee;">
      🦥 Sloth Sidebar
      <button id="sloth-close" style="float:right;">✖</button>
    </div>
    <div style="padding:16px;">Welcome to Sloth AI Assistant!</div>
  `;
  document.body.appendChild(sidebar);
  document.getElementById("sloth-close").onclick = () => sidebar.remove();
}

function toggleSidebar() {
  const sidebar = document.getElementById("sloth-sidebar");
  if (sidebar) {
    sidebar.remove();
  } else {
    createSidebar();
  }
}

// Example: Send a message to background when the page loads
chrome.runtime.sendMessage({ type: "GREET" }, (response) => {
  console.log("Background replied:", response.reply);
});

// You can add more logic here, e.g., OCR, sidebar, etc.