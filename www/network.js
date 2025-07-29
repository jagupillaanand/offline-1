/**
 * NETWORK.JS - Network and API Management Module
 * 
 * This file handles all network-related operations including:
 * - Internet connectivity detection
 * - API calls to Supabase backend
 * - Online/offline status management
 * - Network error handling and fallbacks
 * 
 * Dependencies: config.js (must be loaded first)
 */

window.SochNetwork = {
  
  // Global state variables
  isOnline: false,
  
  /**
   * CHECK INTERNET CONNECTIVITY
   * Performs multiple checks to accurately determine if device has internet access.
   * Uses both Capacitor network plugin and browser navigator for reliability.
   * 
   * @returns {boolean} - True if device is online, false if offline
   */
  checkConnectivity: async function() {
    try {
      console.log("🔍 Checking network connectivity...");
      const config = window.SochConfig;
      const { Network } = config.getPlugins();
      
      // Step 1: Check browser's navigator.onLine (basic check)
      const navigatorOnline = navigator.onLine;
      console.log("📱 Navigator online status:", navigatorOnline);
      
      let capacitorOnline = navigatorOnline; // Default fallback
      
      // Step 2: Try Capacitor network status (more accurate on mobile)
      try {
        const status = await Network.getStatus();
        capacitorOnline = status.connected;
        console.log("📡 Capacitor network status:", capacitorOnline);
      } catch (err) {
        console.log("⚠️ Capacitor network check failed, using navigator:", err.message);
      }
      
      // Step 3: Use permissive approach - if either check says online, consider online
      this.isOnline = navigatorOnline || capacitorOnline;
      
      // Step 4: If basic checks suggest online, test with actual API call
      if (this.isOnline) {
        try {
          // Quick connectivity test with our own API (3 second timeout)
          const testResponse = await Promise.race([
            fetch(`${config.API.baseUrl}?select=json&limit=1`, {
              method: 'HEAD', // Just check if server responds, don't download data
              headers: {
                'apikey': config.API.apiKey,
                'Authorization': `Bearer ${config.API.apiKey}`
              }
            }),
            // Timeout after 3 seconds to avoid long waits
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]);
          
          this.isOnline = testResponse.ok;
          console.log("🌐 API connectivity test:", this.isOnline ? "Success" : "Failed");
        } catch (err) {
          console.log("⚠️ API test failed, but keeping online status based on device:", err.message);
          // Don't change isOnline - trust the device's network status
        }
      }
      
      console.log("🌐 Final network status:", this.isOnline ? "Online ✅" : "Offline ❌");
      return this.isOnline;
    } catch (err) {
      console.error("❌ Network check failed completely:", err);
      // Default to online if we can't determine (better user experience)
      this.isOnline = true;
      console.log("🌐 Defaulting to online due to check failure");
      return true;
    }
  },

  /**
   * MAKE API CALL
   * Makes authenticated requests to the Supabase API with proper headers.
   * Handles different endpoints for JSON data, HTML URLs, and version checking.
   * 
   * @param {string} endpoint - The data to select (e.g., 'json', 'html_url', 'html_version')
   * @returns {Object} - The first object from the API response array
   * @throws {Error} - If API call fails or returns non-200 status
   */
  makeApiCall: async function(endpoint) {
    try {
      console.log(`📡 Making API call for: ${endpoint}`);
      const config = window.SochConfig;
      
      // Construct the full API URL with select parameter
      const url = `${config.API.baseUrl}?select=${endpoint}`;
      
      // Make authenticated request with required headers
      const response = await fetch(url, {
        headers: {
          'apikey': config.API.apiKey,
          'Authorization': `Bearer ${config.API.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Check if request was successful
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }
      
      // Parse JSON response
      const data = await response.json();
      console.log(`✅ API call successful for: ${endpoint}`);
      
      // Return first object from array (Supabase returns arrays)
      return data[0];
    } catch (err) {
      console.error(`❌ API call failed for ${endpoint}:`, err);
      throw new Error(`API request failed: ${err.message}`);
    }
  },

  /**
   * UPDATE NETWORK STATUS IN UI
   * Updates the visual network status indicator in the user interface.
   * Changes color and text based on online/offline state.
   * 
   * @param {boolean} online - Whether device is online or offline
   */
  updateNetworkStatusUI: function(online) {
    const networkStatusEl = document.getElementById('networkStatus');
    if (networkStatusEl) {
      // Update CSS class for styling (online = green, offline = red)
      networkStatusEl.className = `network-status ${online ? 'online' : 'offline'}`;
      
      // Update the HTML content with appropriate icon and text
      networkStatusEl.innerHTML = `
        <div class="network-dot"></div>
        <span>${online ? '🌐 Online' : '📴 Offline'}</span>
      `;
      
      console.log("🔄 UI network status updated:", online ? "Online" : "Offline");
    } else {
      console.warn("⚠️ Network status element not found in UI");
    }
  },

  /**
   * TEST API ENDPOINT
   * Tests if a specific API endpoint is reachable and returns valid data.
   * Used for more targeted connectivity testing.
   * 
   * @param {string} endpoint - The endpoint to test
   * @returns {boolean} - True if endpoint is reachable and returns data
   */
  testApiEndpoint: async function(endpoint) {
    try {
      const data = await this.makeApiCall(endpoint);
      return data !== null && data !== undefined;
    } catch (err) {
      console.log(`❌ API endpoint test failed for ${endpoint}:`, err.message);
      return false;
    }
  }
};

// Log successful module loading
console.log("✅ Network module loaded");
