/**
 * APP.JS - Main Application Controller
 * 
 * This is the main entry point that coordinates all other modules.
 * It handles:
 * - App initialization and startup sequence
 * - Module coordination and communication
 * - Main event handling (button clicks, etc.)
 * - Error handling and recovery
 * - App lifecycle management
 * 
 * Dependencies: ALL other modules must be loaded before this file
 * Load order: config.js → network.js → storage.js → media.js → flipbook.js → ui.js → app.js
 */

(function() {
  'use strict';

  // Global state variables
  let isInitialized = false;
  let initializationInProgress = false;

  /**
   * MAIN APP INITIALIZATION FUNCTION
   * 
   * This is the core function that orchestrates the entire app startup process.
   * It follows a specific sequence to ensure everything loads properly:
   * 
   * 1. Request storage permissions
   * 2. Create folder structure
   * 3. Check internet connectivity
   * 4. Load flipbook content (online/offline)
   * 5. Show flipbook interface
   * 
   * The function handles both first-time setup and subsequent app launches.
   */
  async function initializeApp() {
    // Prevent multiple simultaneous initialization attempts
    if (initializationInProgress) {
      console.log("⚠️ Initialization already in progress, skipping duplicate call");
      return;
    }

    initializationInProgress = true;

    try {
      console.log("🚀 Starting SochApp initialization...");
      console.log("📱 App environment:", window.SochConfig.isCapacitor ? "Mobile (Capacitor)" : "Browser (Development)");
      
      // Set UI to loading state
      window.SochUI.showLoading("Initializing application...");
      
      // STEP 1: REQUEST STORAGE PERMISSIONS
      console.log("📋 Step 1: Requesting storage permissions...");
      window.SochUI.updateProgress("Requesting storage permissions...", true);
      await window.SochStorage.checkAndRequestPermissions();
      
      // STEP 2: CREATE FOLDER STRUCTURE
      console.log("📂 Step 2: Setting up folder structure...");
      window.SochUI.updateProgress("Setting up local storage...", true);
      await window.SochStorage.ensureAppFolders();
      
      // STEP 3: CHECK INTERNET CONNECTIVITY
      console.log("🌐 Step 3: Checking internet connectivity...");
      window.SochUI.updateProgress("Checking internet connection...", true);
      const isOnline = await window.SochNetwork.checkConnectivity();
      
      // Update network status in UI
      window.SochNetwork.updateNetworkStatusUI(isOnline);
      
      // Log connectivity result and set user expectations
      if (isOnline) {
        console.log("✅ Device is online - will fetch latest content");
        window.SochUI.updateProgress("Online - loading latest content...", true);
      } else {
        console.log("📴 Device is offline - will use cached content");
        window.SochUI.updateProgress("Offline - loading cached content...", true);
      }
      
      // STEP 4: LOAD FLIPBOOK CONTENT
      console.log("📖 Step 4: Loading flipbook content...");
      window.SochUI.updateProgress("Loading digital collection...", true);
      
      const flipbookLoaded = await window.SochFlipbook.loadFlipbook();
      
      // STEP 5: HANDLE LOADING RESULT
      if (flipbookLoaded) {
        console.log("🎉 Flipbook loaded successfully!");
        window.SochUI.showSuccess("Collection loaded successfully!");
        
        // Wait a moment for user to see success message, then show flipbook
        setTimeout(() => {
          window.SochUI.showFlipbook();
          isInitialized = true;
        }, 1500);
      } else {
        console.error("❌ Flipbook failed to load");
        window.SochUI.showError("Failed to load collection. Please try again.");
      }
      
    } catch (err) {
      // Handle any errors during initialization
      console.error("❌ App initialization failed:", err);
      window.SochUI.showError(`Initialization failed: ${err.message}`);
      
      // Log detailed error for debugging
      console.error("🐛 Detailed error information:", {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
      
    } finally {
      // Always reset the initialization flag
      initializationInProgress = false;
    }
  }

  /**
   * HANDLE LAUNCH BUTTON CLICK
   * 
   * Event handler for the main launch button. Manages button states
   * and delegates to the main initialization function.
   */
  async function handleLaunchButtonClick() {
    const downloadBtn = document.getElementById('downloadBtn');
    
    try {
      console.log("🖱️ Launch button clicked");
      
      // Set button to loading state
      window.SochUI.updateButton("🔄 Launching...", true, 'loading');
      
      // Start the main app initialization
      await initializeApp();
      
    } catch (err) {
      console.error("❌ Launch button handler failed:", err);
      window.SochUI.showError("Launch failed. Please try again.");
    }
  }

  /**
   * SETUP EVENT LISTENERS
   * 
   * Attaches event listeners to UI elements after DOM is loaded.
   * Sets up the main launch button and any other interactive elements.
   */
  function setupEventListeners() {
    console.log("🔗 Setting up event listeners...");
    
    // Main launch button
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', handleLaunchButtonClick);
      console.log("✅ Launch button listener attached");
    } else {
      console.warn("⚠️ Launch button not found in DOM!");
    }
    
    // Setup UI module event listeners (close button, etc.)
    window.SochUI.setupEventListeners();
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log("🌐 Device came online");
      window.SochNetwork.updateNetworkStatusUI(true, "Connected");
    });
    
    window.addEventListener('offline', () => {
      console.log("📴 Device went offline");
      window.SochNetwork.updateNetworkStatusUI(false, "Disconnected");
    });
    
    console.log("✅ All event listeners setup completed");
  }

  /**
   * CHECK MODULE DEPENDENCIES
   * 
   * Verifies that all required modules are loaded before starting the app.
   * Prevents errors if modules are missing or loaded in wrong order.
   * 
   * @returns {boolean} - True if all modules are available
   */
  function checkDependencies() {
    const requiredModules = [
      'SochConfig',
      'SochNetwork', 
      'SochStorage',
      'SochMedia',
      'SochFlipbook',
      'SochUI'
    ];
    
    const missingModules = requiredModules.filter(module => !window[module]);
    
    if (missingModules.length > 0) {
      console.error("❌ Missing required modules:", missingModules);
      return false;
    }
    
    console.log("✅ All required modules are loaded");
    return true;
  }

  /**
   * DOM CONTENT LOADED EVENT HANDLER
   * 
   * Main entry point when the page loads. Sets up the app and initializes UI.
   */
  function onDOMContentLoaded() {
    console.log("📱 SochApp DOM loaded");
    console.log("🏗️ Initializing Soch Digital Collection App...");
    
    // Check if all modules are available
    if (!checkDependencies()) {
      console.error("❌ Cannot start app - missing dependencies");
      window.SochUI?.showError("App initialization failed - missing modules");
      return;
    }
    
    // Initialize UI to default state
    window.SochUI.initializeState();
    
    // Setup all event listeners
    setupEventListeners();
    
    // Initial network status check
    setTimeout(async () => {
      const isOnline = await window.SochNetwork.checkConnectivity();
      window.SochNetwork.updateNetworkStatusUI(isOnline);
    }, 1000);
    
    console.log("✅ SochApp initialization completed - ready for user interaction");
  }

  /**
   * APP STARTUP - WAIT FOR DOM AND MODULES
   * 
   * Wait for DOM to be ready, then start the app
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
  } else {
    // DOM is already loaded
    onDOMContentLoaded();
  }

  /**
   * EXPORT MAIN APP FUNCTIONS
   * 
   * Make key functions available globally for debugging and external access
   */
  window.SochApp = {
    initialize: initializeApp,
    checkConnectivity: () => window.SochNetwork.checkConnectivity(),
    loadFlipbook: () => window.SochFlipbook.loadFlipbook(),
    isInitialized: () => isInitialized,
    version: "1.0.0"
  };

  console.log("✅ Main app module loaded and ready");

})();
