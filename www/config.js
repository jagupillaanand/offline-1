/**
 * CONFIG.JS - Configuration and Constants Module
 * 
 * This file contains all the configuration settings, constants, and fallback functions
 * used throughout the Soch Digital Collection app. It centralizes all settings
 * to make maintenance and updates easier.
 * 
 * Key Components:
 * - App folder structure configuration
 * - API endpoints and authentication
 * - Capacitor environment detection
 * - Web browser fallback functions for testing
 */

window.SochConfig = {
  
  /**
   * APP FOLDER CONFIGURATION
   * Defines the main folder name and subfolders where content will be stored
   * on the device's local storage
   */
  APP_FOLDER: "SochApp", // Main folder name in Documents directory
  SUBFOLDERS: ["html", "json", "images", "videos"], // Subfolders for organized storage
  
  /**
   * API CONFIGURATION
   * Contains Supabase API endpoint and authentication key for fetching
   * the latest content, HTML files, and JSON data
   */
  API: {
    baseUrl: "https://sjwmfjykydevvyoldnqo.supabase.co/rest/v1/mobile_app_release",
    apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqd21manlreWRldnZ5b2xkbnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjIzMDg1NjMsImV4cCI6MjAzNzg4NDU2M30.u_q_6yP-4PV-NeEp3vdR-ZX7_m5ocbeCWL_JZxl_Vds"
  },
  
  /**
   * ENVIRONMENT DETECTION
   * Determines if the app is running in a Capacitor mobile environment
   * or in a web browser for testing purposes
   */
  isCapacitor: window.Capacitor && window.Capacitor.Plugins,
  
  /**
   * WEB BROWSER FALLBACKS
   * Mock functions that simulate Capacitor plugins when testing in a web browser.
   * These prevent errors and allow the app to run in development mode.
   */
  webFallbacks: {
    
    // Mock Filesystem plugin for browser testing
    Filesystem: {
      // Always grant permissions in browser mode
      checkPermissions: () => Promise.resolve({ publicStorage: "granted" }),
      requestPermissions: () => Promise.resolve(),
      
      // Simulate folder creation (no actual folders created in browser)
      mkdir: () => Promise.resolve(),
      
      // Return mock file URIs for browser testing
      getUri: (options) => Promise.resolve({ uri: `mock:///${options.path}` }),
      
      // Simulate file operations (no actual files in browser)
      writeFile: () => Promise.resolve(),
      readFile: () => Promise.reject(new Error("No local file in browser")),
      readdir: () => Promise.resolve({ files: [] }),
      deleteFile: () => Promise.resolve(),
      stat: () => Promise.reject(new Error("File not found"))
    },
    
    // Mock FileTransfer plugin for browser testing
    FileTransfer: {
      // Log download attempts without actually downloading in browser
      downloadFile: (options) => {
        console.log("📥 Mock download:", options.url);
        return Promise.resolve({ path: options.path });
      }
    },
    
    // Mock Network plugin for browser testing
    Network: {
      // Use browser's navigator.onLine for network status
      getStatus: () => Promise.resolve({ connected: navigator.onLine })
    }
  },
  
  /**
   * GET PLUGINS FUNCTION
   * Returns either real Capacitor plugins (mobile) or mock fallbacks (browser)
   * This allows the same code to work in both environments
   * 
   * @returns {Object} - Either Capacitor plugins or web fallbacks
   */
  getPlugins: function() {
    return this.isCapacitor ? 
      window.Capacitor.Plugins : 
      this.webFallbacks;
  }
};

// Log successful module loading
console.log("✅ Config module loaded");
console.log("🏗️ Environment:", window.SochConfig.isCapacitor ? "Mobile (Capacitor)" : "Browser (Development)");
