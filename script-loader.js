// Modified script-loader.js with mode awareness

// Helper function to load scripts in sequence
function loadScript(src, callback) {
  const script = document.createElement('script');
  script.src = src;
  script.onload = callback;
  script.onerror = function(error) {
    console.error('Error loading script:', src, error);
  };
  document.head.appendChild(script);  // Use head instead of body
}

// Function to check if we're in popup mode or panel mode
function checkInterfaceMode(callback) {
  // Determine which browser API to use
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  
  // Check storage for interface mode setting
  browserAPI.storage.local.get(['interfaceMode'], function(result) {
    const mode = result.interfaceMode || 'panel'; // Default to panel mode
    console.log('Current interface mode:', mode);
    callback(mode);
  });
}

// Function to initialize our script loading sequence
function initializeLoader() {
  console.log('Script loader initializing...');
  
  // Check if we're in the main popup HTML context, not in an iframe
  const isMainPopup = window === window.top;
  
  // Also check for specific URL pattern - we only want to run this in our popup
  const isPopupPage = window.location.href.includes('popup.html');
  
  if (isMainPopup && isPopupPage) {
    console.log('Running in main popup context');
    
    // Check the current interface mode
    checkInterfaceMode(function(mode) {
      if (mode === 'popup') {
        // We're in popup mode, so load scripts normally
        console.log('Loading detect-browser.js in popup mode');
        loadScript('detect-browser.js', function() {
          console.log('detect-browser.js loaded, now loading popup.js');
          // After browser detection is loaded, load the main popup script
          loadScript('popup.js', function() {
            console.log('popup.js loaded in popup mode');
          });
        });
      } else {
        // We're in panel mode but somehow the popup opened directly
        // This shouldn't happen, but we'll handle it by notifying background
        console.log('Warning: Popup opened while in panel mode');
        
        const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
        
        // Notify background script of this situation
        try {
          browserAPI.runtime.sendMessage({
            action: 'popupOpenedInPanelMode'
          }).catch(e => console.error('Error sending message:', e));
        } catch (e) {
          console.error('Error sending message to background:', e);
        }
        
        // Still load scripts so the popup works even in this edge case
        loadScript('detect-browser.js', function() {
          loadScript('popup.js', function() {
            console.log('Loaded scripts in unexpected mode');
          });
        });
      }
    });
  } else if (window !== window.top) {
    // We're in an iframe context (panel mode)
    console.log('Running in iframe context (panel mode)');
    
    // Load scripts normally
    loadScript('detect-browser.js', function() {
      loadScript('popup.js', function() {
        console.log('popup.js loaded in iframe mode');
      });
    });
  } else {
    console.log('Not running in popup or iframe context, skipping script loading');
  }
}

// Make sure we wait until DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLoader);
} else {
  // DOM is already loaded, initialize immediately
  initializeLoader();
}

console.log('Script loader initialized');