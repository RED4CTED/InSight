// Initialize after both scripts are loaded
document.addEventListener('DOMContentLoaded', function() {
  if (window.initializePopupModules) {
    window.initializePopupModules();
  }
});
console.log('Popup Modules initialized');