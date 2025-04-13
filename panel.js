// panel.js - JavaScript for the panel.html file
// This file contains all the functionality for the panel iframe
// With fixes for drag handling

// Track collapsed state
let isCollapsed = false;

// Get elements
const collapseBtn = document.getElementById('collapse-btn');
const closeBtn = document.getElementById('close-btn');
const contentPanel = document.getElementById('panel-content');
const contentIframe = document.getElementById('content-iframe');
const resizeHandle = document.getElementById('resize-handle');
const header = document.querySelector('.panel-header');

// Set iframe source to the popup.html from the extension
contentIframe.src = chrome.runtime.getURL('popup.html');

// Toggle collapse function
function toggleCollapse() {
  isCollapsed = !isCollapsed;
  
  if (isCollapsed) {
    contentPanel.style.display = 'none';
    collapseBtn.innerHTML = '▲';
    collapseBtn.title = 'Expand panel';
    // Tell parent to resize iframe
    window.parent.postMessage({
      action: 'resizePanel',
      height: '48px'
    }, '*');
  } else {
    contentPanel.style.display = 'flex';
    collapseBtn.innerHTML = '▼';
    collapseBtn.title = 'Collapse panel';
    // Tell parent to restore iframe
    window.parent.postMessage({
      action: 'resizePanel',
      height: '80vh'
    }, '*');
  }
  
  // Save collapsed state
  chrome.storage.local.set({panelCollapsed: isCollapsed})
    .catch(e => console.error('Error saving collapse state:', e));
}

// Close function
function closePanel() {
  // Tell parent to remove panel
  window.parent.postMessage({action: 'removePanel'}, '*');
}

// Add event listeners
collapseBtn.addEventListener('click', toggleCollapse);
closeBtn.addEventListener('click', closePanel);

// Dragging functionality - FIXED
let isDragging = false;

header.addEventListener('mousedown', function(e) {
  // Don't drag when clicking buttons
  if (e.target === collapseBtn || e.target === closeBtn) return;
  
  // Mark as dragging
  isDragging = true;
  
  // Get the coordinates relative to the viewport
  const rect = header.getBoundingClientRect();
  
  // Tell parent we're starting drag with correct offsets
  window.parent.postMessage({
    action: 'startDrag',
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top
  }, '*');
  
  e.preventDefault();
  e.stopPropagation();
});

// Handle mouseup inside iframe to end dragging
window.addEventListener('mouseup', function() {
  if (isDragging) {
    isDragging = false;
    window.parent.postMessage({action: 'stopDrag'}, '*');
  }
});

// Resizing functionality
resizeHandle.addEventListener('mousedown', function(e) {
  // Tell parent we're starting resize
  window.parent.postMessage({
    action: 'startResize',
    startX: e.clientX,
    startY: e.clientY
  }, '*');
  
  e.preventDefault();
  e.stopPropagation();
});

// Handle messages from parent
window.addEventListener('message', function(event) {
  // Check message is from parent
  if (event.source !== window.parent) return;
  
  const message = event.data;
  
  // Apply saved collapse state
  if (message.action === 'setCollapseState' && message.isCollapsed) {
    isCollapsed = true;
    toggleCollapse();
  }
  
  // Forward screenshot processing to content iframe
  if (message.action === 'processScreenshot' && contentIframe.contentWindow) {
    contentIframe.contentWindow.postMessage(message, '*');
  }
});

// Forward messages from content iframe to parent
window.addEventListener('message', function(event) {
  // Check if message is from content iframe
  if (event.source === contentIframe.contentWindow) {
    // Forward to parent
    window.parent.postMessage(event.data, '*');
  }
});

// Check for saved collapsed state
chrome.storage.local.get(['panelCollapsed'], function(result) {
  if (result.panelCollapsed) {
    isCollapsed = true;
    toggleCollapse();
  }
});