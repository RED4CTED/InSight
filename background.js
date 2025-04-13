console.log('Background script loaded');

// Determine which browser API to use
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// For action API compatibility between Firefox and Chrome
const actionAPI = typeof browser !== 'undefined' ? 
                  browser.browserAction : // Firefox uses browserAction
                  chrome.action;          // Chrome uses action

// Track panel state
let isPanelOpen = false;
let lastMode = null; // Track the last used mode
let modeChangeInProgress = false; // Flag to prevent operation overlap

// Listen for toolbar icon clicks - using the correct API for each browser
actionAPI.onClicked.addListener(function(tab) {
  console.log('[Background] Extension icon clicked');
  
  // Prevent concurrent operations
  if (modeChangeInProgress) {
    console.log('[Background] Mode change already in progress, ignoring click');
    return;
  }
  
  modeChangeInProgress = true;
  
  // Get the current mode from storage
  browserAPI.storage.local.get(['interfaceMode'], function(result) {
    const mode = result.interfaceMode || 'panel'; // Default to panel
    console.log('[Background] Interface mode from storage:', mode);
    
    // Force close any existing panel
    tryRemovePanel(tab).finally(() => {
      // Always clear the popup setting before proceeding
      if (typeof browser !== 'undefined') {
        // Firefox
        browser.browserAction.setPopup({popup: ''}).then(() => {
          handleMode(mode, tab);
        }).catch(error => {
          console.error('[Background] Error clearing popup:', error);
          modeChangeInProgress = false;
        });
      } else {
        // Chrome
        chrome.action.setPopup({popup: ''}, () => {
          setTimeout(() => {
            handleMode(mode, tab);
          }, 100); // Small delay to ensure Chrome processes the popup removal
        });
      }
    });
  });
  
  // Function to handle mode selection
  function handleMode(mode, tab) {
    console.log('[Background] Handling mode:', mode);
    
    if (mode === 'popup') {
      // Popup mode
      lastMode = 'popup';
      
      if (typeof browser !== 'undefined') {
        // Firefox - can programmatically open popup
        browser.browserAction.setPopup({popup: 'popup.html'}).then(() => {
          return browser.browserAction.openPopup();
        }).finally(() => {
          modeChangeInProgress = false;
        });
      } else {
        // Chrome - set popup and notify user
        chrome.action.setPopup({popup: 'popup.html'}, () => {
          console.log('[Background] Popup set in Chrome, ready for click');
          
          // Create notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'InSight Extension',
            message: 'Click the icon again to open in popup mode'
          });
          
          modeChangeInProgress = false;
        });
      }
    } else {
      // Panel mode
      console.log('[Background] Activating panel mode');
      
      lastMode = 'panel';
      isPanelOpen = true; // We're opening the panel
      
      // First ensure any existing panel is removed
      tryRemovePanel(tab).finally(() => {
        // Then inject the new panel
        injectPanel(tab).finally(() => {
          modeChangeInProgress = false;
        });
      });
    }
  }
});

// Helper function to inject the panel with fail-safe
function injectPanel(tab) {
  console.log('[Background] Injecting panel in tab', tab.id);
  
  return browserAPI.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['panel-injection.js']
  })
  .then(() => {
    // Add small delay to ensure script is fully loaded
    return new Promise(resolve => setTimeout(resolve, 50));
  })
  .then(() => {
    console.log('[Background] Panel script injected, creating panel');
    return browserAPI.scripting.executeScript({
      target: {tabId: tab.id},
      func: () => {
        try {
          // Check if function exists
          if (typeof injectInsightPanel === 'function') {
            return injectInsightPanel();
          } else {
            throw new Error('Panel injection function not found');
          }
        } catch (e) {
          console.error('Error in panel injection:', e);
          return 'Error: ' + e.message;
        }
      }
    });
  })
  .then((results) => {
    console.log('[Background] Panel creation result:', results);
    return results;
  })
  .catch(error => {
    console.error('[Background] Panel injection error:', error);
    isPanelOpen = false;
    return Promise.reject(error);
  });
}

// Helper function to try removing any existing panel
function tryRemovePanel(tab) {
  console.log('[Background] Trying to remove any existing panel');
  
  // Try to execute removal function, but don't fail if there's an error
  return browserAPI.scripting.executeScript({
    target: {tabId: tab.id},
    func: () => {
      try {
        // Try to use the dedicated function first
        if (typeof removeInsightPanel === 'function') {
          removeInsightPanel();
          return 'Panel removed via function';
        }
        
        // Fall back to direct DOM removal
        const panel = document.getElementById('insight-extension-frame');
        if (panel) {
          panel.remove();
          return 'Panel removed via DOM';
        }
        
        // Also check for old container (for backwards compatibility)
        const container = document.getElementById('insight-extension-container');
        if (container) {
          container.remove();
          return 'Old panel container removed';
        }
        
        return 'No panel found to remove';
      } catch (e) {
        console.error('Error removing panel:', e);
        return 'Error: ' + e.message;
      }
    }
  })
  .then((results) => {
    console.log('[Background] Panel removal result:', results);
    isPanelOpen = false;
    return results;
  })
  .catch(error => {
    console.error('[Background] Panel removal attempt error:', error);
    // Don't propagate this error - we want the process to continue
    return null;
  });
}

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
  
  // Handle popup opened unexpectedly
  if (request.action === 'popupOpenedInPanelMode') {
    console.log('[Background] Popup opened while in panel mode, fixing...');
    // Reset popup setting
    if (typeof browser !== 'undefined') {
      browser.browserAction.setPopup({popup: ''});
    } else {
      chrome.action.setPopup({popup: ''});
    }
    // No response needed
  }
  
  // Handle close panel notification
  if (request.action === 'closePanel') {
    console.log('[Background] Received closePanel message');
    isPanelOpen = false;
    if (sendResponse) sendResponse({status: 'ok'});
  }
  
  // Handle mode change notification
  if (request.action === 'modeChanged') {
    console.log('[Background] Mode changed to:', request.mode);
    // Update last mode
    lastMode = request.mode;
    // Reset panel state
    isPanelOpen = false;
    // Clear popup setting
    if (typeof browser !== 'undefined') {
      browser.browserAction.setPopup({popup: ''});
    } else {
      chrome.action.setPopup({popup: ''});
    }
    if (sendResponse) sendResponse({status: 'ok'});
  }
  
  return true; // Keep the messaging channel open
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
      // First try to notify a regular popup if it's open
      browserAPI.runtime.sendMessage({
        action: 'processScreenshot',
        data: {
          dataUrl: dataUrl,
          area: request.data
        }
      }, function(response) {
        if (browserAPI.runtime.lastError) {
          console.log('[Background] Message sending error:', browserAPI.runtime.lastError.message);
          // This is normal if popup is closed, no need to handle error
        }
      });
      
      // Also try to notify the panel in the active tab if we're in panel mode
      browserAPI.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
          browserAPI.tabs.sendMessage(tabs[0].id, {
            action: 'processScreenshot',
            data: {
              dataUrl: dataUrl,
              area: request.data
            }
          }).catch(error => {
            console.log('[Background] Tab message error:', error);
          });
        }
      });
    } catch (e) {
      console.log('[Background] Error sending message:', e);
    }
    
    sendResponse({status: 'success'});
  });
}

browserAPI.runtime.onConnect.addListener(function(port) {
  if (port.name === 'popup') {
    console.log('Popup connected');
    
    // We can communicate with the popup if needed
    port.onMessage.addListener(function(msg) {
      console.log('Message from popup:', msg);
    });
  }
});