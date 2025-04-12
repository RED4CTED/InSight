document.addEventListener('DOMContentLoaded', function() {
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
  
  // New server URL elements
  const serverUrlInput = document.getElementById('serverUrlInput');
  const saveServerUrlBtn = document.getElementById('saveServerUrlBtn');
  
  // OpenAI API elements
  const openaiApiKeyInput = document.getElementById('openaiApiKeyInput');
  const saveOpenaiApiKeyBtn = document.getElementById('saveOpenaiApiKeyBtn');
  const sendToOpenaiBtn = document.getElementById('sendToOpenaiBtn');
  const aiResponseContainer = document.getElementById('ai-response-container');
  const aiResponseDiv = document.getElementById('ai-response');
  
  console.log('Popup loaded');
  
  // Log the presence of our UI elements for debugging
  console.log('OCR service radios found:', ocrServiceRadios?.length > 0);
  console.log('API key container found:', apiKeyContainer !== null);
  console.log('Server URL input found:', serverUrlInput !== null);
  console.log('OpenAI API key input found:', openaiApiKeyInput !== null);
  console.log('Send to OpenAI button found:', sendToOpenaiBtn !== null);

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
    });
  });

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

  // Load settings from storage
  chrome.storage.local.get(['ocrService', 'ocrspaceApiKey', 'openaiApiKey', 'serverUrl'], function(result) {
    // Set default OCR service if not saved
    const ocrService = result.ocrService || 'local';
    
    // Set the radio button if it exists
    const radioToCheck = document.querySelector(`input[name="ocrService"][value="${ocrService}"]`);
    if (radioToCheck) {
      radioToCheck.checked = true;
    }
    
    // Show API key input if OCR.space is selected and the container exists
    if (apiKeyContainer) {
      showElement(apiKeyContainer, ocrService === 'ocrspace');
    }
    
    // Set API keys and server URL if saved
    if (result.ocrspaceApiKey && apiKeyInput) {
      apiKeyInput.value = result.ocrspaceApiKey;
    }
    
    if (result.openaiApiKey && openaiApiKeyInput) {
      openaiApiKeyInput.value = result.openaiApiKey;
    }
    
    // Set server URL or default to localhost if not set
    if (serverUrlInput) {
      serverUrlInput.value = result.serverUrl || 'http://localhost:8000';
    }
  });

  // Load any existing results from storage
  chrome.storage.local.get(['extractedText', 'aiResponse'], function(result) {
    // Handle extracted text
    if (result.extractedText && resultTextarea) {
      resultTextarea.value = result.extractedText;
      if (copyBtn) copyBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
      if (sendToOpenaiBtn) sendToOpenaiBtn.disabled = false;
      
      // Also check for a saved preview image
      chrome.storage.local.get(['previewImage'], function(result) {
        if (result.previewImage) {
          showPreviewImage(result.previewImage);
        }
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
  });

  // Check if we have a pending screenshot to process
  chrome.storage.local.get(['pendingScreenshot'], function(result) {
    if (result.pendingScreenshot) {
      updateStatus('Processing pending screenshot...', '');
      showElement(loadingDiv, true);
      processScreenshot(result.pendingScreenshot);
    }
  });

  // Handle OCR service selection change
  if (ocrServiceRadios && ocrServiceRadios.length > 0) {
    ocrServiceRadios.forEach(radio => {
      radio.addEventListener('change', function() {
        const selectedService = this.value;
        
        // Save the selection to storage
        chrome.storage.local.set({ocrService: selectedService});
        
        // Show/hide API key input
        if (apiKeyContainer) {
          showElement(apiKeyContainer, selectedService === 'ocrspace');
        }
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
      chrome.storage.local.set({serverUrl: serverUrl}, function() {
        updateStatus('Server URL saved!', 'success');
      });
    });
  }
  
  // Handle OCR.space API key save
  if (saveApiKeyBtn && apiKeyInput) {
    saveApiKeyBtn.addEventListener('click', function() {
      const apiKey = apiKeyInput.value.trim();
      
      if (apiKey) {
        // Save API key to storage
        chrome.storage.local.set({ocrspaceApiKey: apiKey}, function() {
          updateStatus('OCR.space API key saved!', 'success');
        });
      } else {
        updateStatus('Please enter a valid API key', 'error');
      }
    });
  }
  
  // Handle OpenAI API key save
  if (saveOpenaiApiKeyBtn && openaiApiKeyInput) {
    saveOpenaiApiKeyBtn.addEventListener('click', function() {
      const apiKey = openaiApiKeyInput.value.trim();
      
      if (apiKey) {
        // Save API key to storage
        chrome.storage.local.set({openaiApiKey: apiKey}, function() {
          updateStatus('OpenAI API key saved!', 'success');
        });
      } else {
        updateStatus('Please enter a valid OpenAI API key', 'error');
      }
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
      if (sendToOpenaiBtn) sendToOpenaiBtn.disabled = true;
      
      // Clear AI response from the DOM
      if (aiResponseDiv) {
        aiResponseDiv.innerHTML = '';
      }
      
      // Hide containers
      showElement(previewContainer, false);
      showElement(aiResponseContainer, false);
      
      // Remove stored data
      chrome.storage.local.remove(['extractedText', 'previewImage', 'aiResponse'], function() {
        console.log('Previous data cleared for new capture');
      });
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || tabs.length === 0) {
          updateStatus('Error: No active tab found', 'error');
          captureBtn.disabled = false;
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {action: 'startCapture'}, function(response) {
          captureBtn.disabled = false;
          
          if (chrome.runtime.lastError) {
            updateStatus('Error: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          if (response && response.status === 'ok') {
            window.close(); // Close popup to allow user to select area
          } else {
            updateStatus('Error: Could not start capture', 'error');
          }
        });
      });
    });
  }

  // Copy button handler
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      const text = resultTextarea ? resultTextarea.value : '';
      navigator.clipboard.writeText(text).then(function() {
        updateStatus('Copied to clipboard!', 'success');
      }, function() {
        updateStatus('Failed to copy text', 'error');
      });
    });
  }

  // Clear button handler
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (resultTextarea) resultTextarea.value = 'No text extracted yet.';
      if (copyBtn) copyBtn.disabled = true;
      if (clearBtn) clearBtn.disabled = true;
      if (sendToOpenaiBtn) sendToOpenaiBtn.disabled = true;
      showElement(previewContainer, false);
      showElement(aiResponseContainer, false);
      
      // Clear AI response from the DOM
      if (aiResponseDiv) {
        aiResponseDiv.innerHTML = '';
      }
      
      // Remove all stored data including AI response
      chrome.storage.local.remove(['extractedText', 'pendingScreenshot', 'previewImage', 'aiResponse'], function() {
        updateStatus('Cleared!', 'success');
      });
    });
  }
  
  // Send to OpenAI button handler
  if (sendToOpenaiBtn) {
    sendToOpenaiBtn.addEventListener('click', function() {
      if (!resultTextarea || resultTextarea.value.trim() === '' || resultTextarea.value === 'No text extracted yet.') {
        updateStatus('No text to send to OpenAI', 'error');
        return;
      }
      
      chrome.storage.local.get(['openaiApiKey'], function(result) {
        const apiKey = result.openaiApiKey;
        
        if (!apiKey) {
          updateStatus('Error: OpenAI API key is not set. Please set it in the Settings tab.', 'error');
          return;
        }
        
        // Show loading indicator
        showElement(loadingDiv, true);
        updateStatus('Sending to OpenAI...', '');
        
        // Send the text to OpenAI API
        sendToOpenAI(resultTextarea.value, apiKey).then(response => {
          showElement(loadingDiv, false);
          showElement(aiResponseContainer, true);
          if (aiResponseDiv) {
            aiResponseDiv.innerHTML = formatMarkdown(response);
            
            // Add some basic styling for formatted content
            aiResponseDiv.querySelectorAll('pre code').forEach(block => {
              block.style.display = 'block';
              block.style.padding = '10px';
              block.style.backgroundColor = '#45464b';
              block.style.borderRadius = '4px';
              block.style.fontFamily = 'monospace';
              block.style.overflow = 'auto';
            });
            
            // Save the AI response to storage for persistence
            chrome.storage.local.set({aiResponse: response});
          }
          updateStatus('Response received from OpenAI!', 'success');
        }).catch(error => {
          showElement(loadingDiv, false);
          updateStatus('Error from OpenAI: ' + error.message, 'error');
        });
      });
    });
  }
  
  // Listen for changes in the result textarea to enable/disable buttons
  if (resultTextarea) {
    resultTextarea.addEventListener('input', function() {
      const hasText = this.value.trim() !== '' && this.value !== 'No text extracted yet.';
      if (copyBtn) copyBtn.disabled = !hasText;
      if (clearBtn) clearBtn.disabled = !hasText;
      if (sendToOpenaiBtn) sendToOpenaiBtn.disabled = !hasText;
      
      // Save the edited text
      if (hasText) {
        chrome.storage.local.set({extractedText: this.value});
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
          chrome.storage.local.set({previewImage: croppedDataUrl});
          
          // Get selected OCR service
          chrome.storage.local.get(['ocrService', 'ocrspaceApiKey', 'serverUrl'], function(result) {
            const ocrService = result.ocrService || 'local';
            
            updateStatus(`Extracting text using ${ocrService === 'local' ? 'local server' : 'OCR.space'}...`, '');
            
            if (ocrService === 'ocrspace') {
              const apiKey = result.ocrspaceApiKey;
              
              if (!apiKey) {
                showElement(loadingDiv, false);
                updateStatus('Error: OCR.space API key is not set', 'error');
                return;
              }
              
              extractTextWithOCRSpace(croppedDataUrl, apiKey).then(handleOcrResult).catch(handleOcrError);
            } else {
              // Use the local server with the stored URL
              const serverUrl = result.serverUrl || 'http://localhost:8000';
              
              extractTextWithLocalServer(croppedDataUrl, serverUrl).then(handleOcrResult).catch(handleOcrError);
            }
          });
        } catch (error) {
          showElement(loadingDiv, false);
          console.error('Error processing image:', error);
          updateStatus('Error processing image: ' + error.message, 'error');
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
      updateStatus('Error: ' + error.message, 'error');
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
    if (sendToOpenaiBtn) sendToOpenaiBtn.disabled = text === "No text was detected in the selected area.";
    updateStatus('Text extracted successfully!', 'success');
    
    // Store the result
    chrome.storage.local.set({extractedText: text});
    
    // Clear the pending screenshot
    chrome.storage.local.remove(['pendingScreenshot']);
  }
  
  // Common handler for OCR errors
  function handleOcrError(error) {
    showElement(loadingDiv, false);
    console.error('Text extraction error:', error);
    updateStatus('Error during text extraction: ' + error.message, 'error');
    if (resultTextarea) resultTextarea.value = 'Error during text extraction. Please try again.';
  }
  
  // Updated: Extract text using local server with configurable server URL
  function extractTextWithLocalServer(imageData, serverUrl) {
    console.log('Using local server at:', serverUrl);
    
    // Use the server URL as provided without modifying it
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
  
  // Send text to OpenAI API
  function sendToOpenAI(text, apiKey) {
    // The OpenAI API endpoint
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    return fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-2024-07-18',
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
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Popup received message:', request.action);
    
    if (request.action === 'processScreenshot') {
      // Retrieve the pending screenshot from storage
      chrome.storage.local.get(['pendingScreenshot'], function(result) {
        if (result.pendingScreenshot) {
          processScreenshot(result.pendingScreenshot);
        }
      });
    }
    
    return true;
  });
  
  function formatMarkdown(text) {
    if (!text) return '';
    
    // Sanitize the input to prevent XSS
    const sanitized = text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Convert markdown to HTML
    let formatted = sanitized
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
});