console.log('Background script loaded');

// Determine which browser API to use
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Listen for messages
browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log(`[Background] Received message: ${request.action}`);
  
  // Handle tab capture request
  if (request.action === 'captureTab') {
    console.log('[Background] Processing capture tab request');
    
    // Capture tab using appropriate method based on browser
    const capturePromise = browserAPI.tabs.captureVisibleTab(null, {format: 'png'});
    
    // Handle both Promise-based (Firefox) and callback-based (Chrome) APIs
    if (typeof browser !== 'undefined') {
      // Firefox (Promise-based)
      capturePromise.then(function(dataUrl) {
        processCapture(dataUrl, request, sendResponse);
      }).catch(function(error) {
        console.error(`[Background] Error capturing tab: ${error.message}`);
        sendResponse({status: 'error', message: error.message});
      });
    } else {
      // Chrome (callback-based)
      capturePromise.then(function(dataUrl) {
        processCapture(dataUrl, request, sendResponse);
      });
    }
    
    return true; // Keep the messaging channel open for async response
  }
  
  return true;
});

// Common capture processing function
function processCapture(dataUrl, request, sendResponse) {
  console.log('[Background] Tab captured successfully');
  
  // Store the screenshot and area for the popup to process
  browserAPI.storage.local.set({
    pendingScreenshot: {
      dataUrl: dataUrl,
      area: request.data
    }
  }, function() {
    // Try to notify popup that a screenshot is ready for processing
    try {
      browserAPI.runtime.sendMessage({
        action: 'processScreenshot'
      }, function(response) {
        if (browserAPI.runtime.lastError) {
          console.log('[Background] Message sending error:', browserAPI.runtime.lastError.message);
          // This is normal if popup is closed, no need to handle error
        }
      });
    } catch (e) {
      console.log('[Background] Error sending message to popup:', e);
    }
    
    sendResponse({status: 'success'});
  });
}

browserAPI.action.onClicked.addListener(function(tab) {
  // We'll handle the popup ourselves by the default_popup setting
  // This is just here to show we could add custom behavior when
  // the extension icon is clicked
});

browserAPI.runtime.onConnect.addListener(function(port) {
  if (port.name === 'popup') {
    console.log('Popup connected');
    
    // We can communicate with the popup if needed
    port.onMessage.addListener(function(msg) {
      console.log('Message from popup:', msg);
    });
  }
});
