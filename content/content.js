// content/content.js with Enhanced Security and Debugging

let slothSidebar = null;

console.log("[content.js] Content script loaded.");

// Enhanced message listener with input validation
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[content.js] Message received:", message, "from sender:", sender);
  
  // Security: Validate message structure
  if (!message || typeof message !== 'object') {
    console.warn("[content.js] Invalid message format received.");
    sendResponse({ status: "error", error: "Invalid message format" });
    return;
  }

  // Security: Ensure message comes from our extension
  if (sender.id !== chrome.runtime.id) {
    console.warn("[content.js] Message from unauthorized sender:", sender.id);
    sendResponse({ status: "error", error: "Unauthorized sender" });
    return;
  }

  try {
    if (message.action === "toggleSidebar") {
      console.log("[content.js] Received toggleSidebar from popup");
      toggleSidebar();
      sendResponse({ status: "Sidebar toggled" });
    } else {
      console.warn("[content.js] Unknown action:", message.action);
      sendResponse({ status: "error", error: "Unknown action" });
    }
  } catch (error) {
    console.error("[content.js] Error handling message:", error);
    sendResponse({ status: "error", error: error.message });
  }
});

// Enhanced custom event listener
window.addEventListener("sloth-toggle", (event) => {
  console.log("[content.js] Custom sloth-toggle event received:", event);
  toggleSidebar();
});

function createSidebar() {
  if (document.getElementById("sloth-sidebar")) {
    console.log("[content.js] Sidebar already exists.");
    return;
  }
  
  console.log("[content.js] Creating sidebar.");
  
  try {
    const sidebar = document.createElement("div");
    sidebar.id = "sloth-sidebar";
    
    // Enhanced styling with security considerations
    Object.assign(sidebar.style, {
      position: "fixed",
      top: "0",
      right: "0",
      width: "300px",
      height: "100%",
      background: "#fff",
      borderLeft: "2px solid #ccc",
      zIndex: "2147483647", // Maximum z-index for security
      boxShadow: "0 0 10px rgba(0,0,0,0.2)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "14px",
      overflow: "hidden"
    });
    
    // Security: Use textContent instead of innerHTML to prevent XSS
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "16px",
      fontSize: "18px",
      fontWeight: "bold",
      borderBottom: "1px solid #eee",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    });
    
    const title = document.createElement("span");
    title.textContent = "🦥 Sloth Sidebar";
    
    const closeBtn = document.createElement("button");
    closeBtn.id = "sloth-close";
    closeBtn.textContent = "✖";
    Object.assign(closeBtn.style, {
      background: "none",
      border: "none",
      fontSize: "16px",
      cursor: "pointer",
      padding: "4px 8px",
      borderRadius: "4px"
    });
    
    closeBtn.addEventListener("click", () => {
      console.log("[content.js] Close button clicked.");
      removeSidebar();
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const content = document.createElement("div");
    Object.assign(content.style, {
      padding: "16px",
      height: "calc(100% - 60px)",
      overflow: "auto"
    });
    content.textContent = "Welcome to Sloth AI Assistant!";
    
    sidebar.appendChild(header);
    sidebar.appendChild(content);
    document.body.appendChild(sidebar);
    
    slothSidebar = sidebar;
    console.log("[content.js] Sidebar created successfully.");
    
  } catch (error) {
    console.error("[content.js] Error creating sidebar:", error);
  }
}

function removeSidebar() {
  const sidebar = document.getElementById("sloth-sidebar");
  if (sidebar) {
    console.log("[content.js] Removing sidebar.");
    try {
      sidebar.remove();
      slothSidebar = null;
      console.log("[content.js] Sidebar removed successfully.");
    } catch (error) {
      console.error("[content.js] Error removing sidebar:", error);
    }
  }
}

function toggleSidebar() {
  console.log("[content.js] Toggling sidebar.");
  const sidebar = document.getElementById("sloth-sidebar");
  if (sidebar) {
    removeSidebar();
  } else {
    createSidebar();
  }
}

// Enhanced greeting with error handling
try {
  chrome.runtime.sendMessage({ type: "GREET" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[content.js] Failed to send greeting:", chrome.runtime.lastError.message);
    } else if (response) {
      console.log("[content.js] Background replied:", response.reply);
    }
  });
} catch (error) {
  console.error("[content.js] Error sending greeting:", error);
}

// Handle page unload
window.addEventListener("beforeunload", () => {
  console.log("[content.js] Page unloading. Cleaning up.");
  removeSidebar();
});

// Security: Prevent sidebar from being manipulated by page scripts
Object.freeze(window.slothSidebar);