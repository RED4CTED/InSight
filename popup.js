/**
 * Popup.js - Screenshot OCR and AI Analysis Extension
 * A browser extension that captures screenshots, performs OCR, and analyzes text with AI.
 */

// ==========================================
// STORAGE MODULE - Cross-browser storage handling
// ==========================================
const StorageManager = {
  /**
   * Detects if we're running in Firefox
   * @returns {boolean} True if Firefox, false if Chrome/other
   */
  isFirefox: function() {
    return typeof browser !== 'undefined';
  },
  
  /**
   * Gets the browser API object
   * @returns {object} The browser API object (browser or chrome)
   */
  getBrowserAPI: function() {
    return this.isFirefox() ? browser : chrome;
  },
  
  /**
   * Get items from storage
   * @param {string[]} keys - Array of keys to retrieve
   * @returns {Promise<object>} - Promise resolving to object with retrieved values
   */
  get: function(keys) {
    const browserAPI = this.getBrowserAPI();
    
    return new Promise((resolve, reject) => {
      if (this.isFirefox()) {
        browserAPI.storage.local.get(keys).then(resolve).catch(reject);
      } else {
        browserAPI.storage.local.get(keys, (result) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      }
    });
  },
  
  /**
   * Set items in storage
   * @param {object} data - Object containing key-value pairs to store
   * @returns {Promise<void>} - Promise resolving when data is stored
   */
  set: function(data) {
    const browserAPI = this.getBrowserAPI();
    
    return new Promise((resolve, reject) => {
      if (this.isFirefox()) {
        browserAPI.storage.local.set(data).then(resolve).catch(reject);
      } else {
        browserAPI.storage.local.set(data, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      }
    });
  },
  
  /**
   * Remove items from storage
   * @param {string[]} keys - Array of keys to remove
   * @returns {Promise<void>} - Promise resolving when data is removed
   */
  remove: function(keys) {
    const browserAPI = this.getBrowserAPI();
    
    return new Promise((resolve, reject) => {
      if (this.isFirefox()) {
        browserAPI.storage.local.remove(keys).then(resolve).catch(reject);
      } else {
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
};

// ==========================================
// FORMAT UTILS - Text formatting utilities
// ==========================================
// FormatUtils module using proper libraries
const FormatUtils = {
  // Track if libraries are loaded
  librariesLoaded: {
    marked: false,
    katex: false
  },

  /**
   * Load required libraries
   * @returns {Promise} Promise that resolves when libraries are loaded
   */
  loadLibraries: function() {
    // Only load libraries once
    if (this.librariesLoaded.marked && this.librariesLoaded.katex) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // Get URLs for extension resources
      const markedUrl = chrome.runtime.getURL('libs/marked.min.js');
      const katexJsUrl = chrome.runtime.getURL('libs/katex.min.js');
      const katexCssUrl = chrome.runtime.getURL('libs/katex.min.css');

      // Helper function to load scripts
      const loadScript = (url) => {
        return new Promise((resolveScript, rejectScript) => {
          const script = document.createElement('script');
          script.src = url;
          script.onload = resolveScript;
          script.onerror = rejectScript;
          document.head.appendChild(script);
        });
      };

      // Load CSS
      const loadCSS = (url) => {
        return new Promise((resolveCSS) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          link.onload = resolveCSS;
          document.head.appendChild(link);
        });
      };

      // Load all resources in parallel
      Promise.all([
        loadScript(markedUrl).then(() => {
          this.librariesLoaded.marked = true;
          // Configure marked options
          marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            sanitize: false
          });
        }),
        loadScript(katexJsUrl).then(() => {
          this.librariesLoaded.katex = true;
        }),
        loadCSS(katexCssUrl)
      ])
      .then(resolve)
      .catch(reject);
    });
  },

  /**
   * Format markdown text to HTML with LaTeX support
   * @param {string} text - Markdown text
   * @returns {Promise<string>} - Promise resolving to HTML formatted text
   */
  formatMarkdown: async function(text) {
    if (!text) return '';
    
    // Clean system messages first
    const cleanedText = this.cleanSystemMessages(text);
    
    try {
      // Load libraries if needed
      await this.loadLibraries();
      
      // Pre-process: Extract and save code blocks to prevent interference with math
      const codeBlocks = [];
      const processedText = cleanedText.replace(/```[\s\S]*?```|`[\s\S]*?`/g, (match) => {
        const id = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(match);
        return id;
      });
      
      // Process LaTeX expressions
      let mathProcessed = this.renderMathExpressions(processedText);
      
      // Restore code blocks
      codeBlocks.forEach((block, index) => {
        mathProcessed = mathProcessed.replace(`__CODE_BLOCK_${index}__`, block);
      });
      
      // Process Markdown using marked
      const htmlContent = marked.parse(mathProcessed);
      
      return htmlContent;
    } catch (error) {
      console.error('Error formatting markdown:', error);
      // Fallback to basic rendering if libraries fail to load
      return `<p>${cleanedText}</p>`;
    }
  },
  
  /**
   * Render LaTeX expressions using KaTeX
   * @param {string} text - Text with LaTeX expressions
   * @returns {string} - Text with rendered LaTeX
   */
  renderMathExpressions: function(text) {
    if (!window.katex) {
      console.error('KaTeX library not loaded');
      return text;
    }
    
    let processed = text;
    
    // Process display math: $$ ... $$ or \[ ... \]
    processed = processed.replace(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g, (match, g1, g2) => {
      const formula = g1 || g2;
      try {
        return katex.renderToString(formula, { displayMode: true });
      } catch (e) {
        console.error('Error rendering display math:', e);
        return `<div class="math-display-error">\$\$${formula}\$\$</div>`;
      }
    });
    
    // Process inline math: $ ... $ or \( ... \)
    processed = processed.replace(/\$([^\$\n]+?)\$|\\\(([\s\S]*?)\\\)/g, (match, g1, g2) => {
      const formula = g1 || g2;
      
      // Skip currency symbols like $50
      if (/^\s*\d+/.test(formula)) return match; 
      
      try {
        return katex.renderToString(formula, { displayMode: false });
      } catch (e) {
        console.error('Error rendering inline math:', e);
        return `<span class="math-inline-error">\$${formula}\$</span>`;
      }
    });
    
    return processed;
  },

  /**
   * Clean system messages from text
   * @param {string} text - Text to clean
   * @returns {string} - Cleaned text
   */
  cleanSystemMessages: function(text) {
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
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }
};

// Export the FormatUtils module if needed
if (typeof module !== 'undefined') {
  module.exports = FormatUtils;
}

// ==========================================
// UI MODULE - User interface management
// ==========================================
const UIManager = {
  elements: {}, // Will store references to DOM elements
  
  /**
   * Clear and reinitialize all element references to ensure latest DOM state
   */
  resetElements: function() {
    this.elements = {};
    this.initElements();
  },
  
  /**
   * Initialize UI elements and capture DOM references
   */
  initElements: function() {
    console.log('Initializing UI elements');
    // Common elements
    this.elements.statusDiv = document.getElementById('status');
    this.elements.loadingDiv = document.getElementById('loading');
    
    // Tab elements
    this.elements.tabButtons = document.querySelectorAll('.tab-button');
    this.elements.tabPanes = document.querySelectorAll('.tab-pane');
    
    // OCR tab elements
    this.elements.captureBtn = document.getElementById('captureBtn');
    this.elements.copyBtn = document.getElementById('copyBtn');
    this.elements.clearBtn = document.getElementById('clearBtn');
    this.elements.resultTextarea = document.getElementById('result');
    this.elements.previewContainer = document.getElementById('preview-container');
    this.elements.uploadFileBtn = document.getElementById('uploadFileBtn'); // Updated ID
    this.elements.imageFileInput = document.getElementById('imageFileInput');
    this.elements.sendToAiTabBtn = document.getElementById('sendToAiTabBtn');
    this.elements.downloadPdfBtn = document.getElementById('downloadPdfBtn'); // New button
    
    // AI tab elements
    this.elements.aiPrompt = document.getElementById('aiPrompt');
    this.elements.appendExtractedTextBtn = document.getElementById('appendExtractedTextBtn');
    this.elements.uploadAiFileBtn = document.getElementById('uploadAiFileBtn'); // Updated ID
    this.elements.aiImageFileInput = document.getElementById('aiImageFileInput');
    this.elements.captureAiScreenshotBtn = document.getElementById('captureAiScreenshotBtn');
    this.elements.useOcrImageBtn = document.getElementById('useOcrImageBtn');
    this.elements.aiPreviewContainer = document.getElementById('ai-preview-container');
    this.elements.removeAiImageBtn = document.getElementById('removeAiImageBtn');
    this.elements.aiLoading = document.getElementById('ai-loading');
    this.elements.sendToAiBtn = document.getElementById('sendToAiBtn');
    this.elements.aiResponseContainer = document.getElementById('ai-response-container');
    this.elements.aiResponseDiv = document.getElementById('ai-response');
    this.elements.copyAiResponseBtn = document.getElementById('copyAiResponseBtn');
    this.elements.clearAiBtn = document.getElementById('clearAiBtn');
    
    // Settings tab elements
    this.elements.interfaceModeRadios = document.querySelectorAll('input[name="interfaceMode"]');
    this.elements.saveInterfaceModeBtn = document.getElementById('saveInterfaceModeBtn');
    this.elements.ocrServiceRadios = document.querySelectorAll('input[name="ocrService"]');
    this.elements.apiKeyContainer = document.getElementById('apiKeyContainer');
    this.elements.apiKeyInput = document.getElementById('apiKeyInput');
    this.elements.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    this.elements.customOcrContainer = document.getElementById('customOcrContainer');
    this.elements.customOcrUrlInput = document.getElementById('customOcrUrlInput');
    this.elements.customOcrHeaderKeyInput = document.getElementById('customOcrHeaderKeyInput');
    this.elements.customOcrHeaderValueInput = document.getElementById('customOcrHeaderValueInput');
    this.elements.addOcrHeaderBtn = document.getElementById('addOcrHeaderBtn');
    this.elements.customOcrHeadersList = document.getElementById('customOcrHeadersList');
    this.elements.customOcrImageFormatRadios = document.querySelectorAll('input[name="customOcrImageFormat"]');
    this.elements.customOcrParamNameInput = document.getElementById('customOcrParamNameInput');
    this.elements.customOcrResponsePathInput = document.getElementById('customOcrResponsePathInput');
    this.elements.saveCustomOcrBtn = document.getElementById('saveCustomOcrBtn');
    this.elements.testCustomOcrBtn = document.getElementById('testCustomOcrBtn');
    this.elements.aiServiceRadios = document.querySelectorAll('input[name="aiService"]');
    this.elements.openaiContainer = document.getElementById('openaiContainer');
    this.elements.openaiApiKeyInput = document.getElementById('openaiApiKeyInput');
    this.elements.openaiModelSelect = document.getElementById('openaiModelSelect');
    this.elements.saveOpenaiApiKeyBtn = document.getElementById('saveOpenaiApiKeyBtn');
    this.elements.customOcrFileFormatRadios = document.querySelectorAll('input[name="customOcrFileFormat"]');
    this.elements.customOcrPdfSupportCheckbox = document.getElementById('customOcrPdfSupportCheckbox');
    this.elements.customOcrResponseTypeRadios = document.querySelectorAll('input[name="customOcrResponseType"]');
    
    
    this.elements.customAiContainer = document.getElementById('customAiContainer');
    this.elements.customAiUrlInput = document.getElementById('customAiUrlInput');
    this.elements.customAiHeaderKeyInput = document.getElementById('customAiHeaderKeyInput');
    this.elements.customAiHeaderValueInput = document.getElementById('customAiHeaderValueInput');
    this.elements.addAiHeaderBtn = document.getElementById('addAiHeaderBtn');
    this.elements.customAiHeadersList = document.getElementById('customAiHeadersList');
    this.elements.customAiBodyTemplateInput = document.getElementById('customAiBodyTemplateInput');
    this.elements.customAiResponsePathInput = document.getElementById('customAiResponsePathInput');
    this.elements.saveCustomAiBtn = document.getElementById('saveCustomAiBtn');
    this.elements.testCustomAiBtn = document.getElementById('testCustomAiBtn');
    
    if (this.elements.loadingDiv) {
      this.elements.loadingDiv.classList.add('hidden');
    }
    
    if (this.elements.aiLoading) {
      this.elements.aiLoading.classList.add('hidden');
    }
    
    if (this.elements.resultTextarea) {
      const defaultText = 'No text extracted yet.';
      if (this.elements.resultTextarea.value.trim() === '') {
        this.elements.resultTextarea.value = defaultText;
      }
      
      // Disable buttons if no text or default text
      if (this.elements.copyBtn) {
        this.elements.copyBtn.disabled = this.elements.resultTextarea.value === defaultText;
      }
      
      if (this.elements.clearBtn) {
        this.elements.clearBtn.disabled = this.elements.resultTextarea.value === defaultText;
      }
      
      if (this.elements.sendToAiTabBtn) {
        this.elements.sendToAiTabBtn.disabled = this.elements.resultTextarea.value === defaultText;
      }
    }

    console.log('UI elements initialized');
  },
  
  /**
   * Show or hide an element
   * @param {HTMLElement} element - The element to show/hide
   * @param {boolean} visible - Whether to show (true) or hide (false) the element
   */
  showElement: function(element, visible) {
    if (!element) return;
    
    if (visible) {
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  },
  
  /**
   * Update status message with appropriate styling
   * @param {string} message - The message to display
   * @param {string} type - The type of message ('error', 'success', or '')
   */
  updateStatus: function(message, type = '') {
    const { statusDiv } = this.elements;
    if (!statusDiv) return;
    
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
  },
  
  /**
   * Show a preview image in the OCR tab
   * @param {string} dataUrl - The data URL of the image to preview
   */
  showPreviewImage: function(dataUrl) {
    const { previewContainer } = this.elements;
    if (!previewContainer) return;
    
    // Clear any existing preview
    previewContainer.innerHTML = '';
    
    // Create and add new preview image
    const previewImg = document.createElement('img');
    previewImg.src = dataUrl;
    previewImg.id = 'preview-img';
    previewContainer.appendChild(previewImg);
    
    // Show the container
    this.showElement(previewContainer, true);
  },
  
  /**
   * Show a preview image in the AI tab
   * @param {string} dataUrl - The data URL of the image to preview
   */
  showAiPreviewImage: function(dataUrl) {
    const { aiPreviewContainer, removeAiImageBtn } = this.elements;
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
    if (removeAiImageBtn) {
      aiPreviewContainer.appendChild(removeAiImageBtn);
    }
    
    // Show the container
    this.showElement(aiPreviewContainer, true);
  },
  
  /**
   * Add a header to a headers list
   * @param {HTMLElement} container - The container to add the header to
   * @param {string} key - The header key
   * @param {string} value - The header value
   */
  addHeaderToList: function(container, key, value) {
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
  },
  
  /**
   * Get all headers from a header list
   * @param {HTMLElement} container - The container with headers
   * @returns {object} - Object with header key-value pairs
   */
  getHeadersFromList: function(container) {
    const headers = {};
    if (!container) return headers;
    
    const headerItems = container.querySelectorAll('.header-item');
    headerItems.forEach(item => {
      const name = item.querySelector('.header-name').textContent.replace(':', '').trim();
      const value = item.querySelector('.header-value').textContent.trim();
      headers[name] = value;
    });
    
    return headers;
  },
  
  /**
   * Populate a headers list from stored headers
   * @param {HTMLElement} container - The container to populate
   * @param {object} headers - The headers to add
   */
  populateHeadersList: function(container, headers) {
    if (!container) return;
    
    // Clear existing headers
    container.innerHTML = '';
    
    // Add each header
    if (headers && typeof headers === 'object') {
      Object.keys(headers).forEach(key => {
        this.addHeaderToList(container, key, headers[key]);
      });
    }
  },
  
  /**
   * Update OCR UI based on selected service
   * @param {string} service - The selected OCR service ('ocrspace', or 'custom')
   */
  updateOcrUi: function(service) {
    const { apiKeyContainer, customOcrContainer } = this.elements;
    this.showElement(apiKeyContainer, service === 'ocrspace');
    this.showElement(customOcrContainer, service === 'custom');
  },
  
  /**
   * Update AI UI based on selected service
   * @param {string} service - The selected AI service ('openai' or 'custom')
   */
  updateAiUi: function(service) {
    const { openaiContainer, customAiContainer } = this.elements;
    this.showElement(openaiContainer, service === 'openai');
    this.showElement(customAiContainer, service === 'custom');
  },
  
  /**
   * Initialize tab switching functionality
   * @param {Function} onTabSwitch - Callback to run when tabs are switched
   */
  initTabSwitching: function(onTabSwitch) {
    console.log('Initializing tab switching');
    const { tabButtons, tabPanes } = this.elements;
    
    if (!tabButtons || tabButtons.length === 0) {
      console.error('Tab buttons not found');
      return;
    }
    
    if (!tabPanes || tabPanes.length === 0) {
      console.error('Tab panes not found');
      return;
    }
    
    console.log('Found tab buttons:', tabButtons.length);
    console.log('Found tab panes:', tabPanes.length);
    
    // Log the initial active tab
    const initialActiveTab = document.querySelector('.tab-button.active');
    console.log('Initial active tab:', initialActiveTab ? initialActiveTab.getAttribute('data-tab') : 'none');
    
    tabButtons.forEach((button, index) => {
      console.log(`Setting up tab button ${index}:`, button.getAttribute('data-tab'));
      
      button.addEventListener('click', function(event) {
        // Get the tab to show
        const tabId = this.getAttribute('data-tab');
        console.log(`Tab button clicked: ${tabId}`);
        
        // Update active state on buttons
        tabButtons.forEach(btn => {
          btn.classList.remove('active');
          console.log(`Removed active class from tab: ${btn.getAttribute('data-tab')}`);
        });
        
        this.classList.add('active');
        console.log(`Added active class to tab: ${tabId}`);
        
        // Hide all panes and show the selected one
        tabPanes.forEach(pane => {
          pane.classList.remove('active');
          console.log(`Removed active class from pane: ${pane.id}`);
        });
        
        const targetPane = document.getElementById(`${tabId}-tab`);
        if (targetPane) {
          targetPane.classList.add('active');
          console.log(`Added active class to pane: ${targetPane.id}`);
        } else {
          console.error(`Could not find tab pane with id: ${tabId}-tab`);
        }
        
        // Run the callback if provided
        if (typeof onTabSwitch === 'function') {
          console.log(`Running tab switch callback for tab: ${tabId}`);
          onTabSwitch(tabId);
        }
      });
    });
    
    console.log('Tab switching initialized');
  },
  
  /**
   * Configure the popup for operation inside an iframe
   * @param {object} handlers - Object containing handlers for iframe-specific events
   */
  configureForIframe: function(handlers) {
    const { captureBtn, captureAiScreenshotBtn } = this.elements;
    const { onCapture, onAiCapture, onMessage } = handlers;
    
    console.log('Running in iframe - modifying capture button behavior');
    
    // Override the default capture button click handler
    if (captureBtn) {
      captureBtn.addEventListener('click', function(event) {
        // Prevent the default handler from being triggered
        event.stopImmediatePropagation();
        
        if (typeof onCapture === 'function') {
          onCapture();
        }
        
        // Disable the button briefly to prevent double-clicks
        captureBtn.disabled = true;
        setTimeout(() => { captureBtn.disabled = false; }, 1000);
      }, true); // true for capture phase to ensure this runs first
    }
    
    // Similarly, modify AI screenshot button if it exists
    if (captureAiScreenshotBtn) {
      captureAiScreenshotBtn.addEventListener('click', function(event) {
        event.stopImmediatePropagation();
        
        if (typeof onAiCapture === 'function') {
          onAiCapture();
        }
        
        captureAiScreenshotBtn.disabled = true;
        setTimeout(() => { captureAiScreenshotBtn.disabled = false; }, 1000);
      }, true);
    }
    
    // Set up listener for messages from parent window
    if (typeof onMessage === 'function') {
      window.addEventListener('message', onMessage);
    }
  },
  
  /**
   * Set up resize observer to notify parent window of size changes
   */
  setupResizeObserver: function() {
    const contentContainer = document.querySelector('.container');
    
    if (contentContainer) {
      // Initial size notification
      this.notifyParentOfSize();
      
      // Setup observer for dynamic content changes
      const resizeObserver = new ResizeObserver(entries => {
        this.notifyParentOfSize();
      });
      
      // Start observing the container
      resizeObserver.observe(contentContainer);
      
      // Also observe when switching tabs to adjust for different content heights
      const { tabButtons } = this.elements;
      if (tabButtons) {
        tabButtons.forEach(button => {
          button.addEventListener('click', () => {
            // Wait a moment for the tab content to become visible
            setTimeout(() => this.notifyParentOfSize(), 50);
          });
        });
      }
    }
  },
  
  /**
   * Notify parent window of size changes
   */
  notifyParentOfSize: function() {
    const contentHeight = document.body.scrollHeight;
    
    // Add some padding for good measure
    const totalHeight = contentHeight + 20;
    
    // Notify the parent window about the size
    window.parent.postMessage({
      action: 'resize',
      height: totalHeight
    }, '*');
  },
  
  /**
   * Enable scrolling when in iframe mode
   */
  enableScrolling: function() {
    // Force scrolling on body
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.body.style.minHeight = '100%';
    
    // Force scrolling on container
    const container = document.querySelector('.container');
    if (container) {
      container.style.overflow = 'visible';
      container.style.height = 'auto';
      container.style.minHeight = '100%';
    }
    
    // Make sure all tab panes scroll properly
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => {
      pane.style.overflow = 'visible';
      pane.style.height = 'auto';
    });
    
    // Ensure scrollable areas have scrollbars
    const scrollableElements = document.querySelectorAll('.result, .result-editor, .prompt-editor, .headers-list, #ai-response');
    scrollableElements.forEach(el => {
      el.style.overflow = 'auto';
    });
    
    // Adjust dimensions of specific elements that might be limiting scrolling
    const resultContainer = document.querySelector('.result-container');
    if (resultContainer) {
      resultContainer.style.maxHeight = 'none';
    }
    
    // Add scroll message capability
    window.addEventListener('scroll', function() {
      // Notify parent window of scroll position
      window.parent.postMessage({
        action: 'scrollUpdate',
        scrollTop: document.documentElement.scrollTop || document.body.scrollTop
      }, '*');
    });
  }
};

// ==========================================
// OCR MODULE - Text extraction functionality
// ==========================================
const OCRManager = {
  currentOcrImage: null,
  
  /**
   * Process a screenshot
   * @param {object} data - Screenshot data
   */
  processScreenshot: function(data) {
    console.log('Processing screenshot in popup', data.area);
    UIManager.updateStatus('Cropping screenshot...', '');
    UIManager.showElement(UIManager.elements.loadingDiv, true);
    
    try {
      const img = new Image();
      img.onload = () => {
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
          UIManager.showPreviewImage(croppedDataUrl);
          
          // Store preview for future loading
          StorageManager.set({previewImage: croppedDataUrl}).catch(error => {
            console.error('Error saving preview image:', error);
          });
          
          // Get selected OCR service and process image
          this.processWithSelectedService(croppedDataUrl);
          
        } catch (error) {
          UIManager.showElement(UIManager.elements.loadingDiv, false);
          console.error('Error processing image:', error);
          UIManager.updateStatus('Error processing image: ' + (error ? error.message : 'Unknown error'), 'error');
        }
      };
      
      img.onerror = function(e) {
        UIManager.showElement(UIManager.elements.loadingDiv, false);
        console.error('Failed to load screenshot image', e);
        UIManager.updateStatus('Error loading screenshot', 'error');
      };
      
      img.src = data.dataUrl;
    } catch (error) {
      UIManager.showElement(UIManager.elements.loadingDiv, false);
      console.error('Error in processScreenshot:', error);
      UIManager.updateStatus('Error: ' + (error ? error.message : 'Unknown error'), 'error');
    }
  },
  
  /**
   * Process an uploaded image
   * @param {string} imageDataUrl - Data URL of the image
   */
  processUploadedImage: function(imageDataUrl) {
    UIManager.updateStatus('Processing image...', '');
    this.processWithSelectedService(imageDataUrl);
  },
  
  /**
   * Process image with selected OCR service
   * @param {string} imageDataUrl - Data URL of the image
   */
  processWithSelectedService: function(imageDataUrl) {
    UIManager.updateStatus('Sending OCR request to background...', '');
    UIManager.showElement(UIManager.elements.loadingDiv, true);
    
    // Clear previous OCR results from storage before starting a new request
    StorageManager.remove(['extractedText']).then(() => {
      console.log('Previous OCR results cleared');
    }).catch(error => {
      console.error('Error clearing previous OCR results:', error);
    });
    
    // Clear UI elements
    const { resultTextarea, aiResponseDiv } = UIManager.elements;
    if (resultTextarea) resultTextarea.value = 'Processing...';
    if (aiResponseDiv) aiResponseDiv.innerHTML = '';
    
    StorageManager.get(['ocrService', 'ocrspaceApiKey', 'customOcrSettings'])
      .then(result => {
        const ocrService = result.ocrService || 'customOcrSettings';
        
        // Prepare request data
        const requestData = {
          action: 'processOCR',
          service: ocrService,
          imageData: imageDataUrl
        };
        
        // Add service-specific parameters
        if (ocrService === 'ocrspace') {
          requestData.apiKey = result.ocrspaceApiKey;
        } else if (ocrService === 'custom') {
          requestData.settings = result.customOcrSettings;
        }
        
        // Send to background script
        const browserAPI = StorageManager.getBrowserAPI();
        browserAPI.runtime.sendMessage(requestData)
          .then(response => {
            if (response && response.status === 'processing') {
              UIManager.updateStatus('OCR request processing in background. You can close this popup now.', 'success');
              
              // Store the request ID
              StorageManager.set({currentOCRRequestId: response.requestId});
            } else {
              UIManager.showElement(UIManager.elements.loadingDiv, false);
              UIManager.updateStatus('Error: Unexpected response from background', 'error');
            }
          })
          .catch(error => {
            UIManager.showElement(UIManager.elements.loadingDiv, false);
            UIManager.updateStatus('Error sending OCR request: ' + error.message, 'error');
          });
      })
      .catch(error => {
        UIManager.showElement(UIManager.elements.loadingDiv, false);
        UIManager.updateStatus('Error getting OCR settings: ' + error.message, 'error');
      });
  },
  processPdfWithSelectedService: function(pdfFile) {
    UIManager.updateStatus('Sending PDF to OCR service...', '');
    UIManager.showElement(UIManager.elements.loadingDiv, true);
    
    // Clear previous OCR results from storage before starting a new request
    StorageManager.remove(['extractedText', 'processedPdf']).then(() => {
      console.log('Previous OCR results cleared');
    }).catch(error => {
      console.error('Error clearing previous OCR results:', error);
    });
    
    // Clear UI elements
    const { resultTextarea, aiResponseDiv, downloadPdfBtn } = UIManager.elements;
    if (resultTextarea) resultTextarea.value = 'Processing PDF...';
    if (aiResponseDiv) aiResponseDiv.innerHTML = '';
    UIManager.showElement(downloadPdfBtn, false);
    
    // Convert PDF to base64 first
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Data = e.target.result; // This will be a data URL
      
      StorageManager.get(['ocrService', 'ocrspaceApiKey', 'customOcrSettings'])
        .then(result => {
          const ocrService = result.ocrService || 'custom';
          
          if (ocrService !== 'custom') {
            UIManager.showElement(UIManager.elements.loadingDiv, false);
            UIManager.updateStatus('PDF processing is only supported with custom OCR API', 'error');
            return;
          }
          
          const settings = result.customOcrSettings;
          if (!settings || !settings.url) {
            UIManager.showElement(UIManager.elements.loadingDiv, false);
            UIManager.updateStatus('Custom OCR settings not configured', 'error');
            return;
          }
          
          // Ensure PDF support is enabled
          if (settings.pdfSupport !== true) {
            UIManager.showElement(UIManager.elements.loadingDiv, false);
            UIManager.updateStatus('PDF support is not enabled in settings', 'error');
            return;
          }
          
          // Prepare request data
          const requestData = {
            action: 'processPDF',
            service: 'custom',
            fileName: pdfFile.name,
            fileType: pdfFile.type, 
            fileSize: pdfFile.size,
            pdfData: base64Data, // Send PDF as base64 data
            settings: settings
          };
          
          // Send to background script
          const browserAPI = StorageManager.getBrowserAPI();
          browserAPI.runtime.sendMessage(requestData)
            .then(response => {
              if (response && response.status === 'processing') {
                UIManager.updateStatus('PDF processing in background. You can close this popup now.', 'success');
                
                // Store the request ID
                StorageManager.set({currentOCRRequestId: response.requestId});
              } else {
                UIManager.showElement(UIManager.elements.loadingDiv, false);
                UIManager.updateStatus('Error: Unexpected response from background', 'error');
              }
            })
            .catch(error => {
              UIManager.showElement(UIManager.elements.loadingDiv, false);
              UIManager.updateStatus('Error sending PDF request: ' + error.message, 'error');
            });
        })
        .catch(error => {
          UIManager.showElement(UIManager.elements.loadingDiv, false);
          UIManager.updateStatus('Error getting OCR settings: ' + error.message, 'error');
        });
    };
    
    reader.onerror = function(error) {
      UIManager.showElement(UIManager.elements.loadingDiv, false);
      UIManager.updateStatus('Error reading PDF file: ' + error, 'error');
    };
    
    // Read the PDF file as a data URL
    reader.readAsDataURL(pdfFile);
  },
  
  // Add new handler for PDF results
  handlePdfResult: function(pdfData) {
    console.log('PDF processed successfully');
    UIManager.showElement(UIManager.elements.loadingDiv, false);
    
    StorageManager.remove(['currentOCRRequestId']).catch(error => {
      console.error('Error clearing OCR request ID:', error);
    });
    
    const { resultTextarea, copyBtn, clearBtn, downloadPdfBtn, sendToAiTabBtn } = UIManager.elements;
    
    // Store the processed PDF data
    StorageManager.set({processedPdf: pdfData}).catch(error => {
      console.error('Error saving processed PDF:', error);
    });
    
    // Update UI
    if (resultTextarea) resultTextarea.value = "PDF processed successfully. You can download the searchable PDF.";
    if (copyBtn) copyBtn.disabled = true; // Can't copy PDF content
    if (clearBtn) clearBtn.disabled = false;
    if (sendToAiTabBtn) sendToAiTabBtn.disabled = true; // Can't send PDF to AI tab yet
    
    // Show the download button
    UIManager.showElement(downloadPdfBtn, true);
    
    UIManager.updateStatus('PDF processed successfully!', 'success');
    
    // Clear the pending screenshot
    StorageManager.remove(['pendingScreenshot']).catch(error => {
      console.error('Error removing pending screenshot:', error);
    });
  },
  
  // Add handler for the Download PDF button
  handleDownloadPdfClick: function() {
    StorageManager.get(['processedPdf']).then(result => {
      if (result.processedPdf) {
        // Create a Blob from the PDF data
        const pdfBlob = OCRManager.base64ToBlob(result.processedPdf, 'application/pdf');
        
        // Create a download link
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(pdfBlob);
        downloadLink.download = 'processed_document.pdf';
        
        // Append to the document, trigger click, then remove
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        UIManager.updateStatus('PDF download started!', 'success');
      } else {
        UIManager.updateStatus('No processed PDF available', 'error');
      }
    }).catch(error => {
      UIManager.updateStatus('Error downloading PDF: ' + error.message, 'error');
    });
  },
  
  // Helper function to convert base64 to Blob - defined properly as a method of OCRManager
  base64ToBlob: function(base64Data, contentType) {
    // Remove data URL prefix if present
    if (base64Data.startsWith('data:')) {
      base64Data = base64Data.split(',')[1];
    }
    
    // Convert base64 to binary
    const byteCharacters = atob(base64Data);
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
    
    return new Blob(byteArrays, {type: contentType});
  },
  /**
   * Common handler for OCR results
   * @param {string} text - Extracted text
   */
  handleOcrResult: function(text) {
    console.log('Text extracted successfully');
    UIManager.showElement(UIManager.elements.loadingDiv, false);
    
    StorageManager.remove(['currentOCRRequestId']).catch(error => {
      console.error('Error clearing OCR request ID:', error);
    });

    if (text.trim().length === 0) {
      text = "No text was detected in the selected area.";
    }
    
    const { resultTextarea, copyBtn, clearBtn, sendToAiBtn, sendToAiTabBtn } = UIManager.elements;
    
    // Update UI
    if (resultTextarea) resultTextarea.value = text;
    if (copyBtn) copyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
    if (sendToAiBtn) sendToAiBtn.disabled = text === "No text was detected in the selected area.";
    if (sendToAiTabBtn) sendToAiTabBtn.disabled = text === "No text was detected in the selected area.";
    UIManager.updateStatus('Text extracted successfully!', 'success');
    
    // Store the result
    StorageManager.set({extractedText: text}).catch(error => {
      console.error('Error saving extracted text:', error);
    });
    
    // Clear the pending screenshot
    StorageManager.remove(['pendingScreenshot']).catch(error => {
      console.error('Error removing pending screenshot:', error);
    });
    
    // Get the current preview image for the OCR image functionality
    StorageManager.get(['previewImage']).then(result => {
      if (result.previewImage) {
        this.currentOcrImage = result.previewImage;
        
        // Enable the "Use OCR Image" button in the AI tab
        const { useOcrImageBtn } = UIManager.elements;
        if (useOcrImageBtn) {
          useOcrImageBtn.disabled = false;
        }
      }
    }).catch(error => {
      console.error('Error getting preview image:', error);
    });
  },
  
  /**
   * Common handler for OCR errors
   * @param {Error} error - Error object
   */
  handleOcrError: function(error) {
    UIManager.showElement(UIManager.elements.loadingDiv, false);
    StorageManager.remove(['currentOCRRequestId']).catch(error => {
      console.error('Error clearing OCR request ID:', error);
    });
    console.error('Text extraction error:', error);
    UIManager.updateStatus('Error during text extraction: ' + (error ? error.message : 'Unknown error'), 'error');
    
    const { resultTextarea } = UIManager.elements;
    if (resultTextarea) resultTextarea.value = 'Error during text extraction. Please try again.';
  },
  
  /**
   * Extract text using OCR.space API
   * @param {string} imageData - Image data URL
   * @param {string} apiKey - OCR.space API key
   * @returns {Promise<string>} - Promise resolving to extracted text
   */
  extractTextWithOCRSpace: function(imageData, apiKey) {
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
  },
  
  /**
   * Extract text using custom OCR API
   * @param {string} imageData - Image data URL
   * @param {object} settings - Custom OCR settings
   * @returns {Promise<string>} - Promise resolving to extracted text
   */
  extractTextWithCustomApi: function(imageData, settings) {
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
};

