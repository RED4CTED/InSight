// Global variables
let isSelecting = false;
let startX, startY;
let selectionBox = null;

// Determine which browser API to use
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Debug function
function debug(msg) {
  console.log(`[Screenshot Extension]: ${msg}`);
}

// Create the selection interface
function startCapture() {
  debug('Starting capture process');
  
  // Create selection box if it doesn't exist
  if (!selectionBox) {
    selectionBox = document.createElement('div');
    selectionBox.id = 'selection-box';
    selectionBox.style.position = 'fixed';
    selectionBox.style.border = '2px dashed #fff';
    selectionBox.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
    selectionBox.style.display = 'none';
    selectionBox.style.zIndex = '2147483648';
    document.body.appendChild(selectionBox);
  }
  
  // Add semitransparent overlay with instructions
  const overlay = document.createElement('div');
  overlay.id = 'screenshot-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  overlay.style.zIndex = '2147483647';
  overlay.style.cursor = 'crosshair';
  
  // Add instruction text
  const instructions = document.createElement('div');
  instructions.style.position = 'fixed';
  instructions.style.top = '10px';
  instructions.style.left = '50%';
  instructions.style.transform = 'translateX(-50%)';
  instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  instructions.style.color = 'white';
  instructions.style.padding = '10px 20px';
  instructions.style.borderRadius = '4px';
  instructions.style.fontSize = '14px';
  instructions.style.zIndex = '2147483649';
  instructions.textContent = 'Click and drag to select an area. Press ESC to cancel.';
  
  document.body.appendChild(overlay);
  document.body.appendChild(instructions);
  
  // We'll use document-level event handlers for better reliability
  function handleMouseDown(e) {
    debug('Mouse down detected');
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';
    
    e.preventDefault();
    e.stopPropagation();
  }
  
  function handleMouseMove(e) {
    if (!isSelecting) return;
    
    debug('Mouse moving during selection');
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    // Calculate coordinates for selection box
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    // Update selection box
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    
    e.preventDefault();
    e.stopPropagation();
  }
  
  function handleMouseUp(e) {
    if (!isSelecting) return;
    
    debug('Mouse up detected - selection complete');
    isSelecting = false;
    
    // Get final selection coordinates (fixed, not integers)
    const left = parseFloat(selectionBox.style.left);
    const top = parseFloat(selectionBox.style.top);
    const width = parseFloat(selectionBox.style.width);
    const height = parseFloat(selectionBox.style.height);
    
    debug(`Selection area: ${left},${top} ${width}x${height}`);
    
    // Remove all event listeners
    document.removeEventListener('mousedown', handleMouseDown, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('mouseup', handleMouseUp, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    
    // Remove overlay and instructions
    document.body.removeChild(overlay);
    document.body.removeChild(instructions);
    
    // Only capture if selection has a reasonable size
    if (width > 10 && height > 10) {
      debug('Selection size valid, capturing...');
      selectionBox.style.display = 'none';
      
      // Get page zoom level and device pixel ratio for accurate coordinates
      const zoomLevel = window.devicePixelRatio || 1;
      
      // Get scroll position
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      
      // Get window dimensions
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      debug(`Window: ${windowWidth}x${windowHeight}, Zoom: ${zoomLevel}, Scroll: ${scrollX},${scrollY}`);
      
      // Delay the capture slightly to ensure the UI is fully updated
      setTimeout(() => {
        // Capture the screenshot with all metadata for accurate cropping
        const messageData = {
          action: 'captureTab',
          data: {
            left: left,
            top: top,
            width: width,
            height: height,
            zoomLevel: zoomLevel,
            scrollX: scrollX,
            scrollY: scrollY,
            windowWidth: windowWidth,
            windowHeight: windowHeight
          }
        };
        
        // Send message using browser-appropriate method
        browserAPI.runtime.sendMessage(messageData)
          .then(response => {
            debug('Sent capture request to background script');
            // Remove selection box after sending the request
            if (selectionBox && selectionBox.parentNode) {
              document.body.removeChild(selectionBox);
              selectionBox = null;
            }
          })
          .catch(error => {
            debug('Error sending message: ' + (error ? error.message : 'unknown error'));
            
            // For Chrome (doesn't support promises for sendMessage)
            if (typeof browser === 'undefined') {
              // Just cleanup in Chrome as the error is expected
              if (selectionBox && selectionBox.parentNode) {
                document.body.removeChild(selectionBox);
                selectionBox = null;
              }
            }
          });
      }, 100);
    } else {
      debug('Selection too small, aborting');
      // Remove selection box
      if (selectionBox && selectionBox.parentNode) {
        document.body.removeChild(selectionBox);
        selectionBox = null;
      }
    }
    
    e.preventDefault();
    e.stopPropagation();
  }
  
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      debug('ESC pressed, canceling selection');
      isSelecting = false;
      
      // Remove all event listeners
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      
      // Remove all elements
      document.body.removeChild(overlay);
      document.body.removeChild(instructions);
      
      if (selectionBox && selectionBox.parentNode) {
        document.body.removeChild(selectionBox);
        selectionBox = null;
      }
      
      e.preventDefault();
      e.stopPropagation();
    }
  }
  
  // Add event listeners with capture option (true) for better reliability
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('mouseup', handleMouseUp, true);
  document.addEventListener('keydown', handleKeyDown, true);
  
  debug('Capture interface initialized');
}

// Listen for messages from popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debug(`Message received: ${request.action}`);
  
  if (request.action === 'startCapture') {
    startCapture();
    sendResponse({status: 'ok'});
  }
  
  return true;
});

debug('Content script loaded');