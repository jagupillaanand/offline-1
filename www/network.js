/**
 * NETWORK.JS - Network and API Management Module WITH EXTENSIVE DEBUGGING
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
   * CHECK INTERNET CONNECTIVITY WITH EXTENSIVE DEBUGGING
   * Performs multiple checks to accurately determine if device has internet access.
   * Uses both Capacitor network plugin and browser navigator for reliability.
   * 
   * @returns {boolean} - True if device is online, false if offline
   */
  checkConnectivity: async function() {
    try {
      console.log("🔍 ===== STARTING NETWORK CONNECTIVITY CHECK =====");
      const config = window.SochConfig;
      const { Network } = config.getPlugins();
      
      // Step 1: Check browser's navigator.onLine (basic check)
      const navigatorOnline = navigator.onLine;
      console.log("📱 Step 1 - Navigator online status:", navigatorOnline);
      console.log("📱 Navigator connection info:", {
        onLine: navigator.onLine,
        userAgent: navigator.userAgent.substring(0, 50) + "...",
        platform: navigator.platform
      });
      
      let capacitorOnline = navigatorOnline; // Default fallback
      
      // Step 2: Try Capacitor network status (more accurate on mobile)
      console.log("📡 Step 2 - Checking Capacitor network status...");
      try {
        const status = await Network.getStatus();
        capacitorOnline = status.connected;
        console.log("📡 Capacitor network status SUCCESS:", {
          connected: status.connected,
          connectionType: status.connectionType || 'unknown',
          fullStatus: status
        });
      } catch (err) {
        console.log("⚠️ Capacitor network check FAILED:", {
          error: err.message,
          errorType: err.constructor.name,
          fallbackValue: navigatorOnline
        });
      }
      
      // Step 3: Combine checks
      console.log("🔄 Step 3 - Combining network checks...");
      console.log("📊 Network check results:", {
        navigatorOnline: navigatorOnline,
        capacitorOnline: capacitorOnline,
        combinedResult: navigatorOnline || capacitorOnline
      });
      
      // Use permissive approach - if either check says online, consider online
      this.isOnline = navigatorOnline || capacitorOnline;
      console.log("🌐 Preliminary network status:", this.isOnline ? "ONLINE" : "OFFLINE");
      
      // Step 4: If basic checks suggest online, test with actual API call
      if (this.isOnline) {
        console.log("🧪 Step 4 - Running API connectivity test...");
        console.log("🔗 API test URL:", `${config.API.baseUrl}?select=json&limit=1`);
        
        try {
          // Quick connectivity test with our own API (3 second timeout)
          console.log("⏱️ Starting API test with 3 second timeout...");
          const startTime = Date.now();
          
          const testResponse = await Promise.race([
            fetch(`${config.API.baseUrl}?select=json&limit=1`, {
              method: 'HEAD', // Just check if server responds, don't download data
              headers: {
                'apikey': config.API.apiKey,
                'Authorization': `Bearer ${config.API.apiKey}`
              }
            }),
            // Timeout after 3 seconds to avoid long waits
            new Promise((_, reject) => setTimeout(() => reject(new Error('API_TIMEOUT')), 3000))
          ]);
          
          const responseTime = Date.now() - startTime;
          console.log("✅ API test response received:", {
            status: testResponse.status,
            statusText: testResponse.statusText,
            ok: testResponse.ok,
            responseTimeMs: responseTime,
            headers: {
              contentType: testResponse.headers.get('content-type'),
              server: testResponse.headers.get('server')
            }
          });
          
          this.isOnline = testResponse.ok;
          console.log("🌐 API connectivity test result:", this.isOnline ? "SUCCESS - API REACHABLE" : "FAILED - API NOT OK");
          
        } catch (err) {
          console.log("❌ API test FAILED with error:", {
            errorMessage: err.message,
            errorType: err.constructor.name,
            errorStack: err.stack ? err.stack.substring(0, 200) + "..." : "No stack trace"
          });
          
          // FIXED: If API fails, we're effectively offline
          this.isOnline = false;
          console.log("🌐 Setting status to OFFLINE due to API failure");
        }
      } else {
        console.log("⏭️ Step 4 - SKIPPED API test (basic checks indicated offline)");
      }
      
      // Final result
      console.log("🏁 ===== FINAL NETWORK CHECK RESULT =====");
      console.log("🌐 Final network status:", this.isOnline ? "✅ ONLINE" : "❌ OFFLINE");
      console.log("📊 Complete status summary:", {
        navigatorOnline: navigatorOnline,
        capacitorOnline: capacitorOnline,
        apiTestPassed: this.isOnline && (navigatorOnline || capacitorOnline),
        finalStatus: this.isOnline ? "ONLINE" : "OFFLINE",
        timestamp: new Date().toISOString()
      });
      console.log("===============================================");
      
      return this.isOnline;
    } catch (err) {
      console.error("💥 ===== NETWORK CHECK COMPLETELY FAILED =====");
      console.error("❌ Fatal network check error:", {
        errorMessage: err.message,
        errorType: err.constructor.name,
        errorStack: err.stack
      });
      
      // FIXED: Default to offline if we can't determine (prevents false positive)
      this.isOnline = false;
      console.log("🌐 Defaulting to OFFLINE due to check failure");
      console.log("===============================================");
      return false;
    }
  },

  /**
   * MAKE API CALL WITH DEBUG LOGGING
   * Makes authenticated requests to the Supabase API with proper headers.
   * Handles different endpoints for JSON data, HTML URLs, and version checking.
   * 
   * @param {string} endpoint - The data to select (e.g., 'json', 'html_url', 'html_version')
   * @returns {Object} - The first object from the API response array
   * @throws {Error} - If API call fails or returns non-200 status
   */
  makeApiCall: async function(endpoint) {
    try {
      console.log(`📡 ===== MAKING API CALL =====`);
      console.log(`📡 Endpoint requested: ${endpoint}`);
      const config = window.SochConfig;
      
      // Construct the full API URL with select parameter
      const url = `${config.API.baseUrl}?select=${endpoint}`;
      console.log(`📡 Full API URL: ${url}`);
      
      const startTime = Date.now();
      
      // Make authenticated request with required headers
      const response = await fetch(url, {
        headers: {
          'apikey': config.API.apiKey,
          'Authorization': `Bearer ${config.API.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`📡 API response received:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        responseTimeMs: responseTime
      });
      
      // Check if request was successful
      if (!response.ok) {
        const errorMsg = `HTTP error! status: ${response.status} - ${response.statusText}`;
        console.error(`❌ API call failed:`, errorMsg);
        throw new Error(errorMsg);
      }
      
      // Parse JSON response
      const data = await response.json();
      console.log(`✅ API call successful for: ${endpoint}`);
      console.log(`📊 Response data type:`, Array.isArray(data) ? `Array with ${data.length} items` : typeof data);
      console.log(`===============================`);
      
      // Return first object from array (Supabase returns arrays)
      return data[0];
    } catch (err) {
      console.error(`❌ ===== API CALL FAILED =====`);
      console.error(`❌ Endpoint: ${endpoint}`);
      console.error(`❌ Error details:`, {
        message: err.message,
        type: err.constructor.name,
        stack: err.stack ? err.stack.substring(0, 300) + "..." : "No stack trace"
      });
      console.error(`==============================`);
      throw new Error(`API request failed: ${err.message}`);
    }
  },

  /**
   * UPDATE NETWORK STATUS IN UI WITH DEBUG LOGGING
   * Updates the visual network status indicator in the user interface.
   * Changes color and text based on online/offline state.
   * 
   * @param {boolean} online - Whether device is online or offline
   * @param {string} additionalInfo - Optional additional status info
   */
  updateNetworkStatusUI: function(online, additionalInfo = '') {
    console.log("🔄 ===== UPDATING UI NETWORK STATUS =====");
    console.log("🔄 Status to display:", online ? "ONLINE" : "OFFLINE");
    console.log("🔄 Additional info:", additionalInfo || "None");
    
    const networkStatusEl = document.getElementById('networkStatus');
    if (networkStatusEl) {
      // Update CSS class for styling (online = green, offline = red)
      const oldClassName = networkStatusEl.className;
      networkStatusEl.className = `network-status ${online ? 'online' : 'offline'}`;
      
      // Create status text with optional additional info
      const statusText = online ? '🌐 Online' : '📴 Offline';
      const fullText = additionalInfo ? `${statusText} - ${additionalInfo}` : statusText;
      
      // Update the HTML content
      networkStatusEl.innerHTML = `
        <div class="network-dot"></div>
        <span>${fullText}</span>
      `;
      
      console.log("✅ UI network status updated successfully:", {
        oldClass: oldClassName,
        newClass: networkStatusEl.className,
        displayText: fullText
      });
    } else {
      console.warn("⚠️ Network status element 'networkStatus' not found in DOM!");
      console.warn("⚠️ Available elements with IDs:", Array.from(document.querySelectorAll('[id]')).map(el => el.id));
    }
    console.log("==========================================");
  },

  /**
   * TEST API ENDPOINT WITH DEBUG LOGGING
   * Tests if a specific API endpoint is reachable and returns valid data.
   * Used for more targeted connectivity testing.
   * 
   * @param {string} endpoint - The endpoint to test
   * @returns {boolean} - True if endpoint is reachable and returns data
   */
  testApiEndpoint: async function(endpoint) {
    console.log(`🧪 ===== TESTING API ENDPOINT =====`);
    console.log(`🧪 Testing endpoint: ${endpoint}`);
    
    try {
      const startTime = Date.now();
      const data = await this.makeApiCall(endpoint);
      const responseTime = Date.now() - startTime;
      
      const isValid = data !== null && data !== undefined;
      console.log(`🧪 Endpoint test result:`, {
        endpoint: endpoint,
        dataReceived: isValid,
        dataType: typeof data,
        responseTimeMs: responseTime,
        success: isValid
      });
      console.log(`=================================`);
      
      return isValid;
    } catch (err) {
      console.log(`❌ API endpoint test FAILED for ${endpoint}:`, {
        error: err.message,
        errorType: err.constructor.name
      });
      console.log(`=================================`);
      return false;
    }
  }
};

// Log successful module loading
console.log("✅ Network module loaded WITH EXTENSIVE DEBUGGING");
console.log("🔍 Debug features enabled: connectivity check, API calls, UI updates");