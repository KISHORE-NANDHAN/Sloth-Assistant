let slothSidebar = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "toggleSidebar") { // Fixed: removed extra parenthesis
    toggleSidebar();
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