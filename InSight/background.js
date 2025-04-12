console.log('Background script loaded');

// Listen for messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log(`[Background] Received message: ${request.action}`);
  
  // Handle tab capture request
  if (request.action === 'captureTab') {
    console.log('[Background] Processing capture tab request');
    
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
      if (chrome.runtime.lastError) {
        console.error(`[Background] Error capturing tab: ${chrome.runtime.lastError.message}`);
        sendResponse({status: 'error', message: chrome.runtime.lastError.message});
        return;
      }
      
      console.log('[Background] Tab captured successfully');
      
      // Store the screenshot and area for the popup to process
      chrome.storage.local.set({
        pendingScreenshot: {
          dataUrl: dataUrl,
          area: request.data
        }
      }, function() {
        // Try to notify popup that a screenshot is ready for processing
        try {
          chrome.runtime.sendMessage({
            action: 'processScreenshot'
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.log('[Background] Message sending error:', chrome.runtime.lastError.message);
              // This is normal if popup is closed, no need to handle error
            }
          });
        } catch (e) {
          console.log('[Background] Error sending message to popup:', e);
        }
        
        sendResponse({status: 'success'});
      });
    });
    
    return true; // Keep the messaging channel open for async response
  }
  
  return true;
});