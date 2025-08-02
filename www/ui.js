/**
 * UI.JS - User Interface Management Module
 * 
 * This file handles all user interface operations including:
 * - Progress updates and status messages
 * - Button state management
 * - Network status indicators
 * - Loading animations and visual feedback
 * - Error message displays
 * 
 * Dependencies: config.js, network.js (must be loaded first)
 */
window.SochUI = {
  /**
   * UPDATE PROGRESS MESSAGE
   * Updates the main status area with current operation progress.
   * Used throughout the app to keep users informed of what's happening.
   * 
   * @param {string} message - The progress message to display
   * @param {boolean} showSpinner - Whether to show loading spinner (default: false)
   */
  updateProgress: function(message, showSpinner = false) {
    console.log("📊 Progress:", message);
    
    const statusEl = document.getElementById('status');
    if (statusEl) {
      if (showSpinner) {
        // Show message with animated loading spinner
        statusEl.innerHTML = `
          <div style="text-align: center; display: flex; align-items: center; justify-content: center;">
            <div class="loading-spinner" style="margin-right: 10px;"></div>
            <span>${message}</span>
          </div>
        `;
      } else {
        // Show plain message
        statusEl.innerHTML = `<div style="text-align: center;">${message}</div>`;
      }
    }
  },
  /**
   * UPDATE BUTTON STATE
   * Changes the appearance and functionality of the main launch button.
   * Handles different states: ready, loading, disabled, retry, etc.
   * 
   * @param {string} text - Button text to display
   * @param {boolean} disabled - Whether button should be disabled
   * @param {string} state - Button state: 'ready', 'loading', 'error', 'success'
   */
  updateButton: function(text, disabled = false, state = 'ready') {
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.textContent = text;
      downloadBtn.disabled = disabled;
      
      // Add state-specific styling
      downloadBtn.className = `launch-button ${state}`;
      
      console.log(`🔲 Button updated: "${text}" (${disabled ? 'disabled' : 'enabled'}, state: ${state})`);
    }
  },
  /**
   * UPDATE NETWORK STATUS INDICATOR
   * Updates the visual network status indicator in the header.
   * Shows green dot for online, red dot for offline with appropriate text.
   * 
   * @param {boolean} online - Whether device is currently online
   * @param {string} additionalInfo - Optional additional status info
   */
  updateNetworkStatus: function(online, additionalInfo = '') {
    const networkStatusEl = document.getElementById('networkStatus');
    if (networkStatusEl) {
      // Update CSS class for styling (online = green, offline = red)
      networkStatusEl.className = `network-status ${online ? 'online' : 'offline'}`;
      
      // Create status text with optional additional info
      const statusText = online ? '🌐 Online' : '📴 Offline';
      const fullText = additionalInfo ? `${statusText} - ${additionalInfo}` : statusText;
      
      // Update the HTML content
      networkStatusEl.innerHTML = `
        <div class="network-dot"></div>
        <span>${fullText}</span>
      `;
      
      console.log("🌐 Network status UI updated:", fullText);
    } else {
      console.warn("⚠️ Network status element not found in UI");
    }
  },
  /**
   * UPDATE VERSION INFORMATION
   * Updates the version information display in the UI footer.
   * Shows app version and current content versions.
   * 
   * @param {string} jsonVersion - Current JSON content version
   * @param {string} htmlVersion - Current HTML content version
   */
  updateVersionInfo: function(jsonVersion = 'Unknown', htmlVersion = 'Unknown') {
    const versionInfoEl = document.getElementById('versionInfo');
    if (versionInfoEl) {
      versionInfoEl.innerHTML = `
        App Version: 1.0.0<br>
        Content: JSON v${jsonVersion} | HTML v${htmlVersion}
      `;
      console.log("📱 Version info updated:", `JSON v${jsonVersion}, HTML v${htmlVersion}`);
    }
  },
  /**
   * SHOW SUCCESS MESSAGE
   * Displays a success message with green styling and checkmark icon.
   * Used when operations complete successfully.
   * 
   * @param {string} message - Success message to display
   */
  showSuccess: function(message) {
    this.updateProgress(`✅ ${message}`);
    
    // Also update button to success state
    setTimeout(() => {
      this.updateButton("🎉 Launch Successful", false, 'success');
    }, 1000);
  },
  /**
   * SHOW ERROR MESSAGE
   * Displays an error message with red styling and error icon.
   * Re-enables the launch button for retry attempts.
   * 
   * @param {string} message - Error message to display
   * @param {boolean} allowRetry - Whether to show retry button (default: true)
   */
  showError: function(message, allowRetry = true) {
    this.updateProgress(`❌ ${message}`);
    
    if (allowRetry) {
      // Enable retry functionality
      this.updateButton("🔄 Retry Launch", false, 'error');
    } else {
      // Keep button disabled
      this.updateButton("❌ Launch Failed", true, 'error');
    }
  },
  /**
   * SHOW LOADING STATE
   * Sets the UI to loading state with spinner and progress message.
   * Disables the launch button and shows activity indicator.
   * 
   * @param {string} message - Loading message to display
   */
  showLoading: function(message) {
    this.updateProgress(message, true); // Show with spinner
    this.updateButton("🔄 Loading...", true, 'loading');
  },
  /**
   * SHOW FLIPBOOK CONTAINER
   * Hides the main UI and shows the fullscreen flipbook container.
   * Called when flipbook is successfully loaded and ready to display.
   */
  showFlipbook: function() {
    // Hide the main launch interface
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.style.display = 'none';
    }
    
    // Hide the entire main screen
    const mainScreen = document.getElementById('mainScreen');
    if (mainScreen) {
      mainScreen.style.display = 'none';
    }
    
    // Show the flipbook container in fullscreen
    const flipbookContainer = document.getElementById('flipbookContainer');
    if (flipbookContainer) {
      flipbookContainer.classList.add('active');
      // Make sure it's visible
      flipbookContainer.style.display = 'block';
      console.log("📖 Flipbook container displayed");
    }
  },
  /**
   * HIDE FLIPBOOK CONTAINER
   * Hides the flipbook and shows the main UI again.
   * Called when user closes the flipbook or wants to return to main screen.
   */
  hideFlipbook: function() {
    // Hide the flipbook container
    const flipbookContainer = document.getElementById('flipbookContainer');
    if (flipbookContainer) {
      flipbookContainer.classList.remove('active');
      flipbookContainer.style.display = 'none';
    }
    
    // Show the main screen again
    const mainScreen = document.getElementById('mainScreen');
    if (mainScreen) {
      mainScreen.style.display = 'block';
    }
    
    // Show the main launch interface again
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.style.display = 'block';
      this.updateButton("📖 Reopen Collection", false, 'ready');
    }
    
    this.updateProgress("Flipbook closed. Click to reopen your collection.");
    console.log("🔙 Returned to main interface");
  },
  /**
   * SETUP EVENT LISTENERS
   * Sets up all UI event listeners for button clicks and interactions.
   * Should be called once when the app initializes.
   */
  setupEventListeners: function() {
    // Close flipbook button listener
    const closeBtn = document.getElementById('closeFlipbook');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideFlipbook();
      });
      console.log("✅ Close button listener attached");
    }
    
    // Handle navigation return
    window.addEventListener('message', (event) => {
      if (event.data === 'returnFromFlipbook') {
        console.log("📱 Received return message from flipbook");
        this.hideFlipbook();
      }
    });
    
    // Launch button listener (will be attached by main app)
    console.log("✅ UI event listeners setup completed");
  },
  /**
   * INITIALIZE UI STATE
   * Sets the initial state of all UI elements when app starts.
   * Called during app initialization to ensure consistent starting state.
   */
  initializeState: function() {
    // Set initial button state
    this.updateButton("🚀 Launch Digital Collection", false, 'ready');
    
    // Set initial progress message
    this.updateProgress("Ready to launch your digital collection experience");
    
    // Set initial network status (will be updated after connectivity check)
    this.updateNetworkStatus(navigator.onLine, "Checking...");
    
    // Set initial version info
    this.updateVersionInfo('Checking...', 'Checking...');
    
    // Make sure flipbook container is hidden initially
    const flipbookContainer = document.getElementById('flipbookContainer');
    if (flipbookContainer) {
      flipbookContainer.style.display = 'none';
      flipbookContainer.classList.remove('active');
    }
    
    console.log("✅ UI initialized to default state");
  }
};

// Log successful module loading
console.log("✅ UI module loaded");