// ==========================================
// AI MODULE - AI integration functionality
// ==========================================
const AIManager = {
  currentAiImage: null,
  
  /**
   * Send text and image to OpenAI
   * @param {string} text - Text prompt
   * @param {string} imageDataUrl - Image data URL
   * @param {string} apiKey - OpenAI API key
   * @param {string} model - OpenAI model name
   * @returns {Promise<string>} - Promise resolving to AI response
   */
  sendToOpenAIWithImage: function(text, imageDataUrl, apiKey, model) {
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
  },
  
  /**
   * Send text and image to custom AI API
   * @param {string} text - Text prompt
   * @param {string} imageDataUrl - Image data URL
   * @param {object} settings - Custom AI settings
   * @returns {Promise<string>} - Promise resolving to AI response
   */
  sendToCustomAiWithImage: function(text, imageDataUrl, settings) {
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
  },
  
  /**
   * Process AI response
   * @param {string} text - AI response text
   */
  handleAiResponse: function(response) {
    StateManager.setAiLoading(false);
  
    const cleanedResponse = FormatUtils.cleanSystemMessages(response);
    UIManager.showElement(UIManager.elements.aiResponseContainer, true);
    
    // Clear the request ID
    StorageManager.remove(['currentAIRequestId']).catch(error => {
      console.error('Error clearing AI request ID:', error);
    });

    const { aiResponseDiv } = UIManager.elements;
    if (aiResponseDiv) {
      FormatUtils.formatMarkdown(cleanedResponse).then(formattedHtml => {
        aiResponseDiv.innerHTML = formattedHtml;
      });
      
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
      StorageManager.set({aiResponse: cleanedResponse}).catch(error => {
        console.error('Error saving AI response:', error);
      });
    }
    UIManager.updateStatus('Response received from AI!', 'success');
  },
  
  /**
   * Handle AI error
   * @param {Error} error - Error object
   */
  handleAiError: function(error) {
    // Set loading state to false
    StateManager.setAiLoading(false);
    UIManager.updateStatus('Error from AI: ' + (error ? error.message : 'Unknown error'), 'error');
  },
  
  /**
   * Process AI request with selected service
   * @param {string} promptText - Text prompt
   */
  processWithSelectedService: function() {
    const { aiPrompt } = UIManager.elements;
    const promptText = aiPrompt ? aiPrompt.value.trim() : '';
    
    if (!promptText && !this.currentAiImage) {
      UIManager.updateStatus('Please enter a prompt or add an image', 'error');
      return;
    }
    
    StateManager.setAiLoading(true);
    UIManager.updateStatus('Sending AI request to background...', '');
    
    // Clear previous results before starting new request
    StorageManager.remove(['aiResponse']).catch(error => {
      console.error('Error clearing previous results:', error);
    });
      
    // Clear UI elements
    const { aiResponseDiv, aiResponseContainer } = UIManager.elements;
    if (aiResponseDiv) aiResponseDiv.innerHTML = '';
    UIManager.showElement(aiResponseContainer, false);
    
    
    // Get selected AI service
    StorageManager.get(['aiService']).then(result => {
      const aiService = result.aiService || 'openai';
      
      let serviceSettings = {};
      
      // Get service-specific settings
      if (aiService === 'openai') {
        return StorageManager.get(['openaiSettings']).then(result => {
          const openaiSettings = result.openaiSettings || {};
          if (!openaiSettings.apiKey) {
            throw new Error('OpenAI API key is not set');
          }
          
          // Send request to background script
          return this.sendToBackground(aiService, promptText, {
            apiKey: openaiSettings.apiKey,
            model: openaiSettings.model || 'gpt-4o-mini-2024-07-18'
          });
        });
      } 
      else if (aiService === 'custom') {
        return StorageManager.get(['customAiSettings']).then(result => {
          const customAiSettings = result.customAiSettings;
          if (!customAiSettings || !customAiSettings.url) {
            throw new Error('Custom AI API settings are not set');
          }
          
          // Send request to background script
          return this.sendToBackground(aiService, promptText, {
            settings: customAiSettings
          });
        });
      }
      else {
        throw new Error('Unknown AI service: ' + aiService);
      }
    })
    .catch(error => {
      UIManager.showElement(UIManager.elements.aiLoading, false);
      UIManager.updateStatus('Error: ' + error.message, 'error');
    });
  },
  
  sendToBackground: function(service, text, params) {
    // Prepare request data
    const requestData = {
      action: 'processAI',
      service: service,
      text: text,
      imageData: this.currentAiImage
    };
    
    // Add service parameters
    Object.assign(requestData, params);
    
    // Send to background script
    const browserAPI = StorageManager.getBrowserAPI();
    return browserAPI.runtime.sendMessage(requestData)
      .then(response => {
        if (response && response.status === 'processing') {
          UIManager.updateStatus('AI request processing in background. You can close this popup now.', 'success');
          
          // Store the request ID
          StorageManager.set({currentAIRequestId: response.requestId});
        } else {
          UIManager.showElement(UIManager.elements.aiLoading, false);
          UIManager.updateStatus('Error: Unexpected response from background', 'error');
        }
      })
      .catch(error => {
        UIManager.showElement(UIManager.elements.aiLoading, false);
        UIManager.updateStatus('Error sending AI request: ' + error.message, 'error');
        throw error; // Propagate the error
      });
  },
  
  /**
   * Initialize AI tab functionality
   */
  initializeAiTab: function() {
    const { sendToAiBtn, appendExtractedTextBtn, useOcrImageBtn } = UIManager.elements;
    
    // Always enable the send to AI button
    if (sendToAiBtn) {
      sendToAiBtn.disabled = false;
    }
  
    // Check if we have extracted text to enable/disable the append button
    StorageManager.get(['extractedText']).then(result => {
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
    StorageManager.get(['previewImage']).then(result => {
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
  },


  setLoadingState: function(isLoading) {
    // Update UI
    if (UIManager.elements.aiLoading) {
      if (isLoading) {
        UIManager.elements.aiLoading.classList.remove('hidden');
      } else {
        UIManager.elements.aiLoading.classList.add('hidden');
      }
    }
  
  // Update storage flag
  StorageManager.set({aiLoadingActive: isLoading}).catch(error => {
    console.error('Error updating AI loading state:', error);
  });
},

// Check if there's an active AI request
checkActiveRequest: function() {
  return StorageManager.get(['currentAIRequestId', 'aiLoadingActive']).then(result => {
    const hasActiveRequest = !!result.currentAIRequestId;
    const loadingActive = !!result.aiLoadingActive;
    
    // If no active request but loading is shown, clear it
    if (!hasActiveRequest && loadingActive) {
      this.setLoadingState(false);
    }
    
    // If active request, ensure loading is shown
    if (hasActiveRequest && !loadingActive) {
      this.setLoadingState(true);
    }
    
    return hasActiveRequest;
  });
}

};

// ==========================================
// EVENT HANDLERS - Centralized event binding
// ==========================================
const EventHandlers = {
  /**
   * Initialize event handlers for the OCR tab
   */
  initOcrTabHandlers: function() {
    console.log('Initializing OCR tab handlers');
    const { 
      captureBtn, copyBtn, clearBtn, resultTextarea,
      uploadFileBtn, imageFileInput, sendToAiTabBtn, downloadPdfBtn
    } = UIManager.elements;
    
    console.log('OCR elements found:', {
      captureBtn: !!captureBtn,
      copyBtn: !!copyBtn,
      clearBtn: !!clearBtn,
      resultTextarea: !!resultTextarea,
      uploadFileBtn: !!uploadFileBtn, // Updated variable name
      imageFileInput: !!imageFileInput,
      sendToAiTabBtn: !!sendToAiTabBtn,
      downloadPdfBtn: !!downloadPdfBtn // New button
    });
    
    if (downloadPdfBtn) {
      console.log('Adding click listener to downloadPdfBtn');
      downloadPdfBtn.addEventListener('click', function(event) {
        console.log('Download PDF button clicked');
        OCRManager.handleDownloadPdfClick.call(this, event);
      });
    } else {
      console.error('downloadPdfBtn element not found');
    }

    // Capture button handler
    if (captureBtn) {
      console.log('Adding click listener to captureBtn');
      captureBtn.addEventListener('click', function(event) {
        console.log('Capture button clicked');
        EventHandlers.handleCaptureClick.call(this, event);
      });
    } else {
      console.error('captureBtn element not found');
    }
    
    // Copy button handler
    if (copyBtn) {
      console.log('Adding click listener to copyBtn');
      copyBtn.addEventListener('click', function(event) {
        console.log('Copy button clicked');
        EventHandlers.handleCopyClick.call(this, event);
      });
    } else {
      console.error('copyBtn element not found');
    }
    
    // Clear button handler
    if (clearBtn) {
      console.log('Adding click listener to clearBtn');
      clearBtn.addEventListener('click', function(event) {
        console.log('Clear button clicked');
        EventHandlers.handleClearClick.call(this, event);
      });
    } else {
      console.error('clearBtn element not found');
    }
    
    // Result textarea change handler
    if (resultTextarea) {
      console.log('Adding input listener to resultTextarea');
      resultTextarea.addEventListener('input', function(event) {
        console.log('Result textarea changed');
        EventHandlers.handleResultChange.call(this, event);
      });
    } else {
      console.error('resultTextarea element not found');
    }
    
    // Upload image button handler
    if (uploadFileBtn && imageFileInput) {
      console.log('Adding click listener to uploadFileBtn');
      uploadFileBtn.addEventListener('click', () => {
        console.log('Upload file button clicked');
        imageFileInput.click();
      });
      
      console.log('Adding change listener to imageFileInput');
      imageFileInput.addEventListener('change', function(event) {
        console.log('File selected');
        EventHandlers.handleImageUpload.call(this, event);
      });
    } else {
      console.error('uploadFileBtn or imageFileInput elements not found');
    }
    
    // Send to AI tab button handler
    if (sendToAiTabBtn) {
      console.log('Adding click listener to sendToAiTabBtn');
      sendToAiTabBtn.addEventListener('click', function(event) {
        console.log('Send to AI tab button clicked');
        EventHandlers.handleSendToAiTabClick.call(this, event);
      });
    } else {
      console.error('sendToAiTabBtn element not found');
    }
    
    console.log('OCR tab handlers initialized');
  },
  
  /**
   * Initialize event handlers for the AI tab
   */
  initAiTabHandlers: function() {
    console.log('Initializing AI tab handlers');
    const { 
      aiPrompt, appendExtractedTextBtn, uploadAiFileBtn, aiImageFileInput,
      captureAiScreenshotBtn, useOcrImageBtn, removeAiImageBtn,
      sendToAiBtn, copyAiResponseBtn, clearAiBtn
    } = UIManager.elements;
    
    console.log('AI elements found:', {
      aiPrompt: !!aiPrompt,
      appendExtractedTextBtn: !!appendExtractedTextBtn,
      uploadAiFileBtn: !!uploadAiFileBtn, // Updated variable name
      aiImageFileInput: !!aiImageFileInput,
      captureAiScreenshotBtn: !!captureAiScreenshotBtn,
      useOcrImageBtn: !!useOcrImageBtn,
      removeAiImageBtn: !!removeAiImageBtn,
      sendToAiBtn: !!sendToAiBtn,
      copyAiResponseBtn: !!copyAiResponseBtn,
      clearAiBtn: !!clearAiBtn
    });
    
    // Save AI prompt as it's typed
    if (aiPrompt) {
      console.log('Adding input listener to aiPrompt');
      aiPrompt.addEventListener('input', function() {
        console.log('AI prompt changed');
        // Save the current text to storage
        StorageManager.set({savedAiPrompt: this.value}).catch(error => {
          console.error('Error saving AI prompt:', error);
        });
      });
    } else {
      console.error('aiPrompt element not found');
    }
    
    // Append extracted text button handler
    if (appendExtractedTextBtn) {
      console.log('Adding click listener to appendExtractedTextBtn');
      appendExtractedTextBtn.addEventListener('click', function(event) {
        console.log('Append extracted text button clicked');
        EventHandlers.handleAppendExtractedTextClick.call(this, event);
      });
    } else {
      console.error('appendExtractedTextBtn element not found');
    }
    
    // Upload AI image button handler
    if (uploadAiFileBtn && aiImageFileInput) {
      console.log('Adding click listener to uploadAiFileBtn');
      uploadAiFileBtn.addEventListener('click', () => {
        console.log('Upload AI file button clicked');
        aiImageFileInput.click();
      });
      
      console.log('Adding change listener to aiImageFileInput');
      aiImageFileInput.addEventListener('change', function(event) {
        console.log('AI file selected');
        EventHandlers.handleAiImageUpload.call(this, event);
      });
    } else {
      console.error('uploadAiFileBtn or aiImageFileInput elements not found');
    }
    
    // Capture AI screenshot button handler
    if (captureAiScreenshotBtn) {
      console.log('Adding click listener to captureAiScreenshotBtn');
      captureAiScreenshotBtn.addEventListener('click', function(event) {
        console.log('Capture AI screenshot button clicked');
        EventHandlers.handleCaptureAiScreenshotClick.call(this, event);
      });
    } else {
      console.error('captureAiScreenshotBtn element not found');
    }
    
    // Use OCR image button handler
    if (useOcrImageBtn) {
      console.log('Adding click listener to useOcrImageBtn');
      useOcrImageBtn.addEventListener('click', function(event) {
        console.log('Use OCR image button clicked');
        EventHandlers.handleUseOcrImageClick.call(this, event);
      });
    } else {
      console.error('useOcrImageBtn element not found');
    }
    
    // Remove AI image button handler
    if (removeAiImageBtn) {
      console.log('Adding click listener to removeAiImageBtn');
      removeAiImageBtn.addEventListener('click', function(event) {
        console.log('Remove AI image button clicked');
        EventHandlers.handleRemoveAiImageClick.call(this, event);
      });
    } else {
      console.error('removeAiImageBtn element not found');
    }
    
    // Send to AI button handler
    if (sendToAiBtn) {
      console.log('Adding click listener to sendToAiBtn');
      sendToAiBtn.addEventListener('click', function() {
        console.log('Send to AI button clicked');
        AIManager.processWithSelectedService();
      });
    } else {
      console.error('sendToAiBtn element not found');
    }
    
    // Copy AI response button handler
    if (copyAiResponseBtn) {
      console.log('Adding click listener to copyAiResponseBtn');
      copyAiResponseBtn.addEventListener('click', function(event) {
        console.log('Copy AI response button clicked');
        EventHandlers.handleCopyAiResponseClick.call(this, event);
      });
    } else {
      console.error('copyAiResponseBtn element not found');
    }
    
    // Clear AI button handler
    if (clearAiBtn) {
      console.log('Adding click listener to clearAiBtn');
      clearAiBtn.addEventListener('click', function(event) {
        console.log('Clear AI button clicked');
        EventHandlers.handleClearAiClick.call(this, event);
      });
    } else {
      console.error('clearAiBtn element not found');
    }
    
    console.log('AI tab handlers initialized');
  },
  
  /**
   * Initialize event handlers for the Settings tab
   */
  initSettingsTabHandlers: function() {
    console.log('Initializing Settings tab handlers');
    const { 
      saveInterfaceModeBtn, ocrServiceRadios, saveApiKeyBtn,
      addOcrHeaderBtn, saveCustomOcrBtn,
      testCustomOcrBtn, aiServiceRadios, saveOpenaiApiKeyBtn,
      addAiHeaderBtn, saveCustomAiBtn,
      testCustomAiBtn
    } = UIManager.elements;
    
    console.log('Settings elements found:', {
      saveInterfaceModeBtn: !!saveInterfaceModeBtn,
      ocrServiceRadios: !!(ocrServiceRadios && ocrServiceRadios.length),
      saveApiKeyBtn: !!saveApiKeyBtn,
      addOcrHeaderBtn: !!addOcrHeaderBtn,
      saveCustomOcrBtn: !!saveCustomOcrBtn,
      testCustomOcrBtn: !!testCustomOcrBtn,
      aiServiceRadios: !!(aiServiceRadios && aiServiceRadios.length),
      saveOpenaiApiKeyBtn: !!saveOpenaiApiKeyBtn,
      addAiHeaderBtn: !!addAiHeaderBtn,
      saveCustomAiBtn: !!saveCustomAiBtn,
      testCustomAiBtn: !!testCustomAiBtn
    });
    
    // Interface mode save button handler
    if (saveInterfaceModeBtn) {
      console.log('Adding click listener to saveInterfaceModeBtn');
      saveInterfaceModeBtn.addEventListener('click', function(event) {
        console.log('Save interface mode button clicked');
        EventHandlers.handleSaveInterfaceModeClick.call(this, event);
      });
    } else {
      console.error('saveInterfaceModeBtn element not found');
    }
    
    // OCR service selection change handler
    if (ocrServiceRadios && ocrServiceRadios.length > 0) {
      console.log('Adding change listeners to ocrServiceRadios');
      ocrServiceRadios.forEach((radio, index) => {
        radio.addEventListener('change', function(event) {
          console.log(`OCR service radio [${index}] changed to: ${this.value}`);
          EventHandlers.handleOcrServiceChange.call(this, event);
        });
      });
    } else {
      console.error('ocrServiceRadios elements not found');
    }
    
    // OCR.space API key save button handler
    if (saveApiKeyBtn) {
      console.log('Adding click listener to saveApiKeyBtn');
      saveApiKeyBtn.addEventListener('click', function(event) {
        console.log('Save API key button clicked');
        EventHandlers.handleSaveOcrApiKeyClick.call(this, event);
      });
    } else {
      console.error('saveApiKeyBtn element not found');
    }
    
    // Custom OCR headers add button handler
    if (addOcrHeaderBtn) {
      console.log('Adding click listener to addOcrHeaderBtn');
      addOcrHeaderBtn.addEventListener('click', function(event) {
        console.log('Add OCR header button clicked');
        EventHandlers.handleAddOcrHeaderClick.call(this, event);
      });
    } else {
      console.error('addOcrHeaderBtn element not found');
    }
    if (document.getElementById('customOcrPdfSupportCheckbox')) {
      document.getElementById('customOcrPdfSupportCheckbox').addEventListener('change', function() {
        // If PDF support is enabled, force Form Data format
        if (this.checked) {
          const formDataRadio = document.querySelector('input[name="customOcrFileFormat"][value="formData"]');
          if (formDataRadio) {
            formDataRadio.checked = true;
            // Disable the base64 option
            const base64Radio = document.querySelector('input[name="customOcrFileFormat"][value="base64"]');
            if (base64Radio) {
              base64Radio.disabled = true;
            }
          }
        } else {
          // Re-enable the base64 option
          const base64Radio = document.querySelector('input[name="customOcrFileFormat"][value="base64"]');
          if (base64Radio) {
            base64Radio.disabled = false;
          }
        }
      });
    }
    document.querySelectorAll('input[name="customOcrFileFormat"]').forEach(radio => {
      radio.addEventListener('change', function() {
        const pdfSupportCheckbox = document.getElementById('customOcrPdfSupportCheckbox');
        if (pdfSupportCheckbox && this.value === 'base64' && pdfSupportCheckbox.checked) {
          // Prevent selecting base64 when PDF support is enabled
          const formDataRadio = document.querySelector('input[name="customOcrFileFormat"][value="formData"]');
          if (formDataRadio) {
            formDataRadio.checked = true;
            alert('Base64 format cannot be used with PDF support. Using Form Data instead.');
          }
        }
      });
    });
    document.querySelectorAll('input[name="customOcrResponseType"]').forEach(radio => {
      radio.addEventListener('change', function() {
        const responsePathInput = document.getElementById('customOcrResponsePathInput');
        if (responsePathInput) {
          // Only show response path input for JSON responses
          responsePathInput.parentElement.style.display = this.value === 'json' ? 'flex' : 'none';
        }
      });
    });
    // Custom OCR settings save button handler
    if (saveCustomOcrBtn) {
      console.log('Adding click listener to saveCustomOcrBtn');
      saveCustomOcrBtn.addEventListener('click', function(event) {
        console.log('Save custom OCR button clicked');
        EventHandlers.handleSaveCustomOcrClick.call(this, event);
      });
    } else {
      console.error('saveCustomOcrBtn element not found');
    }
    
    // Custom OCR test button handler
    if (testCustomOcrBtn) {
      console.log('Adding click listener to testCustomOcrBtn');
      testCustomOcrBtn.addEventListener('click', function(event) {
        console.log('Test custom OCR button clicked');
        EventHandlers.handleTestCustomOcrClick.call(this, event);
      });
    } else {
      console.error('testCustomOcrBtn element not found');
    }
    
    // AI service selection change handler
    if (aiServiceRadios && aiServiceRadios.length > 0) {
      console.log('Adding change listeners to aiServiceRadios');
      aiServiceRadios.forEach((radio, index) => {
        radio.addEventListener('change', function(event) {
          console.log(`AI service radio [${index}] changed to: ${this.value}`);
          EventHandlers.handleAiServiceChange.call(this, event);
        });
      });
    } else {
      console.error('aiServiceRadios elements not found');
    }
    
    // OpenAI settings save button handler
    if (saveOpenaiApiKeyBtn) {
      console.log('Adding click listener to saveOpenaiApiKeyBtn');
      saveOpenaiApiKeyBtn.addEventListener('click', function(event) {
        console.log('Save OpenAI API key button clicked');
        EventHandlers.handleSaveOpenaiApiKeyClick.call(this, event);
      });
    } else {
      console.error('saveOpenaiApiKeyBtn element not found');
    }
    
    // Custom AI headers add button handler
    if (addAiHeaderBtn) {
      console.log('Adding click listener to addAiHeaderBtn');
      addAiHeaderBtn.addEventListener('click', function(event) {
        console.log('Add AI header button clicked');
        EventHandlers.handleAddAiHeaderClick.call(this, event);
      });
    } else {
      console.error('addAiHeaderBtn element not found');
    }
    
    // Custom AI settings save button handler
    if (saveCustomAiBtn) {
      console.log('Adding click listener to saveCustomAiBtn');
      saveCustomAiBtn.addEventListener('click', function(event) {
        console.log('Save custom AI button clicked');
        EventHandlers.handleSaveCustomAiClick.call(this, event);
      });
    } else {
      console.error('saveCustomAiBtn element not found');
    }
    
    // Custom AI test button handler
    if (testCustomAiBtn) {
      console.log('Adding click listener to testCustomAiBtn');
      testCustomAiBtn.addEventListener('click', function(event) {
        console.log('Test custom AI button clicked');
        EventHandlers.handleTestCustomAiClick.call(this, event);
      });
    } else {
      console.error('testCustomAiBtn element not found');
    }
    
    console.log('Settings tab handlers initialized');
  },
  
  /**
   * Initialize runtime message listener
   */
  initRuntimeMessageListener: function() {
    const browserAPI = StorageManager.getBrowserAPI();
    
    browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      console.log('Popup received message:', request.action);
      
      if (request.action === 'processScreenshot') {
        // Check if we're capturing for AI
        StorageManager.get(['capturingForAi', 'pendingScreenshot']).then(function(result) {
          if (result.capturingForAi) {
            // We're capturing for AI
            if (result.pendingScreenshot) {
              const screenshotData = result.pendingScreenshot;
              
              // Use the screenshot for AI
              AIManager.currentAiImage = screenshotData.dataUrl;
              
              // Show preview in AI tab
              UIManager.showAiPreviewImage(screenshotData.dataUrl);
              
              // Switch to AI tab
              const aiTabButton = document.querySelector('.tab-button[data-tab="ai"]');
              if (aiTabButton) {
                aiTabButton.click();
              }
              
              // Clear the pendingScreenshot and capturingForAi flag
              StorageManager.remove(['pendingScreenshot', 'capturingForAi']).then(function() {
                UIManager.updateStatus('Screenshot captured for AI!', 'success');
              }).catch(error => {
                console.error('Error clearing pending screenshot:', error);
              });
            }
          } else {
            // Normal OCR processing
            if (result.pendingScreenshot) {
              OCRManager.processScreenshot(result.pendingScreenshot);
            }
          }
        }).catch(error => {
          console.error('Error getting pendingScreenshot:', error);
        });
      }
      
      if (request.action === 'ocrComplete') {
        OCRManager.handleOcrResult(request.result);
        sendResponse({status: 'ok'});
        return true;
      }
      
      if (request.action === 'pdfComplete') {
        OCRManager.handlePdfResult(request.pdfData);
        sendResponse({status: 'ok'});
        return true;
      }

      if (request.action === 'aiComplete') {
        AIManager.handleAiResponse(request.result);
        sendResponse({status: 'ok'});
        return true;
      }
      
      if (request.action === 'requestError') {
        UIManager.updateStatus('Error: ' + request.error, 'error');
        sendResponse({status: 'ok'});
        return true;
      }

      return true;
    });
  },
  
  // Individual event handlers
  
  /**
   * Handle capture button click
   */
  handleCaptureClick: function() {
    UIManager.updateStatus('Starting capture...', '');
    this.disabled = true;
    
    // Set the flag to ensure we know this is NOT for AI
    window.capturingForAi = false;
    
    // Set flag in storage to ensure it persists
    StorageManager.set({
      capturingForAi: false,
      lastCaptureMode: 'ocr'
    }).then(() => {
      // Continue with existing code...
    }).catch(error => {
      this.disabled = false;
      UIManager.updateStatus('Error setting capture mode: ' + error.message, 'error');
    });
    
    const { resultTextarea, copyBtn, clearBtn, sendToAiBtn, previewContainer, aiResponseContainer, aiResponseDiv } = UIManager.elements;
    
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
    UIManager.showElement(previewContainer, false);
    UIManager.showElement(aiResponseContainer, false);
    
    // Remove stored data
    StorageManager.remove(['extractedText', 'previewImage', 'aiResponse']).then(function() {
      console.log('Previous data cleared for new capture');
    }).catch(error => {
      console.error('Error clearing data:', error);
    });
    
    const browserAPI = StorageManager.getBrowserAPI();
    
    browserAPI.tabs.query({active: true, currentWindow: true}).then(function(tabs) {
      if (!tabs || tabs.length === 0) {
        UIManager.updateStatus('Error: No active tab found', 'error');
        this.disabled = false;
        return;
      }
      
      browserAPI.tabs.sendMessage(tabs[0].id, {action: 'startCapture'}).then(function(response) {
        this.disabled = false;
        
        if (response && response.status === 'ok') {
          window.close(); // Close popup to allow user to select area
        } else {
          UIManager.updateStatus('Error: Could not start capture', 'error');
        }
      }.bind(this)).catch(error => {
        this.disabled = false;
        UIManager.updateStatus('Error: ' + (error ? error.message : 'Could not communicate with page'), 'error');
      });
    }.bind(this)).catch(error => {
      this.disabled = false;
      UIManager.updateStatus('Error: ' + (error ? error.message : 'Unknown error'), 'error');
    });
  },
  
  /**
   * Handle copy button click
   */
  handleCopyClick: function() {
    const { resultTextarea } = UIManager.elements;
    const text = resultTextarea ? resultTextarea.value : '';
    
    navigator.clipboard.writeText(text).then(function() {
      UIManager.updateStatus('Copied to clipboard!', 'success');
    }, function(error) {
      UIManager.updateStatus('Failed to copy text: ' + (error ? error.message : 'Unknown error'), 'error');
    });
  },
  
  /**
   * Handle clear button click
   */
  handleClearClick: function() {
    const { resultTextarea, copyBtn, clearBtn, sendToAiBtn, sendToAiTabBtn, previewContainer, aiResponseContainer, aiResponseDiv, useOcrImageBtn, downloadPdfBtn } = UIManager.elements;
    
    // Update UI elements
    if (resultTextarea) resultTextarea.value = 'No text extracted yet.';
    if (copyBtn) copyBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    if (sendToAiBtn) sendToAiBtn.disabled = true;
    if (sendToAiTabBtn) sendToAiTabBtn.disabled = true;
    if (downloadPdfBtn) UIManager.showElement(downloadPdfBtn, false);
    
    // Hide preview containers
    UIManager.showElement(previewContainer, false);
    UIManager.showElement(aiResponseContainer, false);
    
    // Clear AI response from the DOM
    if (aiResponseDiv) {
      aiResponseDiv.innerHTML = '';
    }
    
    // Use Promise.all to ensure all storage operations complete
    Promise.all([
      // Remove stored data
      StorageManager.remove(['extractedText']),
      StorageManager.remove(['pendingScreenshot']),
      StorageManager.remove(['previewImage']),
      StorageManager.remove(['aiResponse']),
      StorageManager.remove(['processedPdf']),
      StorageManager.remove(['pdfProcessingComplete']),
      StorageManager.remove(['pdfProcessingTimestamp'])
    ]).then(() => {
      console.log('All data successfully cleared');
      UIManager.updateStatus('Cleared!', 'success');
      
      // Reset the OCR image
      OCRManager.currentOcrImage = null;
      
      // Disable the "Use OCR Image" button in the AI tab
      if (useOcrImageBtn) {
        useOcrImageBtn.disabled = true;
      }
    }).catch(error => {
      console.error('Error during clear operation:', error);
      UIManager.updateStatus('Error clearing data: ' + (error ? error.message : 'Unknown error'), 'error');
    });
  },
  
  /**
   * Handle result textarea change
   */
  handleResultChange: function() {
    const { copyBtn, clearBtn, sendToAiBtn } = UIManager.elements;
    const hasText = this.value.trim() !== '' && this.value !== 'No text extracted yet.';
    
    if (copyBtn) copyBtn.disabled = !hasText;
    if (clearBtn) clearBtn.disabled = !hasText;
    if (sendToAiBtn) sendToAiBtn.disabled = !hasText;
    
    // Save the edited text
    if (hasText) {
      StorageManager.set({extractedText: this.value}).catch(error => {
        console.error('Error saving extracted text:', error);
      });
    }
  },
  
  /**
   * Handle image upload
   */
  handleImageUpload: function() {
    if (this.files && this.files[0]) {
      const file = this.files[0];
      const fileName = file.name || '';
      const fileType = file.type || '';
      const isPdf = fileName.toLowerCase().endsWith('.pdf') || fileType === 'application/pdf';
      
      // Show loading
      UIManager.showElement(UIManager.elements.loadingDiv, true);
      
      if (isPdf) {
        UIManager.updateStatus('Processing PDF file...', '');
        
        // Hide preview container since we can't preview PDFs easily
        UIManager.showElement(UIManager.elements.previewContainer, false);
        
        // Process PDF directly with OCR
        OCRManager.processPdfWithSelectedService(file);
        return;
      }
      
      // Handle images as before
      UIManager.updateStatus('Reading uploaded image...', '');
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const imageDataUrl = e.target.result;
        
        // Show preview
        UIManager.showPreviewImage(imageDataUrl);
        
        // Store the image for future use
        StorageManager.set({previewImage: imageDataUrl}).then(function() {
          console.log('Preview image saved');
          
          // Process with OCR
          OCRManager.processUploadedImage(imageDataUrl);
        }).catch(error => {
          UIManager.showElement(UIManager.elements.loadingDiv, false);
          UIManager.updateStatus('Error saving preview image: ' + error.message, 'error');
        });
      };
      
      reader.onerror = function(e) {
        UIManager.showElement(UIManager.elements.loadingDiv, false);
        UIManager.updateStatus('Error reading image file: ' + e.target.error, 'error');
      };
      
      reader.readAsDataURL(file);
    }
  },
  
  /**
   * Handle send to AI tab button click
   */
  handleSendToAiTabClick: function() {
    const { resultTextarea, aiPrompt } = UIManager.elements;
    
    if (!resultTextarea || resultTextarea.value.trim() === '' || resultTextarea.value === 'No text extracted yet.') {
      UIManager.updateStatus('No text to send to AI tab', 'error');
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
      
      // Save to storage
      StorageManager.set({savedAiPrompt: extractedText}).catch(error => {
        console.error('Error saving AI prompt:', error);
      });
    }
    
    // Show success message
    UIManager.updateStatus('Text sent to AI tab!', 'success');
  },
  
  /**
   * Handle append extracted text button click
   */
  handleAppendExtractedTextClick: function() {
    const { aiPrompt } = UIManager.elements;
    
    StorageManager.get(['extractedText']).then(function(result) {
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
          
          // Save to storage
          StorageManager.set({savedAiPrompt: aiPrompt.value}).catch(error => {
            console.error('Error saving AI prompt:', error);
          });
          
          // Show success message
          UIManager.updateStatus('Extracted text appended to prompt!', 'success');
        }
      } else {
        UIManager.updateStatus('No extracted text available to append', 'error');
      }
    }).catch(error => {
      UIManager.updateStatus('Error getting extracted text: ' + (error ? error.message : 'Unknown error'), 'error');
    });
  },
  
  /**
   * Handle AI image upload
   */
  handleAiImageUpload: function() {
    if (this.files && this.files[0]) {
      const file = this.files[0];
      const fileName = file.name || '';
      const fileType = file.type || '';
      const isPdf = fileName.toLowerCase().endsWith('.pdf') || fileType === 'application/pdf';
      
      if (isPdf) {
        UIManager.updateStatus('PDF files are not supported for AI prompts yet.', 'error');
        return;
      }
      
      // Handle images as before
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const imageDataUrl = e.target.result;
        
        // Store the image for AI
        AIManager.currentAiImage = imageDataUrl;
        
        // Show preview
        UIManager.showAiPreviewImage(imageDataUrl);
        
        // Show success message
        UIManager.updateStatus('Image added to AI prompt!', 'success');
      };
      
      reader.onerror = function(e) {
        UIManager.updateStatus('Error reading image file: ' + e.target.error, 'error');
      };
      
      reader.readAsDataURL(file);
    }
  },
  
  /**
   * Handle capture AI screenshot button click
   */
  handleCaptureAiScreenshotClick: function() {
    UIManager.updateStatus('Starting capture for AI...', '');
    this.disabled = true;
    
    // Set the flag directly in window for content script
    window.capturingForAi = true;
    
    // Set flag in storage to ensure it persists
    StorageManager.set({
      capturingForAi: true,
      lastCaptureMode: 'ai'
    }).then(() => {
      const browserAPI = StorageManager.getBrowserAPI();
      
      browserAPI.tabs.query({active: true, currentWindow: true}).then(function(tabs) {
        if (!tabs || tabs.length === 0) {
          UIManager.updateStatus('Error: No active tab found', 'error');
          this.disabled = false;
          return;
        }
        
        browserAPI.tabs.sendMessage(tabs[0].id, {
          action: 'startCapture',
          capturingForAi: true
        }).then(function(response) {
          this.disabled = false;
          
          if (response && response.status === 'ok') {
            window.close(); // Close popup to allow user to select area
          } else {
            UIManager.updateStatus('Error: Could not start capture', 'error');
          }
        }.bind(this)).catch(error => {
          this.disabled = false;
          UIManager.updateStatus('Error: ' + (error ? error.message : 'Could not communicate with page'), 'error');
        });
      }.bind(this)).catch(error => {
        this.disabled = false;
        UIManager.updateStatus('Error: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    }).catch(error => {
      this.disabled = false;
      UIManager.updateStatus('Error setting capture mode: ' + error.message, 'error');
    });
  },
  
  /**
   * Handle use OCR image button click
   */
  handleUseOcrImageClick: function() {
    StorageManager.get(['previewImage']).then(function(result) {
      if (result.previewImage) {
        // Store the OCR image for AI
        AIManager.currentAiImage = result.previewImage;
        
        // Show preview
        UIManager.showAiPreviewImage(result.previewImage);
        
        // Show success message
        UIManager.updateStatus('OCR image added to AI prompt!', 'success');
      } else {
        UIManager.updateStatus('No OCR image available', 'error');
      }
    }).catch(error => {
      UIManager.updateStatus('Error getting OCR image: ' + (error ? error.message : 'Unknown error'), 'error');
    });
  },
  
  /**
   * Handle remove AI image button click
   */
  handleRemoveAiImageClick: function() {
    // Clear the AI image
    AIManager.currentAiImage = null;
    
    // Hide the preview
    UIManager.showElement(UIManager.elements.aiPreviewContainer, false);
    
    // Show success message
    UIManager.updateStatus('Image removed from AI prompt!', 'success');
  },
  
  /**
   * Handle copy AI response button click
   */
  handleCopyAiResponseClick: function() {
    const { aiResponseDiv } = UIManager.elements;
    
    if (aiResponseDiv) {
      // Get the text content without HTML tags
      const text = aiResponseDiv.textContent || '';
      
      navigator.clipboard.writeText(text).then(function() {
        UIManager.updateStatus('AI response copied to clipboard!', 'success');
      }, function(error) {
        UIManager.updateStatus('Failed to copy AI response: ' + (error ? error.message : 'Unknown error'), 'error');
      });
    }
  },
  
  /**
   * Handle clear AI button click
   */
  handleClearAiClick: function() {
    const { aiPrompt, aiPreviewContainer, aiResponseDiv, aiResponseContainer } = UIManager.elements;
    
    // Clear the AI prompt
    if (aiPrompt) {
      aiPrompt.value = '';
    }
    
    // Clear the AI image
    AIManager.currentAiImage = null;
    
    // Hide elements
    UIManager.showElement(aiPreviewContainer, false);
    UIManager.showElement(aiResponseContainer, false);
    
    // Clear AI response from the DOM
    if (aiResponseDiv) {
      aiResponseDiv.innerHTML = '';
    }
    
    // Force loading state to false
    StateManager.setAiLoading(false);
    
    // Remove AI response, request ID, and any other AI-related data
    Promise.all([
      StorageManager.remove(['aiResponse']),
      StorageManager.remove(['savedAiPrompt']),
      StorageManager.remove(['currentAIRequestId'])
    ]).then(() => {
      UIManager.updateStatus('AI interaction cleared!', 'success');
    }).catch(error => {
      UIManager.updateStatus('Error clearing AI data: ' + (error ? error.message : 'Unknown error'), 'error');
    });
  },
  
  /**
   * Handle save interface mode button click
   */
  handleSaveInterfaceModeClick: function() {
    // Get selected interface mode
    const selectedMode = document.querySelector('input[name="interfaceMode"]:checked');
    if (!selectedMode) {
      UIManager.updateStatus('Please select an interface mode', 'error');
      return;
    }
    
    // Get the mode value
    const newMode = selectedMode.value;
    console.log('Saving interface mode:', newMode);
    
    // Save interface mode setting
    StorageManager.set({interfaceMode: newMode}).then(function() {
      // Notify background script about the mode change
      const browserAPI = StorageManager.getBrowserAPI();
      
      try {
        browserAPI.runtime.sendMessage({
          action: 'modeChanged',
          mode: newMode
        }).then(() => {
          UIManager.updateStatus('Interface mode saved! Changes will apply next time you click the extension icon.', 'success');
        }).catch(error => {
          console.error('Error notifying background script:', error);
          // Still show success since the setting was saved
          UIManager.updateStatus('Interface mode saved! Changes will apply next time you click the extension icon.', 'success');
        });
      } catch (e) {
        console.error('Error sending mode change message:', e);
        // Still show success since the setting was saved
        UIManager.updateStatus('Interface mode saved! Changes will apply next time you click the extension icon.', 'success');
      }
    }).catch(error => {
      UIManager.updateStatus('Error saving interface mode setting: ' + error.message, 'error');
    });
  },
  
  /**
   * Handle OCR service change
   */
  handleOcrServiceChange: function() {
    const selectedService = this.value;
    
    // Save the selection to storage
    StorageManager.set({ocrService: selectedService}).catch(error => {
      console.error('Error saving OCR service:', error);
    });
    
    // Update UI based on selection
    UIManager.updateOcrUi(selectedService);
  },
  
  /**
   * Handle save OCR API key button click
   */
  handleSaveOcrApiKeyClick: function() {
    const { apiKeyInput } = UIManager.elements;
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
    
    if (apiKey) {
      // Save API key to storage
      StorageManager.set({ocrspaceApiKey: apiKey}).then(function() {
        UIManager.updateStatus('OCR.space API key saved!', 'success');
      }).catch(error => {
        UIManager.updateStatus('Error saving API key: ' + error.message, 'error');
      });
    } else {
      UIManager.updateStatus('Please enter a valid API key', 'error');
    }
  },
  
  /**
   * Handle add OCR header button click
   */
  handleAddOcrHeaderClick: function() {
    const { customOcrHeaderKeyInput, customOcrHeaderValueInput, customOcrHeadersList } = UIManager.elements;
    const key = customOcrHeaderKeyInput ? customOcrHeaderKeyInput.value.trim() : '';
    const value = customOcrHeaderValueInput ? customOcrHeaderValueInput.value.trim() : '';
    
    if (key && value) {
      UIManager.addHeaderToList(customOcrHeadersList, key, value);
      
      // Clear inputs
      if (customOcrHeaderKeyInput) customOcrHeaderKeyInput.value = '';
      if (customOcrHeaderValueInput) customOcrHeaderValueInput.value = '';
    } else {
      UIManager.updateStatus('Please enter both header name and value', 'error');
    }
  },
  
  /**
   * Handle save custom OCR button click
   */
  handleSaveCustomOcrClick: function() {
    const { 
      customOcrUrlInput, customOcrParamNameInput, customOcrResponsePathInput,
      customOcrFileFormatRadios, customOcrHeadersList, customOcrPdfSupportCheckbox,
      customOcrResponseTypeRadios
    } = UIManager.elements;
    
    const url = customOcrUrlInput ? customOcrUrlInput.value.trim() : '';
    
    // Basic URL validation
    if (!url) {
      UIManager.updateStatus('Please enter a valid API URL', 'error');
      return;
    }
    
    // Check if URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      UIManager.updateStatus('URL must start with http:// or https://', 'error');
      return;
    }
    
    // Get selected image format
    const fileFormatRadio = document.querySelector('input[name="customOcrFileFormat"]:checked');
    const fileFormat = fileFormatRadio ? fileFormatRadio.value : 'base64';
    
    // Get PDF support setting
    const pdfSupport = customOcrPdfSupportCheckbox ? customOcrPdfSupportCheckbox.checked : false;
    
    // If PDF support is enabled, ensure form data is selected
    if (pdfSupport && fileFormat !== 'formData') {
      UIManager.updateStatus('PDF support requires Form Data format', 'error');
      return;
    }
    
    // Get response type
    const responseTypeRadio = document.querySelector('input[name="customOcrResponseType"]:checked');
    const responseType = responseTypeRadio ? responseTypeRadio.value : 'json';
    
    // Get param name
    const paramName = customOcrParamNameInput ? customOcrParamNameInput.value.trim() : '';
    if (!paramName) {
      UIManager.updateStatus('Please enter a parameter name for the file data', 'error');
      return;
    }
    
    // Get response path (only required for JSON responses)
    const responsePath = customOcrResponsePathInput ? customOcrResponsePathInput.value.trim() : '';
    if (responseType === 'json' && !responsePath) {
      UIManager.updateStatus('Please enter a response path to extract text', 'error');
      return;
    }
    
    // Get headers
    const headers = UIManager.getHeadersFromList(customOcrHeadersList);
    
    // Save custom OCR settings
    const customOcrSettings = {
      url,
      fileFormat,
      paramName,
      responsePath,
      responseType,
      pdfSupport,
      headers
    };
    
    StorageManager.set({customOcrSettings}).then(function() {
      UIManager.updateStatus('Custom OCR settings saved!', 'success');
    }).catch(error => {
      UIManager.updateStatus('Error saving custom OCR settings: ' + error.message, 'error');
    });
  },
  
  /**
   * Handle test custom OCR button click
   */
  handleTestCustomOcrClick: function() {
    const { 
      customOcrUrlInput, customOcrParamNameInput, customOcrResponsePathInput,
      customOcrImageFormatRadios, customOcrHeadersList
    } = UIManager.elements;
    
    UIManager.updateStatus('Testing custom OCR API...', '');
    
    // Get current settings
    const url = customOcrUrlInput ? customOcrUrlInput.value.trim() : '';
    const imageFormatRadio = document.querySelector('input[name="customOcrImageFormat"]:checked');
    const imageFormat = imageFormatRadio ? imageFormatRadio.value : 'base64';
    const paramName = customOcrParamNameInput ? customOcrParamNameInput.value.trim() : '';
    const responsePath = customOcrResponsePathInput ? customOcrResponsePathInput.value.trim() : '';
    const headers = UIManager.getHeadersFromList(customOcrHeadersList);
    
    // Validate settings
    if (!url || !paramName || !responsePath) {
      UIManager.updateStatus('Please fill in all required fields', 'error');
      return;
    }
    
    // Check if we have a test image
    StorageManager.get(['previewImage']).then(function(result) {
      if (result.previewImage) {
        // Test with the current preview image
        const customOcrSettings = {
          url,
          fileFormat,
          paramName,
          responsePath,
          headers
        };
        
        OCRManager.extractTextWithCustomApi(result.previewImage, customOcrSettings)
          .then(text => {
            UIManager.updateStatus('Test successful! Result: ' + (text.length > 50 ? text.substring(0, 50) + '...' : text), 'success');
          })
          .catch(error => {
            UIManager.updateStatus('Test failed: ' + error.message, 'error');
          });
      } else {
        UIManager.updateStatus('No test image available. Please capture a screenshot first.', 'error');
      }
    }).catch(error => {
      UIManager.updateStatus('Error getting test image: ' + error.message, 'error');
    });
  },
  
  /**
   * Handle AI service change
   */
  handleAiServiceChange: function() {
    const selectedService = this.value;
    
    // Save the selection to storage
    StorageManager.set({aiService: selectedService}).catch(error => {
      console.error('Error saving AI service:', error);
    });
    
    // Update UI based on selection
    UIManager.updateAiUi(selectedService);
  },
  
  /**
   * Handle save OpenAI API key button click
   */
  handleSaveOpenaiApiKeyClick: function() {
    const { openaiApiKeyInput, openaiModelSelect } = UIManager.elements;
    const apiKey = openaiApiKeyInput ? openaiApiKeyInput.value.trim() : '';
    const model = openaiModelSelect ? openaiModelSelect.value : '';
    
    if (!apiKey) {
      UIManager.updateStatus('Please enter a valid API key', 'error');
      return;
    }
    
    // Save OpenAI settings
    const openaiSettings = {
      apiKey,
      model
    };
    
    StorageManager.set({openaiSettings}).then(function() {
      UIManager.updateStatus('OpenAI settings saved!', 'success');
    }).catch(error => {
      UIManager.updateStatus('Error saving OpenAI settings: ' + error.message, 'error');
    });
  },
  
  /**
   * Handle add AI header button click
   */
  handleAddAiHeaderClick: function() {
    const { customAiHeaderKeyInput, customAiHeaderValueInput, customAiHeadersList } = UIManager.elements;
    const key = customAiHeaderKeyInput ? customAiHeaderKeyInput.value.trim() : '';
    const value = customAiHeaderValueInput ? customAiHeaderValueInput.value.trim() : '';
    
    if (key && value) {
      UIManager.addHeaderToList(customAiHeadersList, key, value);
      
      // Clear inputs
      if (customAiHeaderKeyInput) customAiHeaderKeyInput.value = '';
      if (customAiHeaderValueInput) customAiHeaderValueInput.value = '';
    } else {
      UIManager.updateStatus('Please enter both header name and value', 'error');
    }
  },
  
  /**
   * Handle save custom AI button click
   */
  handleSaveCustomAiClick: function() {
    const { 
      customAiUrlInput, customAiBodyTemplateInput, customAiResponsePathInput,
      customAiHeadersList
    } = UIManager.elements;
    
    const url = customAiUrlInput ? customAiUrlInput.value.trim() : '';
    
    // Basic URL validation
    if (!url) {
      UIManager.updateStatus('Please enter a valid API URL', 'error');
      return;
    }
    
    // Check if URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      UIManager.updateStatus('URL must start with http:// or https://', 'error');
      return;
    }
    
    // Get body template
    const bodyTemplate = customAiBodyTemplateInput ? customAiBodyTemplateInput.value.trim() : '';
    if (!bodyTemplate) {
      UIManager.updateStatus('Please enter a request body template', 'error');
      return;
    }
    
    // Validate body template
    if (!bodyTemplate.includes('{{text}}')) {
      UIManager.updateStatus('Body template must include {{text}} placeholder', 'error');
      return;
    }
    
    // Get response path
    const responsePath = customAiResponsePathInput ? customAiResponsePathInput.value.trim() : '';
    if (!responsePath) {
      UIManager.updateStatus('Please enter a response path to extract text', 'error');
      return;
    }
    
    // Get headers
    const headers = UIManager.getHeadersFromList(customAiHeadersList);
    
    // Save custom AI settings
    const customAiSettings = {
      url,
      bodyTemplate,
      responsePath,
      headers
    };
    
    StorageManager.set({customAiSettings}).then(function() {
      UIManager.updateStatus('Custom AI settings saved!', 'success');
    }).catch(error => {
      UIManager.updateStatus('Error saving custom AI settings: ' + error.message, 'error');
    });
  },
  
  /**
   * Handle test custom AI button click
   */
  handleTestCustomAiClick: function() {
    const { 
      customAiUrlInput, customAiBodyTemplateInput, customAiResponsePathInput,
      customAiHeadersList
    } = UIManager.elements;
    
    UIManager.updateStatus('Testing custom AI API...', '');
    
    // Get current settings
    const url = customAiUrlInput ? customAiUrlInput.value.trim() : '';
    const bodyTemplate = customAiBodyTemplateInput ? customAiBodyTemplateInput.value.trim() : '';
    const responsePath = customAiResponsePathInput ? customAiResponsePathInput.value.trim() : '';
    const headers = UIManager.getHeadersFromList(customAiHeadersList);
    
    // Validate settings
    if (!url || !bodyTemplate || !responsePath) {
      UIManager.updateStatus('Please fill in all required fields', 'error');
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
    
    AIManager.sendToCustomAiWithImage(testMessage, null, customAiSettings)
      .then(response => {
        UIManager.updateStatus('Test successful! Response: ' + (response.length > 50 ? response.substring(0, 50) + '...' : response), 'success');
      })
      .catch(error => {
        UIManager.updateStatus('Test failed: ' + error.message, 'error');
      });
  }
};

// Function to check for pending screenshots and process them
function checkPendingScreenshot() {
  StorageManager.get(['pendingScreenshot', 'capturingForAi', 'lastCaptureMode', 'screenshotIntent']).then(function(result) {
    if (result.pendingScreenshot) {
      // Determine if this screenshot is for AI based on multiple potential flags
      const isForAi = result.capturingForAi === true || 
                      result.lastCaptureMode === 'ai' ||
                      (result.screenshotIntent && result.screenshotIntent.isForAi);
      
      console.log('Processing pending screenshot, isForAi:', isForAi);
      
      // First, crop the screenshot regardless of where it will be used
      UIManager.updateStatus('Cropping screenshot...', '');
      
      // Load the image to crop it
      const img = new Image();
      img.onload = () => {
        console.log('Screenshot loaded, dimensions:', img.width, 'x', img.height);
        
        try {
          // Create canvas for cropping
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate proper crop coordinates based on zoom and scroll
          const area = result.pendingScreenshot.area;
          
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
          
          // Show preview image in appropriate tab based on intent
          if (isForAi) {
            console.log('This screenshot is for AI processing');
            
            // Switch to AI tab before processing
            const aiTabButton = document.querySelector('.tab-button[data-tab="ai"]');
            if (aiTabButton) {
              console.log('Switching to AI tab');
              aiTabButton.click();
              
              // Short delay to ensure tab switch completes
              setTimeout(() => {
                // Use the CROPPED screenshot for AI
                AIManager.currentAiImage = croppedDataUrl;
                
                // Show preview in AI tab
                UIManager.showAiPreviewImage(croppedDataUrl);
                
                // Clear all the flags and data we no longer need
                StorageManager.remove(['pendingScreenshot', 'capturingForAi', 'lastCaptureMode', 'screenshotIntent']).then(function() {
                  UIManager.updateStatus('Screenshot captured for AI!', 'success');
                }).catch(error => {
                  console.error('Error clearing pending screenshot:', error);
                });
              }, 100);
            } else {
              console.error('Could not find AI tab button');
            }
          } else {
            console.log('This screenshot is for OCR processing');
            // Regular OCR processing
            UIManager.showPreviewImage(croppedDataUrl);
            
            // Store preview for future loading
            StorageManager.set({previewImage: croppedDataUrl}).catch(error => {
              console.error('Error saving preview image:', error);
            });
            
            // Process with OCR
            OCRManager.processWithSelectedService(croppedDataUrl);
          }
          
        } catch (error) {
          UIManager.showElement(UIManager.elements.loadingDiv, false);
          console.error('Error processing image:', error);
          UIManager.updateStatus('Error processing image: ' + (error ? error.message : 'Unknown error'), 'error');
        }
      };
      
      img.onerror = function(e) {
        UIManager.showElement(UIManager.elements.loadingDiv, false);
        console.error('Failed to load screenshot image', e);
        UIManager.updateStatus('Error loading screenshot', 'error');
      };
      
      img.src = result.pendingScreenshot.dataUrl;
    }
  }).catch(error => {
    console.error('Error checking for pending screenshot:', error);
  });
}

// Function to load and restore saved settings
function loadSettings() {
  console.log('Loading saved settings');
  
  // Load interface mode
  StorageManager.get(['interfaceMode']).then(function(result) {
    const interfaceMode = result.interfaceMode || 'popup'; // Default to popup mode
    
    // Set the radio button
    const interfaceModeRadio = document.querySelector(`input[name="interfaceMode"][value="${interfaceMode}"]`);
    if (interfaceModeRadio) {
      interfaceModeRadio.checked = true;
    }
  }).catch(error => {
    console.error('Error loading interface mode setting:', error);
  });
  
  // Load AI prompt if saved
  const { aiPrompt } = UIManager.elements;
  if (aiPrompt) {
    StorageManager.get(['savedAiPrompt']).then(function(result) {
      if (result.savedAiPrompt) {
        aiPrompt.value = result.savedAiPrompt;
      }
    }).catch(error => {
      console.error('Error loading saved AI prompt:', error);
    });
  }
  
  // Load OCR and AI settings
  StorageManager.get([
    'ocrService', 
    'ocrspaceApiKey', 
    'customOcrSettings',
    'aiService',
    'openaiSettings',
    'customAiSettings'
  ]).then(function(result) {
    // Set default OCR service if not saved
    const ocrService = result.ocrService || 'customOcrSettings';
    
    // Set the OCR radio button if it exists
    const ocrRadioToCheck = document.querySelector(`input[name="ocrService"][value="${ocrService}"]`);
    if (ocrRadioToCheck) {
      ocrRadioToCheck.checked = true;
    }
    
    // Update OCR UI based on selected service
    UIManager.updateOcrUi(ocrService);
    
    // Set default AI service if not saved
    const aiService = result.aiService || 'openai';
    
    // Set the AI radio button if it exists
    const aiRadioToCheck = document.querySelector(`input[name="aiService"][value="${aiService}"]`);
    if (aiRadioToCheck) {
      aiRadioToCheck.checked = true;
    }
    
    // Update AI UI based on selected service
    UIManager.updateAiUi(aiService);
    
    // Set OCR.space API key if saved
    if (result.ocrspaceApiKey && UIManager.elements.apiKeyInput) {
      UIManager.elements.apiKeyInput.value = result.ocrspaceApiKey;
    }
    
    // Load custom OCR settings if saved
    if (result.customOcrSettings && UIManager.elements.customOcrUrlInput) {
  const customOcr = result.customOcrSettings;
  
  UIManager.elements.customOcrUrlInput.value = customOcr.url || '';
  UIManager.elements.customOcrParamNameInput.value = customOcr.paramName || '';
  UIManager.elements.customOcrResponsePathInput.value = customOcr.responsePath || '';
  
  // Set file format radio
  const formatRadio = document.querySelector(`input[name="customOcrFileFormat"][value="${customOcr.fileFormat || 'base64'}"]`);
  if (formatRadio) formatRadio.checked = true;
  
  // Set PDF support checkbox
  if (UIManager.elements.customOcrPdfSupportCheckbox) {
    UIManager.elements.customOcrPdfSupportCheckbox.checked = customOcr.pdfSupport === true;
    
    // If PDF support is enabled, disable base64 option
    if (customOcr.pdfSupport === true) {
      const base64Radio = document.querySelector('input[name="customOcrFileFormat"][value="base64"]');
      if (base64Radio) {
        base64Radio.disabled = true;
      }
    }
  }
  
  // Set response type radio
  const responseTypeRadio = document.querySelector(`input[name="customOcrResponseType"][value="${customOcr.responseType || 'json'}"]`);
  if (responseTypeRadio) responseTypeRadio.checked = true;
  
  // Show/hide response path input based on response type
  const responsePathInput = document.getElementById('customOcrResponsePathInput');
  if (responsePathInput) {
    responsePathInput.parentElement.style.display = (customOcr.responseType || 'json') === 'json' ? 'flex' : 'none';
  }
  
  // Populate headers list
  UIManager.populateHeadersList(UIManager.elements.customOcrHeadersList, customOcr.headers);
}
    
    // Load OpenAI settings if saved
    if (result.openaiSettings && UIManager.elements.openaiApiKeyInput) {
      const openai = result.openaiSettings;
      
      UIManager.elements.openaiApiKeyInput.value = openai.apiKey || '';
      
      // Set model if saved and exists in dropdown
      if (openai.model && UIManager.elements.openaiModelSelect) {
        const option = UIManager.elements.openaiModelSelect.querySelector(`option[value="${openai.model}"]`);
        if (option) {
          UIManager.elements.openaiModelSelect.value = openai.model;
        }
      }
    }
    
    // Load custom AI settings if saved
    if (result.customAiSettings && UIManager.elements.customAiUrlInput) {
      const customAi = result.customAiSettings;
      
      UIManager.elements.customAiUrlInput.value = customAi.url || '';
      UIManager.elements.customAiBodyTemplateInput.value = customAi.bodyTemplate || '';
      UIManager.elements.customAiResponsePathInput.value = customAi.responsePath || '';
      
      // Populate headers list
      UIManager.populateHeadersList(UIManager.elements.customAiHeadersList, customAi.headers);
    }
  }).catch(error => {
    console.error('Error loading settings:', error);
  });
  
  // Load any existing results from storage
  StorageManager.get(['extractedText', 'aiResponse']).then(function(result) {
  const { resultTextarea, copyBtn, clearBtn, sendToAiBtn, sendToAiTabBtn } = UIManager.elements;
  
  // Handle extracted text
  if (result.extractedText && 
      result.extractedText !== 'No text extracted yet.' && 
      result.extractedText.trim() !== '' && 
      resultTextarea) {
    
    resultTextarea.value = result.extractedText;
    if (copyBtn) copyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
    if (sendToAiBtn) sendToAiBtn.disabled = false;
    if (sendToAiTabBtn) sendToAiTabBtn.disabled = false;
    
    // Also check for a saved preview image
    StorageManager.get(['previewImage']).then(function(result) {
      if (result.previewImage) {
        UIManager.showPreviewImage(result.previewImage);
      }
    }).catch(error => {
      console.error('Error loading preview image:', error);
    });
  } else {
    // Ensure default state if no valid text
    if (resultTextarea) resultTextarea.value = 'No text extracted yet.';
    if (copyBtn) copyBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    if (sendToAiBtn) sendToAiBtn.disabled = true;
    if (sendToAiTabBtn) sendToAiTabBtn.disabled = true;
  }
    
    // Handle AI response if it exists
    const { aiResponseDiv, aiResponseContainer } = UIManager.elements;
    if (result.aiResponse && aiResponseDiv) {
      FormatUtils.formatMarkdown(result.aiResponse).then(formattedHtml => {
        aiResponseDiv.innerHTML = formattedHtml;
      });
      UIManager.showElement(aiResponseContainer, true);
      
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
}
function checkForCompletedPdfProcessing() {
  console.log('Checking for completed PDF processing');
  
  StorageManager.get(['pdfProcessingComplete', 'processedPdf', 'extractedText']).then(result => {
    const pdfProcessingComplete = result.pdfProcessingComplete === true;
    const hasProcessedPdf = !!result.processedPdf;
    
    console.log('PDF processing complete:', pdfProcessingComplete);
    console.log('Has processed PDF:', hasProcessedPdf);
    
    if (pdfProcessingComplete && hasProcessedPdf) {
      console.log('Found completed PDF processing');
      
      // Update UI to show PDF download option
      const { resultTextarea, copyBtn, clearBtn, downloadPdfBtn, sendToAiTabBtn } = UIManager.elements;
      
      // Update textarea with the status message
      if (resultTextarea) {
        resultTextarea.value = result.extractedText || "PDF processed successfully. You can download the searchable PDF.";
      }
      
      // Show the download button
      UIManager.showElement(downloadPdfBtn, true);
      
      // Update button states
      if (copyBtn) copyBtn.disabled = true; // Can't copy PDF content
      if (clearBtn) clearBtn.disabled = false;
      if (sendToAiTabBtn) sendToAiTabBtn.disabled = true; // Can't send PDF to AI tab yet
      
      UIManager.updateStatus('PDF processing has completed!', 'success');
    }
  }).catch(error => {
    console.error('Error checking for PDF processing:', error);
  });
}
function cleanupStorage() {
  console.log('Running storage cleanup');
  
  StorageManager.get(null).then(allData => {
    const now = Date.now();
    const keysToRemove = [];
    
    // Look for stale request IDs (older than 5 minutes)
    Object.keys(allData).forEach(key => {
      if (key.startsWith('request_') && allData[key].timestamp) {
        if (now - allData[key].timestamp > 5 * 60 * 1000) {
          keysToRemove.push(key);
        }
      }
    });
    
    // If we have requests to remove, clear them and related data
    if (keysToRemove.length > 0) {
      console.log('Removing stale data:', keysToRemove);
      
      // Also look for any related loading states
      if (keysToRemove.some(k => k.includes('_ai_'))) {
        StateManager.setAiLoading(false);
      }
      if (keysToRemove.some(k => k.includes('_ocr_'))) {
        StateManager.setOcrLoading(false);
      }
      
      // Remove the keys
      StorageManager.remove(keysToRemove).catch(error => {
        console.error('Error removing stale data:', error);
      });
    }
  }).catch(error => {
    console.error('Error during storage cleanup:', error);
  });
}

/**
 * Main initialization function - The entry point for popup modules
 * This is called by the script-loader.js when everything is ready
 */
function initializePopup() {
  console.log('Starting popup initialization');
  // Force hide loading indicators at startup
  UIManager.initElements();
  console.log('UI elements initialized');
  
  StorageManager.get([StateManager.keys.LAST_RESET]).then(result => {
    const lastReset = result[StateManager.keys.LAST_RESET] || 0;
    const now = Date.now();
    
    // If more than 30 seconds since last reset, do a full reset
    if (now - lastReset > 30000) {
      console.log('More than 30 seconds since last reset, performing full reset');
      StateManager.resetAllStates();
    } else {
      // Otherwise, just apply current states
      StateManager.applyCurrentStates();
    }
  }).catch(error => {
    console.error('Error checking state reset time:', error);
    // On error, do a full reset to be safe
    StateManager.resetAllStates();
  });

  // Force hide AI loading indicator immediately 
  if (UIManager.elements.loadingDiv) {
    UIManager.elements.loadingDiv.classList.add('hidden');
  }
  if (UIManager.elements.aiLoading) {
    UIManager.elements.aiLoading.classList.add('hidden');
  }
  
  Promise.all([
    OCRManager.checkActiveRequest && OCRManager.checkActiveRequest(),
    AIManager.checkActiveRequest()
  ]).catch(error => {
    console.error('Error checking active requests:', error);
  });

  // Clear any stale loading flags
  StorageManager.remove(['aiLoading']).catch(error => {
    console.error('Error clearing aiLoading flag:', error);
  });
  UIManager.showElement(UIManager.elements.loadingDiv, false);
  UIManager.showElement(UIManager.elements.aiLoading, false);
  
  // Check for active processes
  StorageManager.get(['currentOCRRequestId', 'currentAIRequestId']).then(result => {
    // Only show loading if there's an actual active request
    const hasActiveOcrRequest = !!result.currentOCRRequestId;
    const hasActiveAiRequest = !!result.currentAIRequestId;
    
    // Update loading indicators based on actual active requests
    UIManager.showElement(UIManager.elements.loadingDiv, hasActiveOcrRequest);
    UIManager.showElement(UIManager.elements.aiLoading, hasActiveAiRequest);
    
    // If no active requests, remove any stale request IDs
    if (!hasActiveOcrRequest && !hasActiveAiRequest) {
      StorageManager.remove(['currentOCRRequestId', 'currentAIRequestId']).catch(error => {
        console.error('Error clearing stale request IDs:', error);
      });
    }
  }).catch(error => {
    console.error('Error checking active requests:', error);
  });

  StorageManager.get(['screenshotIntent']).then(result => {
    const intent = result.screenshotIntent;
    
    if (intent && (Date.now() - intent.timestamp < 60000)) { // Valid if less than 1 minute old
      console.log('Found screenshot intent:', intent.isForAi ? 'AI' : 'OCR');
      
      // If screenshot was for AI, ensure we're on AI tab
      if (intent.isForAi) {
        console.log('Switching to AI tab because of screenshot intent');
        // Find and click the AI tab button
        const aiTabButton = document.querySelector('.tab-button[data-tab="ai"]');
        if (aiTabButton) {
          // Use setTimeout to ensure this happens after tab initialization
          setTimeout(() => {
            console.log('Clicking AI tab button');
            aiTabButton.click();
          }, 50);
        }
      }
      
      // Clear the intent
      StorageManager.remove(['screenshotIntent']).catch(err => {
        console.error('Error clearing screenshot intent:', err);
      });
    }
  }).catch(err => {
    console.error('Error checking screenshot intent:', err);
  });

  // Check if we're in an iframe
  const isInIframe = window !== window.top;
  console.log('Running in iframe:', isInIframe);
  
  // Verify key DOM elements exist
  const criticalElements = {
    container: document.querySelector('.container'),
    tabButtons: document.querySelectorAll('.tab-button'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    ocrTab: document.getElementById('ocr-tab'),
    aiTab: document.getElementById('ai-tab'),
    settingsTab: document.getElementById('settings-tab'),
    statusDiv: document.getElementById('status')
  };
  
  // Log which critical elements were found or missing
  for (const [key, element] of Object.entries(criticalElements)) {
    if (element === null || (element instanceof NodeList && element.length === 0)) {
      console.error(`Critical element not found: ${key}`);
    } else if (element instanceof NodeList) {
      console.log(`Found ${element.length} ${key}`);
    } else {
      console.log(`Found ${key}`);
    }
  }
  
  // Initialize UI elements first
  UIManager.initElements();
  console.log('UI elements initialized');
  
  // Initialize tab switching
  UIManager.initTabSwitching(function(tabId) {
    console.log('Tab switched to:', tabId);
    // Special handling when switching to AI tab
    if (tabId === 'ai') {
      AIManager.initializeAiTab();
    }
  });
  console.log('Tab switching initialized');
  
  // Load settings and initialize UI
  loadSettings();
  console.log('Settings loaded');
  
  // Initializing event handlers
  console.log('Initializing event handlers...');
  // Ensure all DOM elements are available by resetting references
  UIManager.resetElements();
  
  // Initialize all event handlers
  EventHandlers.initOcrTabHandlers();
  EventHandlers.initAiTabHandlers();
  EventHandlers.initSettingsTabHandlers();
  EventHandlers.initRuntimeMessageListener();
  
  // Manually bind tab switching as a fallback
  const tabButtons = document.querySelectorAll('.tab-button');
  console.log('Direct query for tab buttons found:', tabButtons.length);
  if (tabButtons && tabButtons.length > 0) {
    tabButtons.forEach((button, index) => {
      const tabId = button.getAttribute('data-tab');
      console.log(`Setting direct click handler for tab ${index}: ${tabId}`);
      
      // Use a direct event handler as fallback
      button.onclick = function() {
        console.log(`Tab ${tabId} clicked directly`);
        
        // Remove active class from all buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
          btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        this.classList.add('active');
        
        // Hide all tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.remove('active');
        });
        
        // Show the selected tab pane
        const targetPane = document.getElementById(`${tabId}-tab`);
        if (targetPane) {
          targetPane.classList.add('active');
        }
      };
    });
  }
  
  function checkPendingResults() {
    console.log('Checking for pending results...');
    const browserAPI = StorageManager.getBrowserAPI();
    
    browserAPI.runtime.sendMessage({action: 'checkPendingResults'})
      .then(response => {
        console.log('Received response:', response);
        
        if (response) {
          if (response.status === 'processing') {
            // Show appropriate loading indicator
            if (response.type === 'ocr') {
              UIManager.updateStatus('OCR request is still processing in background...', '');
              UIManager.showElement(UIManager.elements.loadingDiv, true);
            } else if (response.type === 'ai') {
              UIManager.updateStatus('AI request is still processing in background...', '');
              UIManager.showElement(UIManager.elements.aiLoading, true);
            }
          }
          else if (response.status === 'ocrComplete') {
            UIManager.updateStatus('Processing completed while popup was closed!', 'success');
            OCRManager.handleOcrResult(response.result);
            
            // Acknowledge the result
            browserAPI.runtime.sendMessage({
              action: 'acknowledgeResult',
              requestId: response.requestId
            });
          } 
          else if (response.status === 'pdfComplete') {
            UIManager.updateStatus('PDF processing completed while popup was closed!', 'success');
            OCRManager.handlePdfResult(response.pdfData);
            
            // Acknowledge the result
            browserAPI.runtime.sendMessage({
              action: 'acknowledgeResult',
              requestId: response.requestId
            });
          }
          else if (response.status === 'aiComplete') {
            UIManager.updateStatus('AI processing completed while popup was closed!', 'success');
            AIManager.handleAiResponse(response.result);
            
            // Acknowledge the result
            browserAPI.runtime.sendMessage({
              action: 'acknowledgeResult',
              requestId: response.requestId
            });
          } 
          else if (response.status === 'error') {
            UIManager.updateStatus('Error: ' + response.error, 'error');
            
            // Acknowledge the error
            browserAPI.runtime.sendMessage({
              action: 'acknowledgeResult',
              requestId: response.requestId
            });
          }
        }
      })
      .catch(error => {
        console.error('Error checking pending results:', error);
      });
  }

  // Configure for iframe mode if needed
  if (isInIframe) {
    UIManager.configureForIframe({
      onCapture: function() {
        UIManager.updateStatus('Starting capture...', '');
        window.parent.postMessage({
          action: 'startCapture'
        }, '*');
      },
      onAiCapture: function() {
        UIManager.updateStatus('Starting capture for AI...', '');
        window.parent.postMessage({
          action: 'startAiCapture'
        }, '*');
      },
      onMessage: function(event) {
        console.log('Iframe received message:', event.data);
        
        // Handle screenshot processing
        if (event.data.action === 'processScreenshot') {
          console.log('Iframe processing screenshot');
          OCRManager.processScreenshot(event.data.data);
        }
      }
    });
    
    // Setup resize observer
    UIManager.setupResizeObserver();
    
    // Enable scrolling
    UIManager.enableScrolling();
  }
  
  // Check if we have a pending screenshot to process
  checkPendingScreenshot();
  checkPendingResults();
  checkForCompletedPdfProcessing();
  console.log('Popup initialization complete');
}

// Make globally accessible
window.initializePopupModules = function() {
  // Call the main initialization function
  try {
    initializePopup();
  } catch (error) {
    console.error('Error during popup initialization:', error);
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.textContent = 'An error occurred during initialization. Check console for details.';
      statusDiv.style.color = 'red';
    }
  }
  cleanupStorage();
};

const StateManager = {
  // Keys for storage
  keys: {
    AI_LOADING: 'ai_loading_state',
    OCR_LOADING: 'ocr_loading_state',
    LAST_RESET: 'state_last_reset'
  },
  
  // Reset all temporary states
  resetAllStates: function() {
    console.log('Resetting all extension states');
    
    // Store reset timestamp
    const resetData = {
      [this.keys.AI_LOADING]: false,
      [this.keys.OCR_LOADING]: false,
      [this.keys.LAST_RESET]: Date.now()
    };
    
    // Clear loading UI immediately
    if (UIManager.elements.aiLoading) {
      UIManager.elements.aiLoading.classList.add('hidden');
    }
    if (UIManager.elements.loadingDiv) {
      UIManager.elements.loadingDiv.classList.add('hidden');
    }
    
    return StorageManager.set(resetData);
  },
  
  // Set AI loading state
  setAiLoading: function(isLoading) {
    console.log('Setting AI loading state:', isLoading);
    
    // Update UI
    if (UIManager.elements.aiLoading) {
      if (isLoading) {
        UIManager.elements.aiLoading.classList.remove('hidden');
      } else {
        UIManager.elements.aiLoading.classList.add('hidden');
      }
    }
    
    // Update storage
    return StorageManager.set({
      [this.keys.AI_LOADING]: isLoading
    });
  },
  
  // Check current states and apply them
  applyCurrentStates: function() {
    console.log('Applying current states');
    
    return StorageManager.get([
      this.keys.AI_LOADING, 
      this.keys.OCR_LOADING,
      'currentAIRequestId',
      'currentOCRRequestId'
    ]).then(result => {
      // Check if there's an active AI request
      const hasAiRequest = !!result.currentAIRequestId;
      const aiLoadingState = !!result[this.keys.AI_LOADING];
      
      // Only show loading if there's an actual active request
      if (UIManager.elements.aiLoading) {
        if (hasAiRequest && aiLoadingState) {
          UIManager.elements.aiLoading.classList.remove('hidden');
        } else {
          UIManager.elements.aiLoading.classList.add('hidden');
          
          // If loading state is on but no request, fix it
          if (aiLoadingState && !hasAiRequest) {
            this.setAiLoading(false);
          }
        }
      }
      
      // Similar logic for OCR loading
      const hasOcrRequest = !!result.currentOCRRequestId;
      const ocrLoadingState = !!result[this.keys.OCR_LOADING];
      
      if (UIManager.elements.loadingDiv) {
        if (hasOcrRequest && ocrLoadingState) {
          UIManager.elements.loadingDiv.classList.remove('hidden');
        } else {
          UIManager.elements.loadingDiv.classList.add('hidden');
          
          // If loading state is on but no request, fix it
          if (ocrLoadingState && !hasOcrRequest) {
            this.setOcrLoading(false);
          }
        }
      }
    });
  },
  
  // Set OCR loading state
  setOcrLoading: function(isLoading) {
    console.log('Setting OCR loading state:', isLoading);
    
    // Update UI
    if (UIManager.elements.loadingDiv) {
      if (isLoading) {
        UIManager.elements.loadingDiv.classList.remove('hidden');
      } else {
        UIManager.elements.loadingDiv.classList.add('hidden');
      }
    }
    
    // Update storage
    return StorageManager.set({
      [this.keys.OCR_LOADING]: isLoading
    });
  }
};

// Log that script has fully loaded
console.log('Popup.js script fully loaded');