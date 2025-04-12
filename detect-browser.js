// This script detects whether we're in Firefox or Chrome and sets up the appropriate API
(function() {
  // Detect if we're in Firefox (has browser object)
  window.isFirefox = typeof browser !== 'undefined';
  
  // Create a unified API that works in both browsers
  window.browserAPI = window.isFirefox ? browser : chrome;
  
  console.log('Browser detected:', window.isFirefox ? 'Firefox' : 'Chrome');
})();