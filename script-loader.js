// This file loads our scripts properly for Chrome extensions
// The key difference is we don't use async/await which seems to cause issues

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
  
  // Function to initialize our script loading sequence
  function initializeLoader() {
    // Load our first script (browser detection)
    console.log('Loading detect-browser.js');
    loadScript('detect-browser.js', function() {
      console.log('detect-browser.js loaded, now loading popup.js');
      // After browser detection is loaded, load the main popup script
      loadScript('popup.js', function() {
        console.log('popup.js loaded');
        // No need to manually initialize since popup.js now handles its own initialization
      });
    });
  }
  
  // Make sure we wait until DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoader);
  } else {
    // DOM is already loaded, initialize immediately
    initializeLoader();
  }
  
  console.log('Script loader initialized');