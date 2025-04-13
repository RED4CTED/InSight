// Moved the initialization function to the global scope
function initializePopup() {
  // Determine which browser API to use
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const isFirefox = typeof browser !== 'undefined';
  
  console.log('Running in:', isFirefox ? 'Firefox' : 'Chrome');

  // Capture elements
  const captureBtn = document.getElementById('captureBtn');
  const copyBtn = document.getElementById('copyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const resultTextarea = document.getElementById('result');
  const statusDiv = document.getElementById('status');
  const loadingDiv = document.getElementById('loading');
  const previewContainer = document.getElementById('preview-container');
  
  // Tab elements
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  // OCR service elements
  const ocrServiceRadios = document.querySelectorAll('input[name="ocrService"]');
  const apiKeyContainer = document.getElementById('apiKeyContainer');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  const localServerContainer = document.getElementById('localServerContainer');
  const customOcrContainer = document.getElementById('customOcrContainer');
  
  // Local server elements
  const serverUrlInput = document.getElementById('serverUrlInput');
  const saveServerUrlBtn = document.getElementById('saveServerUrlBtn');
  
  // Custom OCR API elements
  const customOcrUrlInput = document.getElementById('customOcrUrlInput');
  const customOcrHeaderKeyInput = document.getElementById('customOcrHeaderKeyInput');
  const customOcrHeaderValueInput = document.getElementById('customOcrHeaderValueInput');
  const addOcrHeaderBtn = document.getElementById('addOcrHeaderBtn');
  const customOcrHeadersList = document.getElementById('customOcrHeadersList');
  const customOcrImageFormatRadios = document.querySelectorAll('input[name="customOcrImageFormat"]');
  const customOcrParamNameInput = document.getElementById('customOcrParamNameInput');
  const customOcrResponsePathInput = document.getElementById('customOcrResponsePathInput');
  const saveCustomOcrBtn = document.getElementById('saveCustomOcrBtn');
  const testCustomOcrBtn = document.getElementById('testCustomOcrBtn');
  
  // AI service elements
  const aiServiceRadios = document.querySelectorAll('input[name="aiService"]');
  const openaiContainer = document.getElementById('openaiContainer');
  const localAiServerContainer = document.getElementById('localAiServerContainer');
  const customAiContainer = document.getElementById('customAiContainer');
  
  // OpenAI API elements
  const openaiApiKeyInput = document.getElementById('openaiApiKeyInput');
  const openaiModelSelect = document.getElementById('openaiModelSelect');
  const saveOpenaiApiKeyBtn = document.getElementById('saveOpenaiApiKeyBtn');
  
  // Local AI server elements
  const aiServerUrlInput = document.getElementById('aiServerUrlInput');
  const localAiModelInput = document.getElementById('localAiModelInput');
  const saveAiServerUrlBtn = document.getElementById('saveAiServerUrlBtn');
  
  // Custom AI API elements
  const customAiUrlInput = document.getElementById('customAiUrlInput');
  const customAiHeaderKeyInput = document.getElementById('customAiHeaderKeyInput');
  const customAiHeaderValueInput = document.getElementById('customAiHeaderValueInput');
  const addAiHeaderBtn = document.getElementById('addAiHeaderBtn');
  const customAiHeadersList = document.getElementById('customAiHeadersList');
  const customAiBodyTemplateInput = document.getElementById('customAiBodyTemplateInput');
  const customAiResponsePathInput = document.getElementById('customAiResponsePathInput');
  const saveCustomAiBtn = document.getElementById('saveCustomAiBtn');
  const testCustomAiBtn = document.getElementById('testCustomAiBtn');
  
  // Send to AI button (renamed from sendToOpenaiBtn)
  const sendToAiBtn = document.getElementById('sendToAiBtn');
  const aiResponseContainer = document.getElementById('ai-response-container');
  const aiResponseDiv = document.getElementById('ai-response');

  // New elements for OCR tab
  const uploadImageBtn = document.getElementById('uploadImageBtn');
  const imageFileInput = document.getElementById('imageFileInput');
  const sendToAiTabBtn = document.getElementById('sendToAiTabBtn');

  // New elements for AI tab
  const aiPrompt = document.getElementById('aiPrompt');
  const appendExtractedTextBtn = document.getElementById('appendExtractedTextBtn');
  const uploadAiImageBtn = document.getElementById('uploadAiImageBtn');
  const aiImageFileInput = document.getElementById('aiImageFileInput');
  const captureAiScreenshotBtn = document.getElementById('captureAiScreenshotBtn');
  const useOcrImageBtn = document.getElementById('useOcrImageBtn');
  const aiPreviewContainer = document.getElementById('ai-preview-container');
  const removeAiImageBtn = document.getElementById('removeAiImageBtn');
  const aiLoading = document.getElementById('ai-loading');
  const copyAiResponseBtn = document.getElementById('copyAiResponseBtn');
  const clearAiBtn = document.getElementById('clearAiBtn');
  
  console.log('Popup loaded');
  
  // Helper function to show/hide elements
  function showElement(element, visible) {
    if (element) {
      if (visible) {
        element.classList.remove('hidden');
      } else {
        element.classList.add('hidden');
      }
    }
  }
  
  // Helper function to update status with appropriate styling
  function updateStatus(message, type = '') {
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = 'status';
      if (type) {
        statusDiv.classList.add(type);
      }
      
      // Auto-clear success messages after 3 seconds
      if (type === 'success') {
        setTimeout(() => {
          if (statusDiv && statusDiv.textContent === message) {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
          }
        }, 3000);
      }
    }
  }

  // Unified storage get function that works in both browsers
  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      if (isFirefox) {
        // Firefox uses native promises
        browserAPI.storage.local.get(keys).then(resolve).catch(reject);
      } else {
        // Chrome uses callbacks
        browserAPI.storage.local.get(keys, (result) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      }
    });
  }

  // Unified storage set function that works in both browsers
  function storageSet(data) {
    return new Promise((resolve, reject) => {
      if (isFirefox) {
        // Firefox uses native promises
        browserAPI.storage.local.set(data).then(resolve).catch(reject);
      } else {
        // Chrome uses callbacks
        browserAPI.storage.local.set(data, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      }
    });
  }

  // Unified storage remove function that works in both browsers
  function storageRemove(keys) {
    return new Promise((resolve, reject) => {
      if (isFirefox) {
        // Firefox uses native promises
        browserAPI.storage.local.remove(keys).then(resolve).catch(reject);
      } else {
        // Chrome uses callbacks
        browserAPI.storage.local.remove(keys, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      }
    });
  }

  let currentOcrImage = null; // Stores the current OCR image
  let currentAiImage = null; // Stores the image to be sent to AI

  // Tab switching functionality
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Get the tab to show
      const tabId = this.getAttribute('data-tab');
      
      // Update active state on buttons
      tabButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      // Hide all panes and show the selected one
      tabPanes.forEach(pane => pane.classList.remove('active'));
      document.getElementById(`${tabId}-tab`).classList.add('active');

      // Special handling when switching to AI tab
      if (tabId === 'ai') {
        if (sendToAiBtn) {
          sendToAiBtn.disabled = false;
        }
        // Check if we have extracted text to enable/disable the append button
        storageGet(['extractedText']).then(function(result) {
          if (appendExtractedTextBtn) {
            appendExtractedTextBtn.disabled = !result.extractedText || 
              result.extractedText === 'No text extracted yet.' ||
              result.extractedText.trim() === '';
          }
        }).catch(error => {
          console.error('Error checking for extracted text:', error);
        });

        // Check if we have an OCR image to enable/disable the use OCR image button
        storageGet(['previewImage']).then(function(result) {
          if (useOcrImageBtn) {
            useOcrImageBtn.disabled = !result.previewImage;
          }
        }).catch(error => {
          console.error('Error checking for preview image:', error);
        });
      }
    });
  });

  if (uploadImageBtn && imageFileInput) {
    uploadImageBtn.addEventListener('click', function() {
      imageFileInput.click();
    });

    imageFileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        const reader = new FileReader();

        // Show loading
        showElement(loadingDiv, true);
        updateStatus('Reading uploaded image...', '');

        reader.onload = function(e) {
          const imageDataUrl = e.target.result;
          
          // Show preview
          showPreviewImage(imageDataUrl);
          
          // Store the image for future use
          storageSet({previewImage: imageDataUrl}).then(function() {
            console.log('Preview image saved');
            
            // Process with OCR
            processUploadedImage(imageDataUrl);
          }).catch(error => {
            showElement(loadingDiv, false);
            updateStatus('Error saving preview image: ' + error.message, 'error');
          });
        };

        reader.onerror = function(e) {
          showElement(loadingDiv, false);
          updateStatus('Error reading image file: ' + e.target.error, 'error');
        };

        reader.readAsDataURL(file);
      }
    });
  }

  function processUploadedImage(imageDataUrl) {
    updateStatus('Processing image...', '');
    
    // Get selected OCR service
    storageGet(['ocrService', 'ocrspaceApiKey', 'serverUrl', 'customOcrSettings']).then(function(result) {
      const ocrService = result.ocrService || 'local';
      
      updateStatus(`Extracting text using ${
        ocrService === 'local' ? 'local server' : 
        ocrService === 'ocrspace' ? 'OCR.space' : 
        'custom OCR API'
      }...`, '');
      
      if (ocrService === 'ocrspace') {
        const apiKey = result.ocrspaceApiKey;
        
        if (!apiKey) {
          showElement(loadingDiv, false);
          updateStatus('Error: OCR.space API key is not set', 'error');
          return;
        }
        
        extractTextWithOCRSpace(imageDataUrl, apiKey).then(handleOcrResult).catch(handleOcrError);
      } else if (ocrService === 'local') {
        const serverUrl = result.serverUrl || 'http://localhost:8000';
        extractTextWithLocalServer(imageDataUrl, serverUrl).then(handleOcrResult).catch(handleOcrError);
      } else if (ocrService === 'custom') {
        const customOcrSettings = result.customOcrSettings;
        
        if (!customOcrSettings || !customOcrSettings.url) {
          showElement(loadingDiv, false);
          updateStatus('Error: Custom OCR API settings are not set', 'error');
          return;
        }
        
        extractTextWithCustomApi(imageDataUrl, customOcrSettings).then(handleOcrResult).catch(handleOcrError);
      }
    }).catch(error => {
      showElement(loadingDiv, false);
      updateStatus('Error getting OCR settings: ' + (error ? error.message : 'Unknown error'), 'error');
    });
  }

  // Helper function to load OCR settings UI based on selected service
  function updateOcrUi(service) {
    if (localServerContainer) showElement(localServerContainer, service === 'local');
    if (apiKeyContainer) showElement(apiKeyContainer, service === 'ocrspace');
    if (customOcrContainer) showElement(customOcrContainer, service === 'custom');
  }

  // Helper function to load AI settings UI based on selected service
  function updateAiUi(service) {
    if (openaiContainer) showElement(openaiContainer, service === 'openai');
    if (localAiServerContainer) showElement(localAiServerContainer, service === 'local');
    if (customAiContainer) showElement(customAiContainer, service === 'custom');
  }

  // Helper function to add a header to a headers list
  function addHeaderToList(container, key, value) {
    if (!container) return;
    
    const headerItem = document.createElement('div');
    headerItem.className = 'header-item';
    headerItem.innerHTML = `
      <span class="header-name">${key}:</span>
      <span class="header-value">${value}</span>
      <button class="remove-header">×</button>
    `;
    
    // Add remove functionality
    headerItem.querySelector('.remove-header').addEventListener('click', function() {
      headerItem.remove();
    });
    
    container.appendChild(headerItem);
  }

  // Helper function to get all headers from a header list
  function getHeadersFromList(container) {
    const headers = {};
    if (!container) return headers;
    
    const headerItems = container.querySelectorAll('.header-item');
    headerItems.forEach(item => {
      const name = item.querySelector('.header-name').textContent.replace(':', '').trim();
      const value = item.querySelector('.header-value').textContent.trim();
      headers[name] = value;
    });
    
    return headers;
  }

  // Helper function to populate headers list from stored headers
  function populateHeadersList(container, headers) {
    if (!container) return;
    
    // Clear existing headers
    container.innerHTML = '';
    
    // Add each header
    if (headers && typeof headers === 'object') {
      Object.keys(headers).forEach(key => {
        addHeaderToList(container, key, headers[key]);
      });
    }
  }

  // Load settings from storage
  storageGet([
    'ocrService', 
    'ocrspaceApiKey', 
    'serverUrl',
    'customOcrSettings',
    'aiService',
    'openaiSettings',
    'localAiSettings',
    'customAiSettings'
  ]).then(function(result) {
    // Set default OCR service if not saved
    const ocrService = result.ocrService || 'local';
    
    // Set the OCR radio button if it exists
    const ocrRadioToCheck = document.querySelector(`input[name="ocrService"][value="${ocrService}"]`);
    if (ocrRadioToCheck) {
      ocrRadioToCheck.checked = true;
    }
    
    // Update OCR UI based on selected service
    updateOcrUi(ocrService);
    
    // Set default AI service if not saved
    const aiService = result.aiService || 'openai';
    
    // Set the AI radio button if it exists
    const aiRadioToCheck = document.querySelector(`input[name="aiService"][value="${aiService}"]`);
    if (aiRadioToCheck) {
      aiRadioToCheck.checked = true;
    }
    
    // Update AI UI based on selected service
    updateAiUi(aiService);
    
    // Set OCR.space API key if saved
    if (result.ocrspaceApiKey && apiKeyInput) {
      apiKeyInput.value = result.ocrspaceApiKey;
    }
    
    // Set server URL or default to localhost if not set
    if (serverUrlInput) {
      serverUrlInput.value = result.serverUrl || 'http://localhost:8000';
    }
    
    // Load custom OCR settings if saved
    if (result.customOcrSettings && customOcrUrlInput) {
      const customOcr = result.customOcrSettings;
      
      customOcrUrlInput.value = customOcr.url || '';
      customOcrParamNameInput.value = customOcr.paramName || '';
      customOcrResponsePathInput.value = customOcr.responsePath || '';
      
      // Set image format radio
      const formatRadio = document.querySelector(`input[name="customOcrImageFormat"][value="${customOcr.imageFormat || 'base64'}"]`);
      if (formatRadio) formatRadio.checked = true;
      
      // Populate headers list
      populateHeadersList(customOcrHeadersList, customOcr.headers);
    }
    
    // Load OpenAI settings if saved
    if (result.openaiSettings && openaiApiKeyInput) {
      const openai = result.openaiSettings;
      
      openaiApiKeyInput.value = openai.apiKey || '';
      
      // Set model if saved and exists in dropdown
      if (openai.model && openaiModelSelect) {
        const option = openaiModelSelect.querySelector(`option[value="${openai.model}"]`);
        if (option) {
          openaiModelSelect.value = openai.model;
        }
      }
    }
    
    // Load local AI settings if saved
    if (result.localAiSettings && aiServerUrlInput) {
      const localAi = result.localAiSettings;
      
      aiServerUrlInput.value = localAi.url || '';
      localAiModelInput.value = localAi.model || '';
    }
    
    // Load custom AI settings if saved
    if (result.customAiSettings && customAiUrlInput) {
      const customAi = result.customAiSettings;
      
      customAiUrlInput.value = customAi.url || '';
      customAiBodyTemplateInput.value = customAi.bodyTemplate || '';
      customAiResponsePathInput.value = customAi.responsePath || '';
      
      // Populate headers list
      populateHeadersList(customAiHeadersList, customAi.headers);
    }
  }).catch(error => {
    console.error('Error loading settings:', error);
  });

  // Load any existing results from storage
  storageGet(['extractedText', 'aiResponse']).then(function(result) {
    // Handle extracted text
    if (result.extractedText && resultTextarea) {
      resultTextarea.value = result.extractedText;
      if (copyBtn) copyBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
      if (sendToAiBtn) sendToAiBtn.disabled = false;
      
      // Also check for a saved preview image
      storageGet(['previewImage']).then(function(result) {
        if (result.previewImage) {
          showPreviewImage(result.previewImage);
        }
      }).catch(error => {
        console.error('Error loading preview image:', error);
      });
    }
    
    // Handle AI response if it exists
    if (result.aiResponse && aiResponseDiv) {
      aiResponseDiv.innerHTML = formatMarkdown(result.aiResponse);
      showElement(aiResponseContainer, true);
      
      // Add styling to code blocks
      aiResponseDiv.querySelectorAll('pre code').forEach(block => {
        block.style.display = 'block';
        block.style.padding = '10px';
        block.style.backgroundColor = '#45464b';
        block.style.borderRadius = '4px';
        block.style.fontFamily = 'monospace';
        block.style.overflow = 'auto';
      });
    }
  }).catch(error => {
    console.error('Error loading results:', error);
  });

  // Check if we have a pending screenshot to process
  storageGet(['pendingScreenshot']).then(function(result) {
    if (result.pendingScreenshot) {
      updateStatus('Processing pending screenshot...', '');
      showElement(loadingDiv, true);
      processScreenshot(result.pendingScreenshot);
    }
  }).catch(error => {
    console.error('Error checking for pending screenshot:', error);
  });

  // Handle OCR service selection change
  if (ocrServiceRadios && ocrServiceRadios.length > 0) {
    ocrServiceRadios.forEach(radio => {
      radio.addEventListener('change', function() {
        const selectedService = this.value;
        
        // Save the selection to storage
        storageSet({ocrService: selectedService}).catch(error => {
          console.error('Error saving OCR service:', error);
        });
        
        // Update UI based on selection
        updateOcrUi(selectedService);
      });
    });
  }
  
  // Handle AI service selection change
  if (aiServiceRadios && aiServiceRadios.length > 0) {
    aiServiceRadios.forEach(radio => {
      radio.addEventListener('change', function() {
        const selectedService = this.value;
        
        // Save the selection to storage
        storageSet({aiService: selectedService}).catch(error => {
          console.error('Error saving AI service:', error);
        });
        
        // Update UI based on selection
        updateAiUi(selectedService);
      });
    });
  }
  
  // Handle local server URL save
  if (saveServerUrlBtn && serverUrlInput) {
    saveServerUrlBtn.addEventListener('click', function() {
      const serverUrl = serverUrlInput.value.trim();
      
      // Basic URL validation
      if (!serverUrl) {
        updateStatus('Please enter a valid server URL', 'error');
        return;
      }
      
      // Check if URL has protocol
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        updateStatus('URL must start with http:// or https://', 'error');
        return;
      }
      
      // Save server URL to storage
      storageSet({serverUrl: serverUrl}).then(function() {
        updateStatus('Server URL saved!', 'success');
      }).catch(error => {
        updateStatus('Error saving server URL: ' + error.message, 'error');
      });
    });
  }
  
  // Handle OCR.space API key save
  if (saveApiKeyBtn && apiKeyInput) {
    saveApiKeyBtn.addEventListener('click', function() {
      const apiKey = apiKeyInput.value.trim();
      
      if (apiKey) {
        // Save API key to storage
        storageSet({ocrspaceApiKey: apiKey}).then(function() {
          updateStatus('OCR.space API key saved!', 'success');
        }).catch(error => {
          updateStatus('Error saving API key: ' + error.message, 'error');
        });
      } else {
        updateStatus('Please enter a valid API key', 'error');
      }
    });
  }
  
  // Handle custom OCR headers
  if (addOcrHeaderBtn && customOcrHeaderKeyInput && customOcrHeaderValueInput && customOcrHeadersList) {
    addOcrHeaderBtn.addEventListener('click', function() {
      const key = customOcrHeaderKeyInput.value.trim();
      const value = customOcrHeaderValueInput.value.trim();
      
      if (key && value) {
        addHeaderToList(customOcrHeadersList, key, value);
        
        // Clear inputs
        customOcrHeaderKeyInput.value = '';
        customOcrHeaderValueInput.value = '';
      } else {
        updateStatus('Please enter both header name and value', 'error');
      }
    });
  }
  
  // Handle custom OCR settings save
  if (saveCustomOcrBtn && customOcrUrlInput) {
    saveCustomOcrBtn.addEventListener('click', function() {
      const url = customOcrUrlInput.value.trim();
      
      // Basic URL validation
      if (!url) {
        updateStatus('Please enter a valid API URL', 'error');
        return;
      }
      
      // Check if URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        updateStatus('URL must start with http:// or https://', 'error');
        return;
      }
      
      // Get selected image format
      const imageFormatRadio = document.querySelector('input[name="customOcrImageFormat"]:checked');
      const imageFormat = imageFormatRadio ? imageFormatRadio.value : 'base64';
      
      // Get param name
      const paramName = customOcrParamNameInput.value.trim();
      if (!paramName) {
        updateStatus('Please enter a parameter name for the image', 'error');
        return;
      }
      
      // Get response path
      const responsePath = customOcrResponsePathInput.value.trim();
      if (!responsePath) {
        updateStatus('Please enter a response path to extract text', 'error');
        return;
      }
      
      // Get headers
      const headers = getHeadersFromList(customOcrHeadersList);
      
      // Save custom OCR settings
      const customOcrSettings = {
        url,
        imageFormat,
        paramName,
        responsePath,
        headers
      };
      
      storageSet({customOcrSettings}).then(function() {
        updateStatus('Custom OCR settings saved!', 'success');
      }).catch(error => {
        updateStatus('Error saving custom OCR settings: ' + error.message, 'error');
      });
    });
  }
  
  // Handle custom OCR test
  if (testCustomOcrBtn) {
    testCustomOcrBtn.addEventListener('click', function() {
      updateStatus('Testing custom OCR API...', '');
      
      // Get current settings
      const url = customOcrUrlInput.value.trim();
      const imageFormatRadio = document.querySelector('input[name="customOcrImageFormat"]:checked');
      const imageFormat = imageFormatRadio ? imageFormatRadio.value : 'base64';
      const paramName = customOcrParamNameInput.value.trim();
      const responsePath = customOcrResponsePathInput.value.trim();
      const headers = getHeadersFromList(customOcrHeadersList);
      
      // Validate settings
      if (!url || !paramName || !responsePath) {
        updateStatus('Please fill in all required fields', 'error');
        return;
      }
      
      // Check if we have a test image
      storageGet(['previewImage']).then(function(result) {
        if (result.previewImage) {
          // Test with the current preview image
          const customOcrSettings = {
            url,
            imageFormat,
            paramName,
            responsePath,
            headers
          };
          
          extractTextWithCustomApi(result.previewImage, customOcrSettings)
            .then(text => {
              updateStatus('Test successful! Result: ' + (text.length > 50 ? text.substring(0, 50) + '...' : text), 'success');
            })
            .catch(error => {
              updateStatus('Test failed: ' + error.message, 'error');
            });
        } else {
          updateStatus('No test image available. Please capture a screenshot first.', 'error');
        }
      }).catch(error => {
        updateStatus('Error getting test image: ' + error.message, 'error');
      });
    });
  }
  
  // Handle OpenAI settings save
  if (saveOpenaiApiKeyBtn && openaiApiKeyInput && openaiModelSelect) {
    saveOpenaiApiKeyBtn.addEventListener('click', function() {
      const apiKey = openaiApiKeyInput.value.trim();
      const model = openaiModelSelect.value;
      
      if (!apiKey) {
        updateStatus('Please enter a valid API key', 'error');
        return;
      }
      
      // Save OpenAI settings
      const openaiSettings = {
        apiKey,
        model
      };
      
      storageSet({openaiSettings}).then(function() {
        updateStatus('OpenAI settings saved!', 'success');
      }).catch(error => {
        updateStatus('Error saving OpenAI settings: ' + error.message, 'error');
      });
    });
  }
  
  // Handle local AI server settings save
  if (saveAiServerUrlBtn && aiServerUrlInput) {
    saveAiServerUrlBtn.addEventListener('click', function() {
      const url = aiServerUrlInput.value.trim();
      const model = localAiModelInput.value.trim();
      
      // Basic URL validation
      if (!url) {
        updateStatus('Please enter a valid server URL', 'error');
        return;
      }
      
      // Check if URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        updateStatus('URL must start with http:// or https://', 'error');
        return;
      }
      
      // Save local AI settings
      const localAiSettings = {
        url,
        model
      };
      
      storageSet({localAiSettings}).then(function() {
        updateStatus('Local AI server settings saved!', 'success');
      }).catch(error => {
        updateStatus('Error saving local AI settings: ' + error.message, 'error');
      });
    });
  }
  
  // Handle custom AI headers
  if (addAiHeaderBtn && customAiHeaderKeyInput && customAiHeaderValueInput && customAiHeadersList) {
    addAiHeaderBtn.addEventListener('click', function() {
      const key = customAiHeaderKeyInput.value.trim();
      const value = customAiHeaderValueInput.value.trim();
      
      if (key && value) {
        addHeaderToList(customAiHeadersList, key, value);
        
        // Clear inputs
        customAiHeaderKeyInput.value = '';
        customAiHeaderValueInput.value = '';
      } else {
        updateStatus('Please enter both header name and value', 'error');
      }
    });
  }
  
  // Handle custom AI settings save
  if (saveCustomAiBtn && customAiUrlInput) {
    saveCustomAiBtn.addEventListener('click', function() {
      const url = customAiUrlInput.value.trim();
      
      // Basic URL validation
      if (!url) {
        updateStatus('Please enter a valid API URL', 'error');
        return;
      }
      
      // Check if URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        updateStatus('URL must start with http:// or https://', 'error');
        return;
      }
      
      // Get body template
      const bodyTemplate = customAiBodyTemplateInput.value.trim();
      if (!bodyTemplate) {
        updateStatus('Please enter a request body template', 'error');
        return;
      }
      
      // Validate body template
      if (!bodyTemplate.includes('{{text}}')) {
        updateStatus('Body template must include {{text}} placeholder', 'error');
        return;
      }
      
      // Get response path
      const responsePath = customAiResponsePathInput.value.trim();
      if (!responsePath) {
        updateStatus('Please enter a response path to extract text', 'error');
        return;
      }
      
      // Get headers
      const headers = getHeadersFromList(customAiHeadersList);
      
      // Save custom AI settings
      const customAiSettings = {
        url,
        bodyTemplate,
        responsePath,
        headers
      };
      
      storageSet({customAiSettings}).then(function() {
        updateStatus('Custom AI settings saved!', 'success');
      }).catch(error => {
        updateStatus('Error saving custom AI settings: ' + error.message, 'error');
      });
    });
  }
  
  // Handle custom AI test
  if (testCustomAiBtn) {
    testCustomAiBtn.addEventListener('click', function() {
      updateStatus('Testing custom AI API...', '');
      
      // Get current settings
      const url = customAiUrlInput.value.trim();
      const bodyTemplate = customAiBodyTemplateInput.value.trim();
      const responsePath = customAiResponsePathInput.value.trim();
      const headers = getHeadersFromList(customAiHeadersList);
      
      // Validate settings
      if (!url || !bodyTemplate || !responsePath) {
        updateStatus('Please fill in all required fields', 'error');
        return;
      }
      
      // Create test message
      const testMessage = "This is a test message to verify the custom API integration.";
      
      // Test AI API
      const customAiSettings = {
        url,
        bodyTemplate,
        responsePath,
        headers
      };
      
      sendToCustomAi(testMessage, customAiSettings)
        .then(response => {
          updateStatus('Test successful! Response: ' + (response.length > 50 ? response.substring(0, 50) + '...' : response), 'success');
        })
        .catch(error => {
          updateStatus('Test failed: ' + error.message, 'error');
        });
    });
  }

  // Capture button handler
  if (captureBtn) {
    captureBtn.addEventListener('click', function() {
      updateStatus('Starting capture...', '');
      captureBtn.disabled = true;
      
      // Clear previous data before starting a new capture
      if (resultTextarea) resultTextarea.value = 'No text extracted yet.';
      if (copyBtn) copyBtn.disabled = true;
      if (clearBtn) clearBtn.disabled = true;
      if (sendToAiBtn) sendToAiBtn.disabled = true;
      
      // Clear AI response from the DOM
      if (aiResponseDiv) {
        aiResponseDiv.innerHTML = '';
      }
      
      // Hide containers
      showElement(previewContainer, false);
      showElement(aiResponseContainer, false);
      
      // Remove stored data
      storageRemove(['extractedText', 'previewImage', 'aiResponse']).then(function() {
        console.log('Previous data cleared for new capture');
      }).catch(error => {
        console.error('Error clearing data:', error);
      });
      
      browserAPI.tabs.query({active: true, currentWindow: true}).then(function(tabs) {
        if (!tabs || tabs.length === 0) {
          updateStatus('Error: No active tab found', 'error');
          captureBtn.disabled = false;
          return;
        }
        
        browserAPI.tabs.sendMessage(tabs[0].id, {action: 'startCapture'}).then(function(response) {
          captureBtn.disabled = false;
          
          if (response && response.status === 'ok') {
            window.close(); // Close popup to allow user to select area
          } else {
            updateStatus('Error: Could not start capture', 'error');
          }
        }).catch(error => {
          captureBtn.disabled = false;
          updateStatus('Error: ' + (error ? error.message : 'Could not communicate with page'), 'error');
        });
      }).catch(error => {
        captureBtn.disabled = false;
        updateStatus('Error: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    });
  }

  // Copy button handler
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      const text = resultTextarea ? resultTextarea.value : '';
      navigator.clipboard.writeText(text).then(function() {
        updateStatus('Copied to clipboard!', 'success');
      }, function(error) {
        updateStatus('Failed to copy text: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    });
  }

  // Clear button handler
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (resultTextarea) resultTextarea.value = 'No text extracted yet.';
      if (copyBtn) copyBtn.disabled = true;
      if (clearBtn) clearBtn.disabled = true;
      if (sendToAiBtn) sendToAiBtn.disabled = true;
      if (sendToAiTabBtn) sendToAiTabBtn.disabled = true;
      showElement(previewContainer, false);
      showElement(aiResponseContainer, false);
      
      // Clear AI response from the DOM
      if (aiResponseDiv) {
        aiResponseDiv.innerHTML = '';
      }
      
      // Remove all stored data including AI response
      storageRemove(['extractedText', 'pendingScreenshot', 'previewImage', 'aiResponse']).then(function() {
        updateStatus('Cleared!', 'success');
        
        // Reset the OCR image
        currentOcrImage = null;
        
        // Disable the "Use OCR Image" button in the AI tab
        if (useOcrImageBtn) {
          useOcrImageBtn.disabled = true;
        }
      }).catch(error => {
        updateStatus('Error clearing data: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    });
  }

  
  // Send to AI button handler (modified to support multiple AI service options)
  if (sendToAiBtn) {
    sendToAiBtn.disabled = false;
    sendToAiBtn.addEventListener('click', function() {
      const promptText = aiPrompt ? aiPrompt.value.trim() : '';
      
      if (!promptText && !currentAiImage) {
        updateStatus('Please enter a prompt or add an image', 'error');
        return;
      }
      
      // Get selected AI service
      storageGet(['aiService']).then(function(result) {
        const aiService = result.aiService || 'openai';
        
        // Show loading indicator
        showElement(aiLoading, true);
        updateStatus(`Sending to ${aiService === 'openai' ? 'OpenAI' : aiService === 'local' ? 'local AI server' : 'custom AI API'}...`, '');
        
        if (aiService === 'openai') {
          // Get OpenAI settings
          storageGet(['openaiSettings']).then(function(result) {
            const openaiSettings = result.openaiSettings || {};
            const apiKey = openaiSettings.apiKey;
            const model = openaiSettings.model || 'gpt-4o-mini-2024-07-18';
            
            if (!apiKey) {
              showElement(aiLoading, false);
              updateStatus('Error: OpenAI API key is not set. Please set it in the Settings tab.', 'error');
              return;
            }
            
            // Send the prompt and image (if any) to OpenAI API
            sendToOpenAIWithImage(promptText, currentAiImage, apiKey, model).then(handleAiResponse).catch(handleAiError);
          }).catch(error => {
            showElement(aiLoading, false);
            updateStatus('Error getting OpenAI settings: ' + (error ? error.message : 'Unknown error'), 'error');
          });
        } else if (aiService === 'local') {
          // Get local AI server settings
          storageGet(['localAiSettings']).then(function(result) {
            const localAiSettings = result.localAiSettings || {};
            const url = localAiSettings.url;
            const model = localAiSettings.model || '';
            
            if (!url) {
              showElement(aiLoading, false);
              updateStatus('Error: Local AI server URL is not set. Please set it in the Settings tab.', 'error');
              return;
            }
            
            // Send the prompt and image (if any) to local AI server
            sendToLocalAiWithImage(promptText, currentAiImage, url, model).then(handleAiResponse).catch(handleAiError);
          }).catch(error => {
            showElement(aiLoading, false);
            updateStatus('Error getting local AI settings: ' + (error ? error.message : 'Unknown error'), 'error');
          });
        } else if (aiService === 'custom') {
          // Get custom AI API settings
          storageGet(['customAiSettings']).then(function(result) {
            const customAiSettings = result.customAiSettings;
            
            if (!customAiSettings || !customAiSettings.url) {
              showElement(aiLoading, false);
              updateStatus('Error: Custom AI API settings are not set. Please configure them in the Settings tab.', 'error');
              return;
            }
            
            // Send the prompt and image (if any) to custom AI API
            sendToCustomAiWithImage(promptText, currentAiImage, customAiSettings).then(handleAiResponse).catch(handleAiError);
          }).catch(error => {
            showElement(aiLoading, false);
            updateStatus('Error getting custom AI settings: ' + (error ? error.message : 'Unknown error'), 'error');
          });
        }
      }).catch(error => {
        showElement(aiLoading, false);
        updateStatus('Error getting AI service: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    });
  }
  
  if (sendToAiTabBtn) {
    sendToAiTabBtn.addEventListener('click', function() {
      if (!resultTextarea || resultTextarea.value.trim() === '' || resultTextarea.value === 'No text extracted yet.') {
        updateStatus('No text to send to AI tab', 'error');
        return;
      }
      
      // Switch to AI tab
      const aiTabButton = document.querySelector('.tab-button[data-tab="ai"]');
      if (aiTabButton) {
        aiTabButton.click();
      }
      
      // Get the extracted text
      const extractedText = resultTextarea.value;
      
      // Set the text in the AI prompt textarea
      if (aiPrompt) {
        aiPrompt.value = extractedText;
      }
      
      // Show success message
      updateStatus('Text sent to AI tab!', 'success');
    });
  }

  if (appendExtractedTextBtn) {
    appendExtractedTextBtn.addEventListener('click', function() {
      storageGet(['extractedText']).then(function(result) {
        const extractedText = result.extractedText;
        
        if (extractedText && extractedText !== 'No text extracted yet.' && extractedText.trim() !== '') {
          // Append the text to the AI prompt textarea
          if (aiPrompt) {
            const currentText = aiPrompt.value;
            
            // Add a line break if there's already text
            if (currentText && currentText.trim() !== '') {
              aiPrompt.value = currentText + '\n\n' + extractedText;
            } else {
              aiPrompt.value = extractedText;
            }
            
            // Show success message
            updateStatus('Extracted text appended to prompt!', 'success');
          }
        } else {
          updateStatus('No extracted text available to append', 'error');
        }
      }).catch(error => {
        updateStatus('Error getting extracted text: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    });
  }

  // Handle image upload for AI
  if (uploadAiImageBtn && aiImageFileInput) {
    uploadAiImageBtn.addEventListener('click', function() {
      aiImageFileInput.click();
    });

    aiImageFileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
          const imageDataUrl = e.target.result;
          
          // Store the image for AI
          currentAiImage = imageDataUrl;
          
          // Show preview
          showAiPreviewImage(imageDataUrl);
          
          // Show success message
          updateStatus('Image added to AI prompt!', 'success');
        };

        reader.onerror = function(e) {
          updateStatus('Error reading image file: ' + e.target.error, 'error');
        };

        reader.readAsDataURL(file);
      }
    });
  }

  // Handle screenshot capture for AI
  if (captureAiScreenshotBtn) {
    captureAiScreenshotBtn.addEventListener('click', function() {
      updateStatus('Starting capture for AI...', '');
      captureAiScreenshotBtn.disabled = true;
      
      // Store a flag to indicate we're capturing for AI
      storageSet({capturingForAi: true}).then(function() {
        // Proceed with capture similar to the original capture button
        browserAPI.tabs.query({active: true, currentWindow: true}).then(function(tabs) {
          if (!tabs || tabs.length === 0) {
            updateStatus('Error: No active tab found', 'error');
            captureAiScreenshotBtn.disabled = false;
            return;
          }
          
          browserAPI.tabs.sendMessage(tabs[0].id, {action: 'startCapture'}).then(function(response) {
            captureAiScreenshotBtn.disabled = false;
            
            if (response && response.status === 'ok') {
              window.close(); // Close popup to allow user to select area
            } else {
              updateStatus('Error: Could not start capture', 'error');
            }
          }).catch(error => {
            captureAiScreenshotBtn.disabled = false;
            updateStatus('Error: ' + (error ? error.message : 'Could not communicate with page'), 'error');
          });
        }).catch(error => {
          captureAiScreenshotBtn.disabled = false;
          updateStatus('Error: ' + (error ? error.message : 'Unknown error'), 'error');
        });
      }).catch(error => {
        captureAiScreenshotBtn.disabled = false;
        updateStatus('Error setting capture mode: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    });
  }

  // Handle "Use OCR Image" button
  if (useOcrImageBtn) {
    useOcrImageBtn.addEventListener('click', function() {
      storageGet(['previewImage']).then(function(result) {
        if (result.previewImage) {
          // Store the OCR image for AI
          currentAiImage = result.previewImage;
          
          // Show preview
          showAiPreviewImage(result.previewImage);
          
          // Show success message
          updateStatus('OCR image added to AI prompt!', 'success');
        } else {
          updateStatus('No OCR image available', 'error');
        }
      }).catch(error => {
        updateStatus('Error getting OCR image: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    });
  }

  // Handle remove AI image button
  if (removeAiImageBtn) {
    removeAiImageBtn.addEventListener('click', function() {
      // Clear the AI image
      currentAiImage = null;
      
      // Hide the preview
      showElement(aiPreviewContainer, false);
      
      // Show success message
      updateStatus('Image removed from AI prompt!', 'success');
    });
  }

  // Function to show AI preview image
  function showAiPreviewImage(dataUrl) {
    if (!aiPreviewContainer) return;
    
    // Clear any existing preview
    aiPreviewContainer.innerHTML = '';
    
    // Create and add new preview image
    const previewImg = document.createElement('img');
    previewImg.src = dataUrl;
    previewImg.id = 'ai-preview-img';
    previewImg.style.maxWidth = '100%';
    previewImg.style.maxHeight = '150px';
    previewImg.style.display = 'block';
    previewImg.style.margin = '0 auto';
    aiPreviewContainer.appendChild(previewImg);
    
    // Add back the remove button
    aiPreviewContainer.appendChild(removeAiImageBtn);
    
    // Show the container
    showElement(aiPreviewContainer, true);
  }

  // Common handler for AI responses
  function handleAiResponse(response) {
    const cleanedResponse = cleanSystemMessages(response);
    showElement(aiLoading, false);
    showElement(aiResponseContainer, true); // Fixed: use the aiResponseContainer variable
    if (aiResponseDiv) {
      aiResponseDiv.innerHTML = formatMarkdown(cleanedResponse);
      
      // Add styling to code blocks
      aiResponseDiv.querySelectorAll('pre code').forEach(block => {
        block.style.display = 'block';
        block.style.padding = '10px';
        block.style.backgroundColor = '#45464b';
        block.style.borderRadius = '4px';
        block.style.fontFamily = 'monospace';
        block.style.overflow = 'auto';
      });
      
      // Save the AI response to storage for persistence
      storageSet({aiResponse: cleanedResponse}).catch(error => {
        console.error('Error saving AI response:', error);
      });
    }
    updateStatus('Response received from AI!', 'success');
  }
  
  // Common handler for AI errors
  function handleAiError(error) {
    showElement(aiLoading, false);
    updateStatus('Error from AI: ' + (error ? error.message : 'Unknown error'), 'error');
  }
  
  if (copyAiResponseBtn) {
    copyAiResponseBtn.addEventListener('click', function() {
      if (aiResponseDiv) {
        // Get the text content without HTML tags
        const text = aiResponseDiv.textContent || '';
        
        navigator.clipboard.writeText(text).then(function() {
          updateStatus('AI response copied to clipboard!', 'success');
        }, function(error) {
          updateStatus('Failed to copy AI response: ' + (error ? error.message : 'Unknown error'), 'error');
        });
      }
    });
  }

  if (clearAiBtn) {
    clearAiBtn.addEventListener('click', function() {
      // Clear the AI prompt
      if (aiPrompt) {
        aiPrompt.value = '';
      }
      
      // Clear the AI image
      currentAiImage = null;
      
      // Hide the preview
      showElement(aiPreviewContainer, false);
      
      // Clear AI response from the DOM
      if (aiResponseDiv) {
        aiResponseDiv.innerHTML = '';
      }
      
      // Hide the response container
      showElement(aiResponseContainer, false);
      
      // Remove AI response from storage
      storageRemove(['aiResponse']).then(function() {
        updateStatus('AI interaction cleared!', 'success');
      }).catch(error => {
        updateStatus('Error clearing AI data: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    });
  }

  // Listen for changes in the result textarea to enable/disable buttons
  if (resultTextarea) {
    resultTextarea.addEventListener('input', function() {
      const hasText = this.value.trim() !== '' && this.value !== 'No text extracted yet.';
      if (copyBtn) copyBtn.disabled = !hasText;
      if (clearBtn) clearBtn.disabled = !hasText;
      if (sendToAiBtn) sendToAiBtn.disabled = !hasText;
      
      // Save the edited text
      if (hasText) {
        storageSet({extractedText: this.value}).catch(error => {
          console.error('Error saving extracted text:', error);
        });
      }
    });
  }
  
  // Function to show preview image
  function showPreviewImage(dataUrl) {
    if (!previewContainer) return;
    
    // Clear any existing preview
    previewContainer.innerHTML = '';
    
    // Create and add new preview image
    const previewImg = document.createElement('img');
    previewImg.src = dataUrl;
    previewImg.id = 'preview-img';
    previewContainer.appendChild(previewImg);
    
    // Show the container
    showElement(previewContainer, true);
  }

  // Process a screenshot (crop and extract text)
  function processScreenshot(data) {
    console.log('Processing screenshot in popup', data.area);
    updateStatus('Cropping screenshot...', '');
    showElement(loadingDiv, true);
    
    try {
      const img = new Image();
      img.onload = function() {
        console.log('Screenshot loaded, dimensions:', img.width, 'x', img.height);
        
        try {
          // Create canvas for cropping
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate proper crop coordinates based on zoom and scroll
          const area = data.area;
          
          // Apply scaling factors for different viewport sizes
          const imgScale = {
            x: img.width / area.windowWidth,
            y: img.height / area.windowHeight
          };
          
          console.log('Image scale factors:', imgScale);
          
          // Calculate final crop coordinates
          const cropX = area.left * imgScale.x;
          const cropY = area.top * imgScale.y;
          const cropWidth = area.width * imgScale.x;
          const cropHeight = area.height * imgScale.y;
          
          // Set canvas dimensions to match selected area
          canvas.width = cropWidth;
          canvas.height = cropHeight;
          
          console.log('Original selection:', area.left, area.top, area.width, area.height);
          console.log('Final crop coordinates:', cropX, cropY, cropWidth, cropHeight);
          
          // Draw the cropped region
          ctx.drawImage(img, 
                      cropX, cropY, 
                      cropWidth, cropHeight, 
                      0, 0, 
                      cropWidth, cropHeight);
          
          const croppedDataUrl = canvas.toDataURL('image/png');
          console.log('Image cropped');
          
          // Show preview image
          showPreviewImage(croppedDataUrl);
          
          // Store preview for future loading
          storageSet({previewImage: croppedDataUrl}).catch(error => {
            console.error('Error saving preview image:', error);
          });
          
          // Get selected OCR service
          storageGet(['ocrService', 'ocrspaceApiKey', 'serverUrl', 'customOcrSettings']).then(function(result) {
            const ocrService = result.ocrService || 'local';
            
            updateStatus(`Extracting text using ${
              ocrService === 'local' ? 'local server' : 
              ocrService === 'ocrspace' ? 'OCR.space' : 
              'custom OCR API'
            }...`, '');
            
            if (ocrService === 'ocrspace') {
              const apiKey = result.ocrspaceApiKey;
              
              if (!apiKey) {
                showElement(loadingDiv, false);
                updateStatus('Error: OCR.space API key is not set', 'error');
                return;
              }
              
              extractTextWithOCRSpace(croppedDataUrl, apiKey).then(handleOcrResult).catch(handleOcrError);
            } else if (ocrService === 'local') {
              // Use the local server with the stored URL
              const serverUrl = result.serverUrl || 'http://localhost:8000';
              
              extractTextWithLocalServer(croppedDataUrl, serverUrl).then(handleOcrResult).catch(handleOcrError);
            } else if (ocrService === 'custom') {
              // Use custom OCR API
              const customOcrSettings = result.customOcrSettings;
              
              if (!customOcrSettings || !customOcrSettings.url) {
                showElement(loadingDiv, false);
                updateStatus('Error: Custom OCR API settings are not set', 'error');
                return;
              }
              
              extractTextWithCustomApi(croppedDataUrl, customOcrSettings).then(handleOcrResult).catch(handleOcrError);
            }
          }).catch(error => {
            showElement(loadingDiv, false);
            updateStatus('Error getting OCR settings: ' + (error ? error.message : 'Unknown error'), 'error');
          });
        } catch (error) {
          showElement(loadingDiv, false);
          console.error('Error processing image:', error);
          updateStatus('Error processing image: ' + (error ? error.message : 'Unknown error'), 'error');
        }
      };
      
      img.onerror = function(e) {
        showElement(loadingDiv, false);
        console.error('Failed to load screenshot image', e);
        updateStatus('Error loading screenshot', 'error');
      };
      
      img.src = data.dataUrl;
    } catch (error) {
      showElement(loadingDiv, false);
      console.error('Error in processScreenshot:', error);
      updateStatus('Error: ' + (error ? error.message : 'Unknown error'), 'error');
    }
  }
  
  // Common handler for OCR results
  function handleOcrResult(text) {
    console.log('Text extracted successfully');
    showElement(loadingDiv, false);
    
    if (text.trim().length === 0) {
      text = "No text was detected in the selected area.";
    }
    
    // Update UI
    if (resultTextarea) resultTextarea.value = text;
    if (copyBtn) copyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
    if (sendToAiBtn) sendToAiBtn.disabled = text === "No text was detected in the selected area.";
    if (sendToAiTabBtn) sendToAiTabBtn.disabled = text === "No text was detected in the selected area.";
    updateStatus('Text extracted successfully!', 'success');
    
    // Store the result
    storageSet({extractedText: text}).catch(error => {
      console.error('Error saving extracted text:', error);
    });
    
    // Clear the pending screenshot
    storageRemove(['pendingScreenshot']).catch(error => {
      console.error('Error removing pending screenshot:', error);
    });
    
    // Get the current preview image for the OCR image functionality
    storageGet(['previewImage']).then(function(result) {
      if (result.previewImage) {
        currentOcrImage = result.previewImage;
        
        // Enable the "Use OCR Image" button in the AI tab
        if (useOcrImageBtn) {
          useOcrImageBtn.disabled = false;
        }
      }
    }).catch(error => {
      console.error('Error getting preview image:', error);
    });
  }

  
  // Common handler for OCR errors
  function handleOcrError(error) {
    showElement(loadingDiv, false);
    console.error('Text extraction error:', error);
    updateStatus('Error during text extraction: ' + (error ? error.message : 'Unknown error'), 'error');
    if (resultTextarea) resultTextarea.value = 'Error during text extraction. Please try again.';
  }
  
  // Extract text using local server
  function extractTextWithLocalServer(imageData, serverUrl) {
    console.log('Using local server at:', serverUrl);
    
    return fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageData
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Server returned status ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      return data.extracted_text || "No text detected";
    });
  }
  
  // Extract text using OCR.space API
  function extractTextWithOCRSpace(imageData, apiKey) {
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
      console.log('OCR.space response:', data);
      
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
  
  // Extract text using custom OCR API
  function extractTextWithCustomApi(imageData, settings) {
    console.log('Using custom OCR API at:', settings.url);
    
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
      console.log('Custom OCR API response:', data);
      
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
  
  // Send text to OpenAI API with configurable model
  function sendToOpenAI(text, apiKey, model) {
    // The OpenAI API endpoint
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    return fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model, // Use the specified model
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: text }
        ],
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
      console.log('OpenAI response:', data);
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response generated');
      }
      
      return data.choices[0].message.content;
    });
  }
  
  // Send text to local AI server
  function sendToLocalAi(text, serverUrl, model) {
    console.log('Using local AI server at:', serverUrl);
    
    // Prepare request body
    const requestBody = {
      text: text
    };
    
    // Add model if specified
    if (model) {
      requestBody.model = model;
    }
    
    return fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Local AI server returned status ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      console.log('Local AI server response:', data);
      
      // Check for the response field (expecting 'response' or 'text' field)
      if (data.response) {
        return data.response;
      } else if (data.text) {
        return data.text;
      } else if (data.content) {
        return data.content;
      } else {
        throw new Error('Unexpected response format from local AI server');
      }
    });
  }
  
  // Send text to custom AI API
  function sendToCustomAi(text, settings) {
    console.log('Using custom AI API at:', settings.url);
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      ...settings.headers
    };
    
    // Replace {{text}} in body template with actual text
    const processedBodyTemplate = settings.bodyTemplate.replace('{{text}}', text);
    
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
      console.log('Custom AI API response:', data);
      
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
  
  // Listen for messages from background script
  browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Popup received message:', request.action);
    
    if (request.action === 'processScreenshot') {
      // Check if we're capturing for AI
      storageGet(['capturingForAi', 'pendingScreenshot']).then(function(result) {
        if (result.capturingForAi) {
          // We're capturing for AI
          if (result.pendingScreenshot) {
            const screenshotData = result.pendingScreenshot;
            
            // Use the screenshot for AI
            currentAiImage = screenshotData.dataUrl;
            
            // Show preview in AI tab
            showAiPreviewImage(screenshotData.dataUrl);
            
            // Switch to AI tab
            const aiTabButton = document.querySelector('.tab-button[data-tab="ai"]');
            if (aiTabButton) {
              aiTabButton.click();
            }
            
            // Clear the pendingScreenshot and capturingForAi flag
            storageRemove(['pendingScreenshot', 'capturingForAi']).then(function() {
              updateStatus('Screenshot captured for AI!', 'success');
            }).catch(error => {
              console.error('Error clearing pending screenshot:', error);
            });
          }
        } else {
          // Normal OCR processing
          if (result.pendingScreenshot) {
            processScreenshot(result.pendingScreenshot);
          }
        }
      }).catch(error => {
        console.error('Error getting pendingScreenshot:', error);
      });
    }
    
    return true;
  });
  
  function sendToOpenAIWithImage(text, imageDataUrl, apiKey, model) {
    // The OpenAI API endpoint for chat completions
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    // Prepare the messages array
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' }
    ];
    
    // If we have an image, add it to the messages
    if (imageDataUrl) {
      // For models that support images (like gpt-4-vision and gpt-4o)
      if (model.includes('gpt-4') || model.includes('gpt-4o')) {
        // Extract the base64 data
        const base64Data = imageDataUrl.split(',')[1];
        
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
      console.log('OpenAI response:', data);
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response generated');
      }
      
      return data.choices[0].message.content;
    });
  }

  // New function to send text and image to local AI server
  function sendToLocalAiWithImage(text, imageDataUrl, serverUrl, model) {
    console.log('Using local AI server at:', serverUrl);
    
    // Prepare request body
    const requestBody = {
      text: text
    };
    
    // Add image if provided
    if (imageDataUrl) {
      // Extract the base64 data
      const base64Data = imageDataUrl.split(',')[1];
      requestBody.image = base64Data;
    }
    
    // Add model if specified
    if (model) {
      requestBody.model = model;
    }
    
    return fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Local AI server returned status ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      console.log('Local AI server response:', data);
      
      // Check for the response field (expecting 'response' or 'text' field)
      if (data.response) {
        return data.response;
      } else if (data.text) {
        return data.text;
      } else if (data.content) {
        return data.content;
      } else {
        throw new Error('Unexpected response format from local AI server');
      }
    });
  }

  // New function to send text and image to custom AI API
  function sendToCustomAiWithImage(text, imageDataUrl, settings) {
    console.log('Using custom AI API at:', settings.url);
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      ...settings.headers
    };
    
    // Check for image support in custom API
    const customImageSupport = document.querySelector('input[name="customAiImageSupport"]:checked');
    const imageSupport = customImageSupport ? customImageSupport.value : 'none';
    
    // Replace {{text}} in body template with actual text
    let processedBodyTemplate = settings.bodyTemplate.replace('{{text}}', text || '');
    
    // Replace {{image}} with base64 image data if applicable
    if (imageDataUrl && imageSupport === 'base64') {
      const base64Data = imageDataUrl.split(',')[1];
      processedBodyTemplate = processedBodyTemplate.replace('{{image}}', base64Data);
    } else if (imageDataUrl && imageSupport === 'url') {
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
      console.log('Custom AI API response:', data);
      
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
  
  // Load AI tab state
  storageGet(['aiResponse']).then(function(result) {
    // Handle AI response if it exists
    if (result.aiResponse && aiResponseDiv) {
      aiResponseDiv.innerHTML = formatMarkdown(result.aiResponse);
      showElement(aiResponseContainer, true);
      
      // Add styling to code blocks
      aiResponseDiv.querySelectorAll('pre code').forEach(block => {
        block.style.display = 'block';
        block.style.padding = '10px';
        block.style.backgroundColor = '#45464b';
        block.style.borderRadius = '4px';
        block.style.fontFamily = 'monospace';
        block.style.overflow = 'auto';
      });
    }
  }).catch(error => {
    console.error('Error loading AI response:', error);
  });

  function initializeAiTab() {
    // Always enable the send to AI button
    if (sendToAiBtn) {
      sendToAiBtn.disabled = false;
    }
  
    // Check if we have extracted text to enable/disable the append button
    storageGet(['extractedText']).then(function(result) {
      if (appendExtractedTextBtn) {
        appendExtractedTextBtn.disabled = !result.extractedText || 
          result.extractedText === 'No text extracted yet.' ||
          result.extractedText.trim() === '';
      }
    }).catch(error => {
      console.error('Error checking for extracted text:', error);
      // Default to disabled if there's an error
      if (appendExtractedTextBtn) {
        appendExtractedTextBtn.disabled = true;
      }
    });
  
    // Check if we have an OCR image to enable/disable the use OCR image button
    storageGet(['previewImage']).then(function(result) {
      if (useOcrImageBtn) {
        useOcrImageBtn.disabled = !result.previewImage;
      }
    }).catch(error => {
      console.error('Error checking for preview image:', error);
      // Default to disabled if there's an error
      if (useOcrImageBtn) {
        useOcrImageBtn.disabled = true;
      }
    });
  }
  
  // Call this function during initialization
  initializeAiTab();

  function formatMarkdown(text) {
    if (!text) return '';
    
    // First ensure all system messages are removed
    const cleanedText = cleanSystemMessages(text);
    
    // Sanitize the input to prevent XSS
    const sanitized = cleanedText
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Process mathematics notation with enhanced symbol support
    let formatted = sanitized;
    
    // Handle display math notation \[ ... \]
    formatted = formatted.replace(/\\\[([\s\S]*?)\\\]/g, '<div class="math-display">$1</div>');
    
    // Handle inline math notation \( ... \)
    formatted = formatted.replace(/\\\(([\s\S]*?)\\\)/g, '<span class="math-inline">$1</span>');
    
    // Enhanced LaTeX math symbols
    const mathSymbols = [
      // Basic operators
      { pattern: /\\cap/g, replacement: '∩' },             // Intersection
      { pattern: /\\cup/g, replacement: '∪' },             // Union
      { pattern: /\\in/g, replacement: '∈' },              // Element of
      { pattern: /\\subset/g, replacement: '⊂' },          // Subset
      { pattern: /\\supset/g, replacement: '⊃' },          // Superset
      { pattern: /\\emptyset/g, replacement: '∅' },        // Empty set
      
      // Arithmetic operators
      { pattern: /\\times/g, replacement: '×' },           // Multiplication
      { pattern: /\\div/g, replacement: '÷' },             // Division
      { pattern: /\\pm/g, replacement: '±' },              // Plus-minus
      { pattern: /\\cdot/g, replacement: '·' },            // Dot product
      
      // Comparison operators
      { pattern: /\\leq/g, replacement: '≤' },             // Less than or equal
      { pattern: /\\geq/g, replacement: '≥' },             // Greater than or equal
      { pattern: /\\neq/g, replacement: '≠' },             // Not equal
      { pattern: /\\approx/g, replacement: '≈' },          // Approximately
      
      // Arrows and implications
      { pattern: /\\rightarrow/g, replacement: '→' },      // Right arrow
      { pattern: /\\leftarrow/g, replacement: '←' },       // Left arrow
      { pattern: /\\Rightarrow/g, replacement: '⇒' },      // Right double arrow
      { pattern: /\\Leftarrow/g, replacement: '⇐' },       // Left double arrow
      { pattern: /\\implies/g, replacement: '⟹' },        // Implies
      { pattern: /\\iff/g, replacement: '⟺' },            // If and only if
      
      // Other symbols
      { pattern: /\\ldots/g, replacement: '…' },           // Horizontal ellipsis
      { pattern: /\\infty/g, replacement: '∞' },           // Infinity
      
      // Greek letters (lowercase)
      { pattern: /\\alpha/g, replacement: 'α' },
      { pattern: /\\beta/g, replacement: 'β' },
      { pattern: /\\gamma/g, replacement: 'γ' },
      { pattern: /\\delta/g, replacement: 'δ' },
      { pattern: /\\epsilon/g, replacement: 'ε' },
      { pattern: /\\zeta/g, replacement: 'ζ' },
      { pattern: /\\eta/g, replacement: 'η' },
      { pattern: /\\theta/g, replacement: 'θ' },
      { pattern: /\\iota/g, replacement: 'ι' },
      { pattern: /\\kappa/g, replacement: 'κ' },
      { pattern: /\\lambda/g, replacement: 'λ' },
      { pattern: /\\mu/g, replacement: 'μ' },
      { pattern: /\\nu/g, replacement: 'ν' },
      { pattern: /\\xi/g, replacement: 'ξ' },
      { pattern: /\\pi/g, replacement: 'π' },
      { pattern: /\\rho/g, replacement: 'ρ' },
      { pattern: /\\sigma/g, replacement: 'σ' },
      { pattern: /\\tau/g, replacement: 'τ' },
      { pattern: /\\upsilon/g, replacement: 'υ' },
      { pattern: /\\phi/g, replacement: 'φ' },
      { pattern: /\\chi/g, replacement: 'χ' },
      { pattern: /\\psi/g, replacement: 'ψ' },
      { pattern: /\\omega/g, replacement: 'ω' },
      
      // Greek letters (uppercase)
      { pattern: /\\Gamma/g, replacement: 'Γ' },
      { pattern: /\\Delta/g, replacement: 'Δ' },
      { pattern: /\\Theta/g, replacement: 'Θ' },
      { pattern: /\\Lambda/g, replacement: 'Λ' },
      { pattern: /\\Xi/g, replacement: 'Ξ' },
      { pattern: /\\Pi/g, replacement: 'Π' },
      { pattern: /\\Sigma/g, replacement: 'Σ' },
      { pattern: /\\Phi/g, replacement: 'Φ' },
      { pattern: /\\Psi/g, replacement: 'Ψ' },
      { pattern: /\\Omega/g, replacement: 'Ω' }
    ];
    
    // Apply all symbol replacements
    mathSymbols.forEach(symbol => {
      formatted = formatted.replace(symbol.pattern, symbol.replacement);
    });
    
    // Remove any remaining \mi commands
    formatted = formatted.replace(/\\mi/g, '');
    
    // Function notation n(A) for cardinality
    formatted = formatted.replace(/n\((.*?)\)/g, '|$1|');
    
    // Make superscripts look better (e.g., x^2)
    formatted = formatted.replace(/\^(\d+|\{.*?\})/g, '<sup>$1</sup>');
    
    // Make subscripts look better (e.g., x_i)
    formatted = formatted.replace(/\_(\d+|\{.*?\})/g, '<sub>$1</sub>');
    
    // Apply standard markdown formatting
    formatted = formatted
      // Handle code blocks (```code```)
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      
      // Handle inline code (`code`)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      
      // Handle bold (**text** or __text__)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      
      // Handle italic (*text* or _text_) - being careful not to conflict with bold
      .replace(/\b_([^_]+)_\b/g, '<em>$1</em>')
      .replace(/\b\*([^\*]+)\*\b/g, '<em>$1</em>')
      
      // Handle links [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      
      // Handle headings (# Heading)
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      
      // Handle blockquotes
      .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
      
      // Handle unordered lists
      .replace(/^\* (.*$)/gm, '<li>$1</li>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      
      // Handle ordered lists
      .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
      
      // Handle paragraphs
      .replace(/\n\n/g, '</p><p>')
      
      // Handle line breaks
      .replace(/\n/g, '<br>');
    
    // Wrap with paragraph if not already wrapped
    if (!formatted.startsWith('<h') && !formatted.startsWith('<pre') && !formatted.startsWith('<blockquote')) {
      formatted = '<p>' + formatted + '</p>';
    }
    
    // Clean up any empty paragraphs
    formatted = formatted.replace(/<p><\/p>/g, '');
    
    // Wrap lists with <ul> or <ol> tags as needed
    formatted = formatted.replace(/<li>.*?<\/li>/g, function(match) {
      return '<ul>' + match + '</ul>';
    });
    
    return formatted;
  }
}

// Check if the DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  // DOM is already loaded, initialize immediately
  initializePopup();
}
function cleanSystemMessages(text) {
  if (!text) return '';
  
  // First pass: Remove system tags and their content
  let cleaned = text;
  
  // System tag patterns to remove completely
  const systemPatterns = [
    // Direct tag removal
    /<search_reminders>[\s\S]*?<\/search_reminders>/gi,
    /<automated_reminder_from_anthropic>[\s\S]*?<\/automated_reminder_from_anthropic>/gi,
    /<fnr>[\s\S]*?<\/function_results>/gi,
    /<[\s\S]*?<\/antml:[\s\S]*?>/gi,
    /<userStyle>[\s\S]*?<\/userStyle>/gi,
    /<thinking>[\s\S]*?<\/thinking>/gi,
    /<citation_instructions>[\s\S]*?<\/citation_instructions>/gi,
    /<content_guidelines>[\s\S]*?<\/content_guidelines>/gi,
    /<web_search_tool>[\s\S]*?<\/web_search_tool>/gi,
    /<search_guidelines>[\s\S]*?<\/search_guidelines>/gi,
    /<copyright_handling>[\s\S]*?<\/copyright_handling>/gi,
    /<styles_info>[\s\S]*?<\/styles_info>/gi,
    /<artifacts_info>[\s\S]*?<\/artifacts_info>/gi,
    /<document_context>[\s\S]*?<\/document_context>/gi,
    
    // Any other system-like tags not caught above
    /<[a-z_]+>[\s\S]*?<\/[a-z_]+>/gi
  ];
  
  // Remove all system patterns
  systemPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Remove any LaTeX math tags that don't contain actual math
  cleaned = cleaned.replace(/\\mi(?!\w)/g, '');  // Remove standalone \mi
  cleaned = cleaned.replace(/\\boxed\{([^}]*)\}/g, '$1');  // Remove \boxed and keep content
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}