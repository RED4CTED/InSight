// High-performance panel implementation with Firefox compatibility
// Final version with all fixes applied

function injectInsightPanel() {
    // First remove any existing panel
    removeExistingPanel();
    
    // Determine which browser API to use
    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
    
    // Create root container
    const panel = document.createElement('div');
    panel.id = 'insight-extension-frame';
    panel.className = 'insight-panel';
    
    // Apply critical CSS directly (no iframe overhead)
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 480px;
      height: 80vh;
      z-index: 2147483647;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.2);
      background-color: #f9f9fa;
      border: 1px solid rgba(0,0,0,0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      user-select: none;
      will-change: transform;
      transition: box-shadow 0.2s ease;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.className = 'insight-panel-header';
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: linear-gradient(to right, #1a73e8, #8ab4f8);
      color: white;
      cursor: move;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      user-select: none;
      height: 48px;
      box-sizing: border-box;
      flex-shrink: 0;
    `;
    
    // Add title
    const title = document.createElement('h1');
    title.textContent = 'InSight';
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    `;
    header.appendChild(title);
    
    // Add collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.innerHTML = '▼';
    collapseBtn.title = 'Collapse panel';
    collapseBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 14px;
      cursor: pointer;
      padding: 0 8px;
      line-height: 1;
      margin-right: 8px;
      height: 24px;
      width: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    `;
    header.appendChild(collapseBtn);
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close panel';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0 8px;
      line-height: 1;
      height: 24px;
      width: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    `;
    header.appendChild(closeBtn);
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'insight-panel-content';
    contentContainer.style.cssText = `
      flex: 1;
      overflow: hidden;
      background-color: #f9f9fa;
      position: relative;
      display: flex;
      flex-direction: column;
    `;
    
    // Create an iframe just for the extension UI content
    const iframe = document.createElement('iframe');
    iframe.src = browserAPI.runtime.getURL('popup.html'); // Use browserAPI for Firefox compatibility
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      flex: 1;
    `;
    contentContainer.appendChild(iframe);
    
    // Add resize handle - IMPROVED: make it larger for better usability
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'insight-panel-resize';
    resizeHandle.style.cssText = `
      position: absolute;
      right: 0;
      bottom: 0;
      width: 30px; /* Larger size */
      height: 30px; /* Larger size */
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, rgba(180, 180, 180, 0.5) 50%);
      border-bottom-right-radius: 16px;
      z-index: 1;
    `;
    
    // Create a resize overlay that will cover the entire viewport during resize
    const resizeOverlay = document.createElement('div');
    resizeOverlay.className = 'insight-resize-overlay';
    resizeOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483646; /* Just below the panel */
      display: none;
      cursor: nwse-resize;
    `;
    
    // Assemble the panel
    panel.appendChild(header);
    panel.appendChild(contentContainer);
    panel.appendChild(resizeHandle);
    
    // Add to document body
    try {
      if (document.body) {
        document.body.appendChild(panel);
        document.body.appendChild(resizeOverlay); // Add the overlay to the body
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          document.body.appendChild(panel);
          document.body.appendChild(resizeOverlay);
        });
      }
    } catch (e) {
      console.error('Error appending panel:', e);
      return "Failed to inject panel: " + e.message;
    }
    
    // Store reference
    window._insightPanel = panel;
    window._insightResizeOverlay = resizeOverlay;
    
    // Dragging functionality - high performance implementation
    let isDragging = false;
    let isResizing = false;
    
    // Toggle panel collapse
    let isCollapsed = false;
    function toggleCollapse() {
      isCollapsed = !isCollapsed;
      
      if (isCollapsed) {
        contentContainer.style.display = 'none';
        collapseBtn.innerHTML = '▲';
        collapseBtn.title = 'Expand panel';
        panel.style.height = '48px';
      } else {
        contentContainer.style.display = 'flex';
        collapseBtn.innerHTML = '▼';
        collapseBtn.title = 'Collapse panel';
        panel.style.height = '80vh';
      }
      
      // Save collapsed state - Firefox compatible
      try {
        browserAPI.storage.local.set({panelCollapsed: isCollapsed})
          .catch(e => console.error('Error saving collapse state:', e));
      } catch (e) {
        console.error('Error saving collapse state:', e);
      }
    }
    
    // Event listeners
    collapseBtn.addEventListener('click', toggleCollapse);
    
    closeBtn.addEventListener('click', function() {
      removeExistingPanel();
      try {
        browserAPI.runtime.sendMessage({action: 'closePanel'});
      } catch (e) {
        console.error('Error sending close message:', e);
      }
    });
    
    // Firefox-compatible drag handling
    header.addEventListener('mousedown', function(e) {
      // Don't start drag when clicking buttons
      if (e.target === collapseBtn || e.target === closeBtn) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      isDragging = true;
      
      // Calculate offset based on mouse position relative to panel
      const rect = panel.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      
      // Visual feedback
      panel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
      
      function mouseMoveHandler(e) {
        if (!isDragging) return;
        
        // Calculate position directly based on mouse and offset
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        
        // Apply boundaries
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        
        // Apply directly to position properties for smoother behavior
        panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        panel.style.right = 'auto'; // Clear right position
        
        e.preventDefault();
      }
      
      function mouseUpHandler() {
        if (!isDragging) return;
        
        isDragging = false;
        
        // Restore normal appearance
        panel.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)';
        
        // Remove event listeners
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
      }
      
      // Add event listeners - simpler for Firefox compatibility
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    });
    
    // Firefox-compatible resize functionality
    resizeHandle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      isResizing = true;
      
      // Get initial values
      const startWidth = panel.offsetWidth;
      const startHeight = panel.offsetHeight;
      const startX = e.clientX;
      const startY = e.clientY;
      
      // Show the resize overlay to catch all mouse events
      resizeOverlay.style.display = 'block';
      
      function mouseMoveHandler(e) {
        if (!isResizing) return;
        
        // Calculate new dimensions
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // Update with constraints
        const newWidth = Math.max(320, Math.min(startWidth + deltaX, window.innerWidth * 0.9));
        const newHeight = Math.max(48, Math.min(startHeight + deltaY, window.innerHeight * 0.9));
        
        // Apply new size
        panel.style.width = newWidth + 'px';
        panel.style.height = newHeight + 'px';
        
        e.preventDefault();
      }
      
      function mouseUpHandler() {
        if (!isResizing) return;
        
        isResizing = false;
        
        // Hide the resize overlay
        resizeOverlay.style.display = 'none';
        
        // Remove event listeners
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
      }
      
      // Add event listeners - simpler for Firefox compatibility
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    });
    
    // Also attach resize events to the overlay using standard event listeners
    resizeOverlay.addEventListener('mousemove', function(e) {
      if (!isResizing) return;
      
      // For Firefox compatibility, manually call the handlers
      // rather than trying to dispatch synthetic events
      const handlers = getEventListeners(document, 'mousemove');
      for (let i = 0; handlers && i < handlers.length; i++) {
        if (handlers[i].useCapture === false) {
          handlers[i].listener(e);
        }
      }
    });
    
    resizeOverlay.addEventListener('mouseup', function(e) {
      if (!isResizing) return;
      
      // For Firefox compatibility, manually call the handlers
      const handlers = getEventListeners(document, 'mouseup');
      for (let i = 0; handlers && i < handlers.length; i++) {
        if (handlers[i].useCapture === false) {
          handlers[i].listener(e);
        }
      }
    });
    
    // Helper function to safely get event listeners (Chrome DevTools API)
    // Fallback to empty array if not supported (Firefox)
    function getEventListeners(element, eventName) {
      if (window.getEventListeners) {
        return window.getEventListeners(element, eventName) || [];
      }
      return [];
    }
    
    // Check for saved collapsed state - Firefox compatible
    try {
      browserAPI.storage.local.get(['panelCollapsed'], function(result) {
        if (result.panelCollapsed) {
          isCollapsed = true;
          toggleCollapse();
        }
      });
    } catch (e) {
      console.error('Error loading collapse state:', e);
    }
    
    // Handle messages from the iframe
    window.addEventListener('message', function(event) {
      try {
        // Check if message is from our iframe
        if (event.source !== iframe.contentWindow) return;
        
        const message = event.data;
        
        // Handle capture screenshot requests
        if (message.action === 'startCapture') {
          // Hide panel temporarily during capture
          panel.style.display = 'none';
          resizeOverlay.style.display = 'none'; // Also hide overlay if visible
          
          // Use the appropriate method to start capture
          if (typeof startCapture === 'function') {
            startCapture();
          } else {
            browserAPI.tabs.query({active: true, currentWindow: true}, function(tabs) {
              if (tabs && tabs.length > 0) {
                browserAPI.tabs.sendMessage(tabs[0].id, {action: 'startCapture'});
              }
            });
          }
        }
        
        // Handle AI capture screenshot
        if (message.action === 'startAiCapture') {
          // Hide panel temporarily during capture
          panel.style.display = 'none';
          resizeOverlay.style.display = 'none'; // Also hide overlay if visible
          
          // Set flag for AI capture in local storage - Firefox compatible
          try {
            browserAPI.storage.local.set({capturingForAi: true}).then(function() {
              // Then start capture
              if (typeof startCapture === 'function') {
                startCapture();
              } else {
                browserAPI.tabs.query({active: true, currentWindow: true}, function(tabs) {
                  if (tabs && tabs.length > 0) {
                    browserAPI.tabs.sendMessage(tabs[0].id, {action: 'startCapture'});
                  }
                });
              }
            });
          } catch (e) {
            console.error('Error setting AI capture flag:', e);
            
            // Fallback without waiting for storage
            if (typeof startCapture === 'function') {
              startCapture();
            } else {
              browserAPI.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs && tabs.length > 0) {
                  browserAPI.tabs.sendMessage(tabs[0].id, {action: 'startCapture'});
                }
              });
            }
          }
        }
      } catch (e) {
        console.error('Error processing iframe message:', e);
      }
    });
    
    // Listen for extension messages
    browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === 'processScreenshot') {
        console.log('Panel received processScreenshot message');
        
        // Show the panel again after capture
        panel.style.display = 'flex';
        
        // Forward the message to the iframe
        try {
          iframe.contentWindow.postMessage({
            action: 'processScreenshot',
            data: request.data
          }, '*');
        } catch (e) {
          console.error('Error sending screenshot data to iframe:', e);
        }
        
        sendResponse({status: 'ok'});
      }
      
      // Handle external panel removal
      if (request.action === 'removePanel') {
        removeExistingPanel();
        sendResponse({status: 'ok'});
      }
      
      return true; // Keep message channel open
    });
    
    // Handle dark mode
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      panel.style.backgroundColor = '#292a2d';
      panel.style.borderColor = 'rgba(255,255,255,0.1)';
      contentContainer.style.backgroundColor = '#292a2d';
      resizeHandle.style.background = 'linear-gradient(135deg, transparent 50%, rgba(100, 100, 100, 0.5) 50%)';
    }
    
    // Store removal function globally
    window._insightRemovePanel = removeExistingPanel;
    
    return "Panel injected with Firefox compatibility";
  }
  
  // Remove any existing panel
  function removeExistingPanel() {
    // Check for panel
    const panel = document.getElementById('insight-extension-frame');
    if (panel) {
      panel.remove();
      console.log('Panel removed');
    }
    
    // Check for resize overlay
    const overlay = document.querySelector('.insight-resize-overlay');
    if (overlay) {
      overlay.remove();
      console.log('Resize overlay removed');
    }
    
    // Also check for old container (for backwards compatibility)
    const container = document.getElementById('insight-extension-container');
    if (container) {
      container.remove();
      console.log('Old panel container removed');
    }
    
    return true;
  }
  
  // Function to remove panel - used by background script
  function removeInsightPanel() {
    // Try global function first
    if (window._insightRemovePanel && typeof window._insightRemovePanel === 'function') {
      return window._insightRemovePanel();
    }
    
    // Otherwise just remove directly
    return removeExistingPanel();
  }