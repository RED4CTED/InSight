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
let activeRequests = {}; // Track active requests

// Storage helper functions for background processing
function saveRequest(requestId, requestData) {
  console.log(`[Background] Saving request ${requestId}`);
  return browserAPI.storage.local.set({
    [`request_${requestId}`]: {
      ...requestData,
      timestamp: Date.now(),
      status: 'pending'
    }
  });
}

function updateRequest(requestId, updateData) {
  console.log(`[Background] Updating request ${requestId}`, updateData);
  return browserAPI.storage.local.get([`request_${requestId}`])
    .then(result => {
      const currentData = result[`request_${requestId}`] || {};
      return browserAPI.storage.local.set({
        [`request_${requestId}`]: {
          ...currentData,
          ...updateData
        }
      });
    });
}

function removeRequest(requestId) {
  console.log(`[Background] Removing request ${requestId}`);
  return browserAPI.storage.local.remove([`request_${requestId}`]);
}

// OCR Methods

function extractTextWithOCRSpace(imageData, apiKey) {
  console.log('[Background] Using OCR.space API');
  // The OCR.space API endpoint
  const apiUrl = 'https://api.ocr.space/parse/image';
  
  // Need to convert data URL to Blob for FormData
  const byteString = atob(imageData.split(',')[1]);
  const mimeType = imageData.split(',')[0].split(':')[1].split(';')[0];
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  
  const blob = new Blob([arrayBuffer], {type: mimeType});
  
  // Create FormData for the API request
  const formData = new FormData();
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('file', blob, 'screenshot.png');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy
  
  // Make the API request
  return fetch(apiUrl, {
    method: 'POST',
    headers: {
      'apikey': apiKey
    },
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('OCR.space server returned status ' + response.status);
    }
    return response.json();
  })
  .then(data => {
    console.log('[Background] OCR.space response received');
    
    if (data.IsErroredOnProcessing) {
      throw new Error('OCR processing error: ' + data.ErrorMessage);
    }
    
    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      return "No text detected";
    }
    
    // Combine all parsed results
    let combinedText = '';
    for (const result of data.ParsedResults) {
      if (result.ParsedText) {
        combinedText += result.ParsedText.trim() + '\n';
      }
    }
    
    return combinedText || "No text detected";
  });
}

function extractTextWithCustomApi(imageData, settings) {
  console.log('[Background] Using custom OCR API at:', settings.url);
  
  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    ...settings.headers
  };
  
  // Prepare request body based on image format
  let requestBody;
  
  if (settings.imageFormat === 'base64') {
    // Use base64 string directly
    const base64Data = imageData.split(',')[1];
    
    // Create a dynamic object with the parameter name from settings
    const bodyObj = {};
    bodyObj[settings.paramName] = base64Data;
    
    requestBody = JSON.stringify(bodyObj);
  } else {
    // Use FormData
    const byteString = atob(imageData.split(',')[1]);
    const mimeType = imageData.split(',')[0].split(':')[1].split(';')[0];
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([arrayBuffer], {type: mimeType});
    
    // Create FormData
    const formData = new FormData();
    formData.append(settings.paramName, blob, 'screenshot.png');
    
    // Don't set Content-Type header for FormData, browser will set it with boundary
    delete headers['Content-Type'];
    
    requestBody = formData;
  }
  
  // Make the API request
  return fetch(settings.url, {
    method: 'POST',
    headers: headers,
    body: requestBody
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Custom OCR API returned status ' + response.status);
    }
    return response.json();
  })
  .then(data => {
    console.log('[Background] Custom OCR API response received');
    
    // Extract text using the response path
    const pathParts = settings.responsePath.split('.');
    let result = data;
    
    for (const part of pathParts) {
      if (result === null || result === undefined) {
        break;
      }
      
      // Handle array indexing (e.g., results[0])
      const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
      if (arrayMatch) {
        const arrayName = arrayMatch[1];
        const arrayIndex = parseInt(arrayMatch[2]);
        
        if (result[arrayName] && Array.isArray(result[arrayName]) && result[arrayName].length > arrayIndex) {
          result = result[arrayName][arrayIndex];
        } else {
          result = null;
          break;
        }
      } else {
        result = result[part];
      }
    }
    
    if (result === null || result === undefined) {
      throw new Error('Could not find text at the specified response path');
    }
    
    // Convert to string
    const text = result.toString();
    return text.trim() || "No text detected";
  });
}

// AI Service Methods
function sendToOpenAIWithImage(text, imageData, apiKey, model) {
  console.log('[Background] Using OpenAI API with model:', model);
  // The OpenAI API endpoint for chat completions
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  
  // Prepare the messages array
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' }
  ];
  
  // If we have an image, add it to the messages
  if (imageData) {
    // For models that support images (like gpt-4-vision and gpt-4o)
    if (model.includes('gpt-4') || model.includes('gpt-4o')) {
      // Extract the base64 data
      const base64Data = imageData.split(',')[1];
      
      // Add the message with image content
      messages.push({
        role: 'user',
        content: [
          // Add text if provided
          ...(text ? [{ type: 'text', text: text }] : []),
          // Add image
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Data}`
            }
          }
        ]
      });
    } else {
      // For non-vision models, just describe that there was an image
      const promptWithImageNote = text + 
        (text ? '\n\n' : '') + 
        '[Note: An image was included but this model does not support image input]';
      
      messages.push({ role: 'user', content: promptWithImageNote });
    }
  } else {
    // Just text, no image
    messages.push({ role: 'user', content: text });
  }
  
  return fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 1000
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('OpenAI server returned status ' + response.status);
    }
    return response.json();
  })
  .then(data => {
    console.log('[Background] OpenAI response received');
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response generated');
    }
    
    return data.choices[0].message.content;
  });
}

function sendToCustomAiWithImage(text, imageData, settings) {
  console.log('[Background] Using custom AI API at:', settings.url);
  
  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    ...settings.headers
  };
  
  // Check for image support in custom API
  const imageSupport = settings.imageSupport || 'none';
  
  // Replace {{text}} in body template with actual text
  let processedBodyTemplate = settings.bodyTemplate.replace('{{text}}', text || '');
  
  // Replace {{image}} with base64 image data if applicable
  if (imageData && imageSupport === 'base64') {
    const base64Data = imageData.split(',')[1];
    processedBodyTemplate = processedBodyTemplate.replace('{{image}}', base64Data);
  } else if (imageData && imageSupport === 'url') {
    // URL support would require hosting the image somewhere
    // For now, we'll just replace with a placeholder
    processedBodyTemplate = processedBodyTemplate.replace('{{image}}', 'IMAGE_URL_NOT_SUPPORTED');
  }
  
  // Parse the body template
  let requestBody;
  try {
    // Try to parse as JSON
    const bodyObject = JSON.parse(processedBodyTemplate);
    requestBody = JSON.stringify(bodyObject);
  } catch (e) {
    // If not valid JSON, use as is
    requestBody = processedBodyTemplate;
  }
  
  // Make the API request
  return fetch(settings.url, {
    method: 'POST',
    headers: headers,
    body: requestBody
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Custom AI API returned status ' + response.status);
    }
    return response.json();
  })
  .then(data => {
    console.log('[Background] Custom AI API response received');
    
    // Extract response using the response path
    const pathParts = settings.responsePath.split('.');
    let result = data;
    
    for (const part of pathParts) {
      if (result === null || result === undefined) {
        break;
      }
      
      // Handle array indexing (e.g., choices[0])
      const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
      if (arrayMatch) {
        const arrayName = arrayMatch[1];
        const arrayIndex = parseInt(arrayMatch[2]);
        
        if (result[arrayName] && Array.isArray(result[arrayName]) && result[arrayName].length > arrayIndex) {
          result = result[arrayName][arrayIndex];
        } else {
          result = null;
          break;
        }
      } else {
        result = result[part];
      }
    }
    
    if (result === null || result === undefined) {
      throw new Error('Could not find response at the specified path');
    }
    
    // Return response
    return result.toString();
  });
}

// Request Handling Functions
function handleOCRRequest(request, sender, sendResponse) {
  const requestId = 'ocr_' + Date.now();
  console.log(`[Background] Handling OCR request ${requestId}`);
  
  // Store request details
  saveRequest(requestId, {
    type: 'ocr',
    service: request.service,
    imageData: request.imageData,
    params: {
      apiKey: request.apiKey,
      serverUrl: request.serverUrl,
      settings: request.settings
    }
  }).then(() => {
    // Start processing
    processOCRRequest(requestId);
    
    // Send immediate response
    sendResponse({status: 'processing', requestId: requestId});
  }).catch(error => {
    console.error('[Background] Error saving OCR request:', error);
    sendResponse({status: 'error', error: error.message});
  });
  
  return true; // Keep message channel open
}

function processOCRRequest(requestId) {
  console.log(`[Background] Processing OCR request ${requestId}`);
  
  // Mark as processing
  updateRequest(requestId, {status: 'processing'})
    .then(() => {
      // Get request data
      return browserAPI.storage.local.get([`request_${requestId}`]);
    })
    .then(result => {
      const requestData = result[`request_${requestId}`];
      if (!requestData) {
        console.error(`[Background] Request ${requestId} not found`);
        return;
      }
      
      if (requestData.status === 'completed' || requestData.status === 'error') {
        console.log(`[Background] Request ${requestId} already finished with status ${requestData.status}`);
        return;
      }
      
      // Track this request as active
      activeRequests[requestId] = true;
      
      const service = requestData.service;
      const imageData = requestData.imageData;
      const params = requestData.params || {};
      
      console.log(`[Background] Processing OCR with service ${service}`);
      
      let processPromise;
      
      if (service === 'ocrspace') {
        processPromise = extractTextWithOCRSpace(imageData, params.apiKey);
      } else if (service === 'custom') {
        processPromise = extractTextWithCustomApi(imageData, params.settings);
      } else {
        return updateRequest(requestId, {
          status: 'error',
          error: 'Unknown OCR service: ' + service
        }).then(() => {
          delete activeRequests[requestId];
          notifyError(requestId, 'Unknown OCR service: ' + service);
        });
      }
      
      // Process the OCR request
      return processPromise
        .then(text => {
          console.log(`[Background] OCR request ${requestId} completed successfully`);
          
          // Store result
          return browserAPI.storage.local.set({
            extractedText: text,
            previewImage: imageData,
            [`request_${requestId}`]: {
              ...requestData,
              status: 'completed',
              result: text,
              completedAt: Date.now()
            }
          }).then(() => {
            delete activeRequests[requestId];
            notifyOCRComplete(requestId, text);
            return text;
          });
        })
        .catch(error => {
          console.error(`[Background] OCR request ${requestId} failed:`, error);
          
          // Store error
          return updateRequest(requestId, {
            status: 'error',
            error: error.message || 'Unknown error',
            completedAt: Date.now()
          }).then(() => {
            delete activeRequests[requestId];
            notifyError(requestId, error.message || 'Unknown error');
          });
        });
    })
    .catch(error => {
      console.error(`[Background] Error processing OCR request ${requestId}:`, error);
      delete activeRequests[requestId];
    });
}

function handleAIRequest(request, sender, sendResponse) {
  const requestId = 'ai_' + Date.now();
  console.log(`[Background] Handling AI request ${requestId}`);
  
  // Store request details
  saveRequest(requestId, {
    type: 'ai',
    service: request.service,
    text: request.text,
    imageData: request.imageData,
    params: {
      apiKey: request.apiKey,
      serverUrl: request.serverUrl,
      model: request.model,
      settings: request.settings
    }
  }).then(() => {
    // Start processing
    processAIRequest(requestId);
    
    // Send immediate response
    sendResponse({status: 'processing', requestId: requestId});
  }).catch(error => {
    console.error('[Background] Error saving AI request:', error);
    sendResponse({status: 'error', error: error.message});
  });
  
  return true; // Keep message channel open
}

function processAIRequest(requestId) {
  console.log(`[Background] Processing AI request ${requestId}`);
  
  // Mark as processing
  updateRequest(requestId, {status: 'processing'})
    .then(() => {
      // Get request data
      return browserAPI.storage.local.get([`request_${requestId}`]);
    })
    .then(result => {
      const requestData = result[`request_${requestId}`];
      if (!requestData) {
        console.error(`[Background] Request ${requestId} not found`);
        return;
      }
      
      if (requestData.status === 'completed' || requestData.status === 'error') {
        console.log(`[Background] Request ${requestId} already finished with status ${requestData.status}`);
        return;
      }
      
      // Track this request as active
      activeRequests[requestId] = true;
      
      const service = requestData.service;
      const text = requestData.text;
      const imageData = requestData.imageData;
      const params = requestData.params || {};
      
      console.log(`[Background] Processing AI with service ${service}`);
      
      let processPromise;
      
      if (service === 'openai') {
        processPromise = sendToOpenAIWithImage(text, imageData, params.apiKey, params.model);
      } else if (service === 'custom') {
        processPromise = sendToCustomAiWithImage(text, imageData, params.settings);
      } else {
        return updateRequest(requestId, {
          status: 'error',
          error: 'Unknown AI service: ' + service
        }).then(() => {
          delete activeRequests[requestId];
          notifyError(requestId, 'Unknown AI service: ' + service);
        });
      }
      
      // Process the AI request
      return processPromise
        .then(response => {
          console.log(`[Background] AI request ${requestId} completed successfully`);
          
          // Store result
          return browserAPI.storage.local.set({
            aiResponse: response,
            [`request_${requestId}`]: {
              ...requestData,
              status: 'completed',
              result: response,
              completedAt: Date.now()
            }
          }).then(() => {
            delete activeRequests[requestId];
            notifyAIComplete(requestId, response);
            return response;
          });
        })
        .catch(error => {
          console.error(`[Background] AI request ${requestId} failed:`, error);
          
          // Store error
          return updateRequest(requestId, {
            status: 'error',
            error: error.message || 'Unknown error',
            completedAt: Date.now()
          }).then(() => {
            delete activeRequests[requestId];
            notifyError(requestId, error.message || 'Unknown error');
          });
        });
    })
    .catch(error => {
      console.error(`[Background] Error processing AI request ${requestId}:`, error);
      delete activeRequests[requestId];
    });
}

// Notification functions
function notifyOCRComplete(requestId, result) {
  console.log(`[Background] Notifying OCR complete for ${requestId}`);
  
  // Ensure result is a string
  const textResult = result !== null && result !== undefined ? String(result) : "";
  
  browserAPI.runtime.sendMessage({
    action: 'ocrComplete',
    requestId: requestId,
    result: textResult
  }).catch(error => {
    // Expected to fail if popup is closed
    console.log(`[Background] Could not notify popup about OCR completion: ${error.message}`);
  });
}


function notifyAIComplete(requestId, result) {
  console.log(`[Background] Notifying AI complete for ${requestId}`);
  browserAPI.runtime.sendMessage({
    action: 'aiComplete',
    requestId: requestId,
    result: result
  }).catch(error => {
    // Expected to fail if popup is closed
    console.log(`[Background] Could not notify popup about AI completion: ${error.message}`);
  });
}

function notifyError(requestId, error) {
  console.log(`[Background] Notifying error for ${requestId}: ${error}`);
  browserAPI.runtime.sendMessage({
    action: 'requestError',
    requestId: requestId,
    error: error
  }).catch(error => {
    // Expected to fail if popup is closed
    console.log(`[Background] Could not notify popup about error: ${error.message}`);
  });
}

// Recovery mechanism
function recoverPendingRequests() {
  console.log('[Background] Checking for pending requests after restart');
  
  browserAPI.storage.local.get(null).then(allData => {
    const requestKeys = Object.keys(allData).filter(key => 
      key.startsWith('request_')
    );
    
    console.log(`[Background] Found ${requestKeys.length} stored requests`);
    
    const currentTime = Date.now();
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    
    requestKeys.forEach(key => {
      const requestData = allData[key];
      const requestId = key.replace('request_', '');
      
      // Skip completed, error, or very old requests
      if (requestData.status === 'completed' || 
          requestData.status === 'error' ||
          (currentTime - requestData.timestamp > TIMEOUT_MS)) {
        console.log(`[Background] Skipping request ${requestId} with status ${requestData.status}`);
        return;
      }
      
      console.log(`[Background] Recovering request ${requestId} of type ${requestData.type}`);
      
      // Resume processing based on request type
      if (requestData.type === 'ocr') {
        processOCRRequest(requestId);
      } else if (requestData.type === 'ai') {
        processAIRequest(requestId);
      }
    });
  }).catch(error => {
    console.error('[Background] Error recovering requests:', error);
  });
}

// Listen for toolbar icon clicks
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
    const mode = result.interfaceMode || 'popup'; // Default to popup
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
  
  // Handle OCR processing request
  if (request.action === 'processOCR') {
    return handleOCRRequest(request, sender, sendResponse);
  }
  
  if (request.action === 'processPDF') {
    return handlePDFRequest(request, sender, sendResponse);
  }

  // Handle AI processing request
  if (request.action === 'processAI') {
    return handleAIRequest(request, sender, sendResponse);
  }
  
  // Handle tab capture request
  if (request.action === 'captureTab') {
    console.log('[Background] Processing capture tab request');
    console.log('[Background] Capture intent:', request.isForAi ? 'AI' : 'OCR');
    
    // Store the intent first
    storeScreenshotIntent(request.isForAi === true).then(() => {
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
    });
    
    return true; // Keep the messaging channel open for async response
  }
  
  // Check for pending results
  if (request.action === 'checkPendingResults') {
    console.log('[Background] Checking for pending results');
    
    browserAPI.storage.local.get(null).then(allData => {
      const requestKeys = Object.keys(allData).filter(key => 
        key.startsWith('request_')
      );
      
      // Find completed results
      const completedOCR = requestKeys
        .find(key => allData[key].type === 'ocr' && 
                    allData[key].status === 'completed');
      
      const completedPDF = requestKeys
      .find(key => allData[key].type === 'pdf' && 
                    allData[key].status === 'completed');
                  
      const completedAI = requestKeys
        .find(key => allData[key].type === 'ai' && 
                    allData[key].status === 'completed');
                    
      const errorRequest = requestKeys
        .find(key => allData[key].status === 'error');
      
      if (errorRequest) {
        const errorData = allData[errorRequest];
        sendResponse({
          status: 'error', 
          error: errorData.error,
          requestId: errorRequest.replace('request_', '')
        });
      } else if (completedOCR) {
        const ocrData = allData[completedOCR];
        // Ensure the result is a string before sending
        const textResult = ocrData.result !== null && ocrData.result !== undefined ? 
                           String(ocrData.result) : ""; 
        
        sendResponse({
          status: 'ocrComplete', 
          result: textResult,
          requestId: completedOCR.replace('request_', '')
        });
      } else if (completedAI) {
        const aiData = allData[completedAI];
        // Ensure the result is a string before sending
        const textResult = aiData.result !== null && aiData.result !== undefined ? 
                           String(aiData.result) : "";
        sendResponse({
          status: 'aiComplete', 
          result: textResult,
          requestId: completedAI.replace('request_', '')
        });
        
      } else if (completedPDF) {
        const pdfData = allData[completedPDF];
        sendResponse({
          status: 'pdfComplete', 
          result: pdfData.result,
          pdfData: allData.processedPdf || null,
          requestId: completedPDF.replace('request_', '')
        });
      } else {
        // Check for in-progress requests
        const pendingOCR = requestKeys
          .find(key => allData[key].type === 'ocr' && 
                      allData[key].status === 'processing');
                      
        const pendingAI = requestKeys
          .find(key => allData[key].type === 'ai' && 
                      allData[key].status === 'processing');
        
        if (pendingOCR) {
          sendResponse({
            status: 'processing',
            type: 'ocr',
            requestId: pendingOCR.replace('request_', '')
          });
        } else if (pendingAI) {
          sendResponse({
            status: 'processing',
            type: 'ai',
            requestId: pendingAI.replace('request_', '')
          });
        } else {
          sendResponse({status: 'noPendingResults'});
        }
      }
    }).catch(error => {
      console.error('[Background] Error checking pending results:', error);
      sendResponse({status: 'error', error: error.message});
    });
    
    return true; // Keep the messaging channel open
  }
  
  // Handle result acknowledgement and cleanup
  if (request.action === 'acknowledgeResult') {
    const requestId = request.requestId;
    if (requestId) {
      removeRequest(requestId)
        .then(() => {
          sendResponse({status: 'removed'});
        })
        .catch(error => {
          console.error('[Background] Error removing request:', error);
          sendResponse({status: 'error', error: error.message});
        });
    } else {
      sendResponse({status: 'error', error: 'No requestId provided'});
    }
    return true;
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

function handlePDFRequest(request, sender, sendResponse) {
  const requestId = 'pdf_' + Date.now();
  console.log(`[Background] Handling PDF request ${requestId}`);
  
  // Get PDF data and settings from the request
  const pdfData = request.pdfData; // This is now base64 data
  const settings = request.settings;
  const fileName = request.fileName || 'document.pdf';
  
  if (!pdfData || !settings) {
    console.error('[Background] Missing PDF data or settings');
    sendResponse({status: 'error', error: 'Missing PDF data or settings'});
    return true;
  }
  
  // Store request details
  saveRequest(requestId, {
    type: 'pdf',
    service: 'custom',
    fileName: fileName,
    fileType: request.fileType || 'application/pdf',
    fileSize: request.fileSize || 0,
    params: {
      settings: settings
    }
  }).then(() => {
    // Start processing
    processPDFRequest(requestId, pdfData, fileName, settings);
    
    // Send immediate response
    sendResponse({status: 'processing', requestId: requestId});
  }).catch(error => {
    console.error('[Background] Error saving PDF request:', error);
    sendResponse({status: 'error', error: error.message});
  });
  
  return true; // Keep message channel open
}

// Add function to process PDF requests
function processPDFRequest(requestId, pdfData, fileName, settings) {
  console.log(`[Background] Processing PDF request ${requestId}`);
  
  // Mark as processing
  updateRequest(requestId, {status: 'processing'})
    .then(() => {
      // Track this request as active
      activeRequests[requestId] = true;
      
      // Process the PDF
      return sendPDFToCustomApi(pdfData, fileName, settings)
        .then(result => {
          console.log(`[Background] PDF request ${requestId} completed successfully`);
          
          // Ensure we have a proper response
          let responseText = "";
          let responsePdf = null;
          
          if (typeof result === 'object') {
            responseText = result.text || "PDF processed successfully.";
            responsePdf = result.pdfData || null;
          } else if (typeof result === 'string') {
            responseText = result || "PDF processed successfully.";
          } else {
            responseText = "PDF processed successfully.";
          }
          
          // Store result with a new persistent flag
          return browserAPI.storage.local.set({
            extractedText: responseText,
            processedPdf: responsePdf,
            // Add a new flag to indicate PDF processing is complete
            pdfProcessingComplete: true,
            pdfProcessingTimestamp: Date.now(),
            [`request_${requestId}`]: {
              type: 'pdf',
              service: 'custom',
              status: 'completed',
              result: { 
                text: responseText,
                hasPdf: !!responsePdf
              },
              completedAt: Date.now()
            }
          }).then(() => {
            delete activeRequests[requestId];
            
            // Determine if we have PDF data or just text
            if (responsePdf) {
              notifyPdfComplete(requestId, responsePdf);
            } else {
              notifyOCRComplete(requestId, responseText);
            }
            
            return result;
          });
        })
        .catch(error => {
          console.error(`[Background] PDF request ${requestId} failed:`, error);
          
          // Store error
          return updateRequest(requestId, {
            status: 'error',
            error: error.message || 'Unknown error',
            completedAt: Date.now()
          }).then(() => {
            delete activeRequests[requestId];
            notifyError(requestId, error.message || 'Unknown error');
          });
        });
    })
    .catch(error => {
      console.error(`[Background] Error processing PDF request ${requestId}:`, error);
      delete activeRequests[requestId];
    });
}

// Function to send PDF to custom API
function sendPDFToCustomApi(pdfData, fileName, settings) {
  console.log('[Background] Sending PDF to custom API at:', settings.url);
  
  // Convert base64 data to Blob if it's in base64 format
  let pdfBlob;
  
  // If it's a data URL, extract the base64 part
  if (pdfData.startsWith('data:')) {
    const base64String = pdfData.split(',')[1];
    const mimeType = pdfData.split(',')[0].split(':')[1].split(';')[0];
    
    // Convert base64 to Blob
    const byteCharacters = atob(base64String);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    pdfBlob = new Blob(byteArrays, {type: mimeType || 'application/pdf'});
  } else if (typeof pdfData === 'string') {
    // Assume it's already base64 without data URL prefix
    const byteCharacters = atob(pdfData);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    pdfBlob = new Blob(byteArrays, {type: 'application/pdf'});
  } else {
    // Not a valid format
    return Promise.reject(new Error('Invalid PDF data format'));
  }
  
  // For PDFs, we'll always use FormData
  const formData = new FormData();
  formData.append(settings.paramName || 'file', pdfBlob, fileName);
  
  // Prepare headers (but don't set Content-Type, let browser handle it for FormData)
  const headers = { ...settings.headers };
  delete headers['Content-Type'];
  
  // Make the API request
  return fetch(settings.url, {
    method: 'POST',
    headers: headers,
    body: formData
  })
  .then(response => {
    console.log('[Background] Custom API response status:', response.status);
    
    if (!response.ok) {
      throw new Error('Custom API returned status ' + response.status);
    }
    
    // Check content type to determine if we got a PDF or JSON
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/pdf')) {
      // We received a PDF file, return it as base64
      return response.arrayBuffer().then(buffer => {
        // Convert to base64
        const base64 = arrayBufferToBase64(buffer);
        return {
          text: "PDF processed successfully. You can download the searchable PDF.",
          pdfData: base64
        };
      });
    } else {
      // Assume JSON response with text
      return response.json().then(data => {
        console.log('[Background] Received JSON response:', data);
        
        // Extract text using the response path
        const pathParts = settings.responsePath.split('.');
        let result = data;
        
        for (const part of pathParts) {
          if (result === null || result === undefined) {
            break;
          }
          
          // Handle array indexing (e.g., results[0])
          const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
          if (arrayMatch) {
            const arrayName = arrayMatch[1];
            const arrayIndex = parseInt(arrayMatch[2]);
            
            if (result[arrayName] && Array.isArray(result[arrayName]) && result[arrayName].length > arrayIndex) {
              result = result[arrayName][arrayIndex];
            } else {
              result = null;
              break;
            }
          } else {
            result = result[part];
          }
        }
        
        // Ensure result is a string before applying trim()
        let textResult = "No text detected in PDF.";
        
        if (result !== null && result !== undefined) {
          // Convert to string safely
          textResult = String(result);
          // Now it's safe to trim
          textResult = textResult.trim() || "No text detected in PDF.";
        }
        
        return {
          text: textResult,
          pdfData: null
        };
      }).catch(error => {
        console.error('[Background] Error parsing JSON response:', error);
        
        // Try to treat it as plain text
        return response.text().then(text => {
          // Ensure text is a string
          const textResult = typeof text === 'string' ? text.trim() : "PDF processed but no text was returned.";
          return {
            text: textResult,
            pdfData: null
          };
        });
      });
    }
  });
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary);
}

// Add notification function for PDF completion
function notifyPdfComplete(requestId, pdfData) {
  console.log(`[Background] Notifying PDF complete for ${requestId}`);
  browserAPI.runtime.sendMessage({
    action: 'pdfComplete',
    requestId: requestId,
    pdfData: pdfData
  }).catch(error => {
    // Expected to fail if popup is closed
    console.log(`[Background] Could not notify popup about PDF completion: ${error.message}`);
  });
}

// Common capture processing function
function processCapture(dataUrl, request, sendResponse) {
  console.log('[Background] Tab captured successfully');
  
  // Include the capturingForAi flag from the request
  const capturingForAi = request.capturingForAi || false;
  
  // Store the screenshot and area for the popup to process
  browserAPI.storage.local.set({
    pendingScreenshot: {
      dataUrl: dataUrl,
      area: request.data
    },
    capturingForAi: capturingForAi // Store the flag explicitly
  }, function() {
    // Try to notify popup that a screenshot is ready for processing
    try {
      // First try to notify a regular popup if it's open
      browserAPI.runtime.sendMessage({
        action: 'processScreenshot',
        data: {
          dataUrl: dataUrl,
          area: request.data
        },
        capturingForAi: capturingForAi // Include flag in the message
      }, function(response) {
        if (browserAPI.runtime.lastError) {
          console.log('[Background] Message sending error:', browserAPI.runtime.lastError.message);
        }
      });
      
      // Also try to notify the panel in the active tab
      browserAPI.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
          browserAPI.tabs.sendMessage(tabs[0].id, {
            action: 'processScreenshot',
            data: {
              dataUrl: dataUrl,
              area: request.data
            },
            capturingForAi: capturingForAi // Include flag in the message
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

// Handle service worker activation and restoration
browserAPI.runtime.onStartup.addListener(recoverPendingRequests);
browserAPI.runtime.onInstalled.addListener(recoverPendingRequests);

// Periodic cleanup (without using alarms API since it might not be available)
function setupCleanupInterval() {
  // Only set up interval if we're in a long-lived context (service worker may terminate)
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // Every hour
  
  const cleanupRequests = function() {
    console.log('[Background] Running cleanup for old requests');
    
    const TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
    const currentTime = Date.now();
    
    browserAPI.storage.local.get(null).then(allData => {
      const requestKeys = Object.keys(allData).filter(key => 
        key.startsWith('request_')
      );
      
      const keysToRemove = [];
      
      requestKeys.forEach(key => {
        const requestData = allData[key];
        // Remove if completed/error and older than 24 hours
        if ((requestData.status === 'completed' || requestData.status === 'error') && 
            (currentTime - (requestData.completedAt || requestData.timestamp) > TIMEOUT_MS)) {
          keysToRemove.push(key);
        }
        // Also remove very old pending requests (48 hours)
        else if (currentTime - requestData.timestamp > 2 * TIMEOUT_MS) {
          keysToRemove.push(key);
        }
      });
      
      if (keysToRemove.length > 0) {
        console.log(`[Background] Cleaning up ${keysToRemove.length} old requests`);
        return browserAPI.storage.local.remove(keysToRemove);
      }
    }).catch(error => {
      console.error('[Background] Error during cleanup:', error);
    });
  };

  // Set up interval
  setInterval(cleanupRequests, CLEANUP_INTERVAL);
}

// Try to set up cleanup with alarms API if available, fall back to interval
try {
  if (browserAPI.alarms) {
    browserAPI.alarms.create('cleanupRequests', { periodInMinutes: 60 }); // Every hour
    
    browserAPI.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'cleanupRequests') {
        console.log('[Background] Running cleanup for old requests (alarm)');
        // Same cleanup logic as in setupCleanupInterval
        const TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
        const currentTime = Date.now();
        
        browserAPI.storage.local.get(null).then(allData => {
          const requestKeys = Object.keys(allData).filter(key => 
            key.startsWith('request_')
          );
          
          const keysToRemove = [];
          
          requestKeys.forEach(key => {
            const requestData = allData[key];
            // Remove if completed/error and older than 24 hours
            if ((requestData.status === 'completed' || requestData.status === 'error') && 
                (currentTime - (requestData.completedAt || requestData.timestamp) > TIMEOUT_MS)) {
              keysToRemove.push(key);
            }
            // Also remove very old pending requests (48 hours)
            else if (currentTime - requestData.timestamp > 2 * TIMEOUT_MS) {
              keysToRemove.push(key);
            }
          });
          
          if (keysToRemove.length > 0) {
            console.log(`[Background] Cleaning up ${keysToRemove.length} old requests`);
            return browserAPI.storage.local.remove(keysToRemove);
          }
        }).catch(error => {
          console.error('[Background] Error during cleanup:', error);
        });
      }
    });
  } else {
    console.log('[Background] Alarms API not available, using interval for cleanup');
    setupCleanupInterval();
  }
} catch (e) {
  console.log('[Background] Error setting up alarms, using interval for cleanup:', e);
  setupCleanupInterval();
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

function storeScreenshotIntent(isForAi) {
  return browserAPI.storage.local.set({
    screenshotIntent: {
      isForAi: isForAi,
      timestamp: Date.now()
    }
  }).then(() => {
    console.log(`[Background] Screenshot intent stored: ${isForAi ? 'AI' : 'OCR'}`);
  });
}

console.log('Background script loaded');