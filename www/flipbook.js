/**
 * FLIPBOOK.JS - Flipbook Management Module
 * 
 * This file handles all flipbook-related operations including:
 * - HTML file downloading and caching
 * - Flipbook content loading and rendering
 * - JSON data injection into HTML
 * - Offline/online content management
 * - Error handling and fallback displays
 * - FIXED: Local video playback in Capacitor WebView
 * 
 * Dependencies: config.js, network.js, storage.js, media.js (must be loaded first)
 */

window.SochFlipbook = {

  /**
   * CHECK IF HTML FILE EXISTS LOCALLY
   * Verifies if the flipbook HTML file is already cached in local storage.
   * Used to determine if we need to download fresh HTML or use cached version.
   * 
   * @returns {boolean} - True if HTML file exists locally, false otherwise
   */
  checkLocalHtmlExists: async function() {
    const config = window.SochConfig;
    
    // No local files in browser mode
    if (!config.isCapacitor) return false;
    
    try {
      const { Filesystem } = config.getPlugins();
      
      // Try to read the HTML file to check if it exists
      await Filesystem.readFile({
        path: `${config.APP_FOLDER}/html/flipbook.html`,
        directory: 'DOCUMENTS',
        encoding: 'utf8'
      });
      
      console.log("✅ Local HTML file found in cache");
      return true;
    } catch (err) {
      console.log("ℹ️ Local HTML file not found - will need to download");
      return false;
    }
  },

  /**
   * DOWNLOAD AND SAVE HTML FILE
   * Downloads the latest flipbook HTML file from the server and saves it locally.
   * In mobile mode: Downloads and caches the file for offline use
   * In browser mode: Fetches the content but keeps it in memory only
   * 
   * @returns {boolean|string} - True if saved successfully (mobile) or HTML content (browser)
   */
  downloadAndSaveHtml: async function() {
    try {
      console.log("📥 Downloading latest flipbook HTML...");
      
      // Step 1: Get the HTML download URL from API
      const htmlUrlData = await window.SochNetwork.makeApiCall('html_url');
      const htmlUrl = htmlUrlData.html_url;
      
      console.log("🔗 HTML download URL:", htmlUrl);
      
      const config = window.SochConfig;
      
      if (config.isCapacitor) {
        // Mobile mode: Download and save to local storage
        console.log("📱 Mobile mode - downloading HTML to local storage...");
        
        const { Filesystem, FileTransfer } = config.getPlugins();
        
        // Get local file URI where HTML will be saved
        const fileUri = await Filesystem.getUri({
          directory: 'DOCUMENTS',
          path: `${config.APP_FOLDER}/html/flipbook.html`,
        });

        // Download HTML file to local storage
        await FileTransfer.downloadFile({
          url: htmlUrl,
          path: fileUri.uri,
        });
        
        console.log("✅ HTML file downloaded and cached locally");
        return true;
      } else {
        // Browser mode: Fetch and return content (no local saving)
        console.log("🌐 Browser mode - fetching HTML content...");
        
        const response = await fetch(htmlUrl);
        const htmlContent = await response.text();
        
        console.log("✅ HTML content fetched for browser use");
        return htmlContent;
      }
    } catch (err) {
      console.error("❌ Failed to download HTML file:", err);
      throw new Error(`HTML download failed: ${err.message}`);
    }
  },

  /**
   * MODIFY HTML FOR LOCAL VIDEO PLAYBACK
   * FIXED: Modifies the HTML to handle local video files properly in Capacitor.
   * Replaces iframe-based video handling with native HTML5 video tags for local files.
   * 
   * @param {string} htmlContent - Original HTML content
   * @param {Object} jsonData - JSON data with local file paths
   * @returns {string} - Modified HTML content
   */
  modifyHtmlForLocalVideos: function(htmlContent, jsonData) {
    try {
      console.log("🎥 Modifying HTML for local video playback...");
      
      // Inject custom JavaScript for local video handling
      const videoHandlingScript = `
        <script>
        // Custom local video handling for Capacitor
        function handleLocalVideos() {
          console.log("�� Setting up local video handling...");
          
          // Override the video page generation in flipbook
          if (typeof generateFlipbook !== 'undefined') {
            const originalGenerateFlipbook = generateFlipbook;
            generateFlipbook = function(collection, collectionKey) {
              // Call original function
              const result = originalGenerateFlipbook.call(this, collection, collectionKey);
              
              // After flipbook is generated, replace video iframes with video tags
              setTimeout(() => {
                replaceVideoIframes();
              }, 500);
              
              return result;
            };
          }
        }
        
        function replaceVideoIframes() {
          console.log("🔄 Replacing video iframes with HTML5 video tags...");
          
          // Find all video pages with local file URLs
          document.querySelectorAll('.video-page iframe').forEach(iframe => {
            const src = iframe.src || iframe.getAttribute('srcdoc');
            
            // Check if this is a local file URL
            if (src && src.startsWith('file://') && src.includes('.mp4')) {
              console.log("🎥 Converting iframe to video tag for:", src);
              
              // Create HTML5 video element
              const video = document.createElement('video');
              video.src = src;
              video.controls = true;
              video.autoplay = false;
              video.loop = true;
              video.muted = true;
              video.style.width = '100%';
              video.style.height = 'calc(100% - 30px)';
              video.style.objectFit = 'contain';
              video.style.background = '#000';
              
              // Replace iframe with video element
              iframe.parentNode.replaceChild(video, iframe);
              
              // Add error handling
              video.addEventListener('error', function(e) {
                console.error("❌ Video playback error:", e);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'video-error';
                errorDiv.style.color = 'white';
                errorDiv.style.textAlign = 'center';
                errorDiv.style.padding = '20px';
                errorDiv.innerHTML = '<p>Video format may not be supported on this device</p><p>File: ' + src.split('/').pop() + '</p>';
                video.parentNode.replaceChild(errorDiv, video);
              });
              
              // Add load success handler
              video.addEventListener('loadeddata', function() {
                console.log("✅ Video loaded successfully:", src);
              });
            }
          });
        }
        
        // Set up the video handling when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', handleLocalVideos);
        } else {
          handleLocalVideos();
        }
        </script>
      `;
      
      // Insert the script before the closing </body> tag
      const modifiedHtml = htmlContent.replace('</body>', videoHandlingScript + '</body>');
      
      console.log("✅ HTML modified for local video playback");
      return modifiedHtml;
      
    } catch (err) {
      console.error("❌ Error modifying HTML for videos:", err);
      return htmlContent; // Return original if modification fails
    }
  },

  /**
   * LOAD FLIPBOOK WITH ONLINE/OFFLINE SUPPORT
   * Main function that loads the flipbook interface. Handles both online and offline modes.
   * FIXED: Added local video playback support and better error handling.
   * 
   * @returns {boolean} - True if flipbook loaded successfully, false otherwise
   */
  loadFlipbook: async function() {
    try {
      console.log("�� Starting flipbook loading process...");
      
      const config = window.SochConfig;
      let jsonData;
      let useLocalData = false;
      
      // STEP 1: GET JSON DATA (online vs offline handling)
      if (config.isCapacitor) {
        // Mobile mode: Try online first, fallback to offline
        
        if (window.SochNetwork.isOnline) {
          // Online: Try to get fresh data from API
          try {
            console.log("🌐 Online mode: Fetching latest data from API...");
            window.SochUI.updateProgress("Fetching latest collection data...");
            
            const apiData = await window.SochNetwork.makeApiCall('json');
            jsonData = apiData.json;
            
            // Save fresh data for offline use
            await window.SochStorage.saveJsonData(jsonData);
            console.log("✅ Using fresh API data and saved for offline use");
          } catch (err) {
            console.log("⚠️ API fetch failed, falling back to local data:", err.message);
            
            // API failed: Try to use local cached data as fallback
            jsonData = await window.SochStorage.readLocalJsonData();
            if (jsonData) {
              useLocalData = true;
              console.log("✅ Using local cached data as fallback");
            } else {
              throw new Error("Unable to fetch fresh data and no local cache available");
            }
          }
        } else {
          // Offline: Use local cached data only
          console.log("📴 Offline mode: Using cached data...");
          window.SochUI.updateProgress("Loading from cache (offline mode)...");
          
          jsonData = await window.SochStorage.readLocalJsonData();
          if (jsonData) {
            useLocalData = true;
            console.log("✅ Using local cached data (offline mode)");
          } else {
            throw new Error("No local data available and device is offline. Please connect to internet for first-time setup.");
          }
        }
      } else {
        // Browser mode: Always fetch from API
        console.log("🌐 Browser mode: Fetching data from API...");
        const apiData = await window.SochNetwork.makeApiCall('json');
        jsonData = apiData.json;
        console.log("✅ Using API data (browser mode)");
      }

      // STEP 2: HANDLE HTML FILE (download vs cached)
      if (config.isCapacitor) {
        // Mobile mode: Check for cached HTML, download if needed
        
        const htmlExists = await this.checkLocalHtmlExists();
        
        if (!htmlExists && window.SochNetwork.isOnline) {
          console.log("📥 HTML not cached locally, downloading...");
          window.SochUI.updateProgress("Downloading flipbook interface...");
          await this.downloadAndSaveHtml();
        } else if (!htmlExists && !window.SochNetwork.isOnline) {
          throw new Error("No cached HTML available and device is offline. Please connect to internet for first-time setup.");
        }

        // STEP 3: DOWNLOAD MEDIA FILES (only if online and using fresh data)
        if (window.SochNetwork.isOnline && !useLocalData) {
          console.log("📥 Downloading media files...");
          await window.SochMedia.downloadMediaFiles(jsonData);
        } else {
          console.log("ℹ️ Skipping media downloads (offline or using cached data)");
        }

        // STEP 4: REPLACE URLS WITH LOCAL PATHS
        window.SochUI.updateProgress("Preparing content for offline use...");
        const modifiedJsonData = await window.SochMedia.replaceUrlsWithLocalPaths(jsonData);

        // STEP 5: READ LOCAL HTML FILE
        console.log("📄 Reading cached HTML file...");
        const { Filesystem } = config.getPlugins();
        const htmlContent = await Filesystem.readFile({
          path: `${config.APP_FOLDER}/html/flipbook.html`,
          directory: 'DOCUMENTS',
          encoding: 'utf8'
        });

        // STEP 6: MODIFY HTML FOR LOCAL VIDEO SUPPORT
        let modifiedHtml = this.modifyHtmlForLocalVideos(htmlContent.data, modifiedJsonData);

        // STEP 7: INJECT JSON DATA INTO HTML
        modifiedHtml = modifiedHtml.replace(
          /collections = \{\};/, // Find this placeholder in HTML
          `collections = ${JSON.stringify(modifiedJsonData.collections, null, 2)};` // Replace with actual data
        );

        // STEP 8: RENDER FLIPBOOK IN IFRAME
        const container = document.getElementById('flipbookContainer');
        if (container) {
          container.innerHTML = `
            <iframe id="flipbookFrame" 
                    style="width: 100%; height: 100vh; border: none;"
                    srcdoc="${modifiedHtml.replace(/"/g, '&quot;')}"
                    allow="autoplay; fullscreen; camera; microphone">
            </iframe>
          `;
          console.log("✅ Flipbook loaded successfully with local media files and video support");
          return true;
        }
      } else {
        // Browser mode: Load flipbook directly from API with remote URLs
        console.log("🌐 Browser mode: Loading flipbook with remote URLs...");
        
        const htmlContent = await this.downloadAndSaveHtml();
        
        // Inject JSON data into HTML
        const modifiedHtml = htmlContent.replace(
          /collections = \{\};/,
          `collections = ${JSON.stringify(jsonData.collections, null, 2)};`
        );
        
        // Render in browser
        const container = document.getElementById('flipbookContainer');
        if (container) {
          container.innerHTML = `
            <iframe id="flipbookFrame" 
                    style="width: 100%; height: 100vh; border: none;"
                    srcdoc="${modifiedHtml.replace(/"/g, '&quot;')}"
                    allow="autoplay; fullscreen">
            </iframe>
          `;
          console.log("✅ Flipbook loaded successfully (browser mode)");
          return true;
        }
      }
      
      return false;
    } catch (err) {
      console.error("❌ Failed to load flipbook:", err);
      
      // Show error message to user
      this.showErrorMessage(err.message);
      return false;
    }
  },

  /**
   * SHOW ERROR MESSAGE
   * Displays a user-friendly error message when flipbook fails to load.
   * Provides helpful suggestions based on online/offline status.
   * 
   * @param {string} errorMessage - The error message to display
   */
  showErrorMessage: function(errorMessage) {
    const container = document.getElementById('flipbookContainer');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: white; text-align: center; font-family: Arial, sans-serif; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <div style="background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; backdrop-filter: blur(10px); max-width: 500px;">
            <h2 style="margin-bottom: 20px; color: #fff;">❌ Unable to Load Collection</h2>
            <p style="margin-bottom: 20px; color: #fff; opacity: 0.9;">We couldn't load your digital collection at this time.</p>
            <p style="margin-bottom: 20px; font-size: 14px; color: #fff; opacity: 0.8; background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;">
              <strong>Error Details:</strong><br>${errorMessage}
            </p>
            <p style="font-size: 12px; color: #fff; opacity: 0.7;">
              ${window.SochNetwork.isOnline ? 
                'Please check your internet connection and try again.' : 
                'Please connect to internet for first-time setup, then the app will work offline.'}
            </p>
          </div>
        </div>
      `;
    }
  }
};

// Log successful module loading
console.log("✅ Flipbook module loaded");
EOFcat > flipbook.js << 'EOF'
/**
 * FLIPBOOK.JS - Flipbook Management Module
 * 
 * This file handles all flipbook-related operations including:
 * - HTML file downloading and caching
 * - Flipbook content loading and rendering
 * - JSON data injection into HTML
 * - Offline/online content management
 * - Error handling and fallback displays
 * - FIXED: Local video playback in Capacitor WebView
 * 
 * Dependencies: config.js, network.js, storage.js, media.js (must be loaded first)
 */

window.SochFlipbook = {

  /**
   * CHECK IF HTML FILE EXISTS LOCALLY
   * Verifies if the flipbook HTML file is already cached in local storage.
   * Used to determine if we need to download fresh HTML or use cached version.
   * 
   * @returns {boolean} - True if HTML file exists locally, false otherwise
   */
  checkLocalHtmlExists: async function() {
    const config = window.SochConfig;
    
    // No local files in browser mode
    if (!config.isCapacitor) return false;
    
    try {
      const { Filesystem } = config.getPlugins();
      
      // Try to read the HTML file to check if it exists
      await Filesystem.readFile({
        path: `${config.APP_FOLDER}/html/flipbook.html`,
        directory: 'DOCUMENTS',
        encoding: 'utf8'
      });
      
      console.log("✅ Local HTML file found in cache");
      return true;
    } catch (err) {
      console.log("ℹ️ Local HTML file not found - will need to download");
      return false;
    }
  },

  /**
   * DOWNLOAD AND SAVE HTML FILE
   * Downloads the latest flipbook HTML file from the server and saves it locally.
   * In mobile mode: Downloads and caches the file for offline use
   * In browser mode: Fetches the content but keeps it in memory only
   * 
   * @returns {boolean|string} - True if saved successfully (mobile) or HTML content (browser)
   */
  downloadAndSaveHtml: async function() {
    try {
      console.log("📥 Downloading latest flipbook HTML...");
      
      // Step 1: Get the HTML download URL from API
      const htmlUrlData = await window.SochNetwork.makeApiCall('html_url');
      const htmlUrl = htmlUrlData.html_url;
      
      console.log("🔗 HTML download URL:", htmlUrl);
      
      const config = window.SochConfig;
      
      if (config.isCapacitor) {
        // Mobile mode: Download and save to local storage
        console.log("📱 Mobile mode - downloading HTML to local storage...");
        
        const { Filesystem, FileTransfer } = config.getPlugins();
        
        // Get local file URI where HTML will be saved
        const fileUri = await Filesystem.getUri({
          directory: 'DOCUMENTS',
          path: `${config.APP_FOLDER}/html/flipbook.html`,
        });

        // Download HTML file to local storage
        await FileTransfer.downloadFile({
          url: htmlUrl,
          path: fileUri.uri,
        });
        
        console.log("✅ HTML file downloaded and cached locally");
        return true;
      } else {
        // Browser mode: Fetch and return content (no local saving)
        console.log("🌐 Browser mode - fetching HTML content...");
        
        const response = await fetch(htmlUrl);
        const htmlContent = await response.text();
        
        console.log("✅ HTML content fetched for browser use");
        return htmlContent;
      }
    } catch (err) {
      console.error("❌ Failed to download HTML file:", err);
      throw new Error(`HTML download failed: ${err.message}`);
    }
  },

  /**
   * MODIFY HTML FOR LOCAL VIDEO PLAYBACK
   * FIXED: Modifies the HTML to handle local video files properly in Capacitor.
   * Replaces iframe-based video handling with native HTML5 video tags for local files.
   * 
   * @param {string} htmlContent - Original HTML content
   * @param {Object} jsonData - JSON data with local file paths
   * @returns {string} - Modified HTML content
   */
  modifyHtmlForLocalVideos: function(htmlContent, jsonData) {
    try {
      console.log("🎥 Modifying HTML for local video playback...");
      
      // Inject custom JavaScript for local video handling
      const videoHandlingScript = `
        <script>
        // Custom local video handling for Capacitor
        function handleLocalVideos() {
          console.log("�� Setting up local video handling...");
          
          // Override the video page generation in flipbook
          if (typeof generateFlipbook !== 'undefined') {
            const originalGenerateFlipbook = generateFlipbook;
            generateFlipbook = function(collection, collectionKey) {
              // Call original function
              const result = originalGenerateFlipbook.call(this, collection, collectionKey);
              
              // After flipbook is generated, replace video iframes with video tags
              setTimeout(() => {
                replaceVideoIframes();
              }, 500);
              
              return result;
            };
          }
        }
        
        function replaceVideoIframes() {
          console.log("🔄 Replacing video iframes with HTML5 video tags...");
          
          // Find all video pages with local file URLs
          document.querySelectorAll('.video-page iframe').forEach(iframe => {
            const src = iframe.src || iframe.getAttribute('srcdoc');
            
            // Check if this is a local file URL
            if (src && src.startsWith('file://') && src.includes('.mp4')) {
              console.log("🎥 Converting iframe to video tag for:", src);
              
              // Create HTML5 video element
              const video = document.createElement('video');
              video.src = src;
              video.controls = true;
              video.autoplay = false;
              video.loop = true;
              video.muted = true;
              video.style.width = '100%';
              video.style.height = 'calc(100% - 30px)';
              video.style.objectFit = 'contain';
              video.style.background = '#000';
              
              // Replace iframe with video element
              iframe.parentNode.replaceChild(video, iframe);
              
              // Add error handling
              video.addEventListener('error', function(e) {
                console.error("❌ Video playback error:", e);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'video-error';
                errorDiv.style.color = 'white';
                errorDiv.style.textAlign = 'center';
                errorDiv.style.padding = '20px';
                errorDiv.innerHTML = '<p>Video format may not be supported on this device</p><p>File: ' + src.split('/').pop() + '</p>';
                video.parentNode.replaceChild(errorDiv, video);
              });
              
              // Add load success handler
              video.addEventListener('loadeddata', function() {
                console.log("✅ Video loaded successfully:", src);
              });
            }
          });
        }
        
        // Set up the video handling when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', handleLocalVideos);
        } else {
          handleLocalVideos();
        }
        </script>
      `;
      
      // Insert the script before the closing </body> tag
      const modifiedHtml = htmlContent.replace('</body>', videoHandlingScript + '</body>');
      
      console.log("✅ HTML modified for local video playback");
      return modifiedHtml;
      
    } catch (err) {
      console.error("❌ Error modifying HTML for videos:", err);
      return htmlContent; // Return original if modification fails
    }
  },

  /**
   * LOAD FLIPBOOK WITH ONLINE/OFFLINE SUPPORT
   * Main function that loads the flipbook interface. Handles both online and offline modes.
   * FIXED: Added local video playback support and better error handling.
   * 
   * @returns {boolean} - True if flipbook loaded successfully, false otherwise
   */
  loadFlipbook: async function() {
    try {
      console.log("�� Starting flipbook loading process...");
      
      const config = window.SochConfig;
      let jsonData;
      let useLocalData = false;
      
      // STEP 1: GET JSON DATA (online vs offline handling)
      if (config.isCapacitor) {
        // Mobile mode: Try online first, fallback to offline
        
        if (window.SochNetwork.isOnline) {
          // Online: Try to get fresh data from API
          try {
            console.log("🌐 Online mode: Fetching latest data from API...");
            window.SochUI.updateProgress("Fetching latest collection data...");
            
            const apiData = await window.SochNetwork.makeApiCall('json');
            jsonData = apiData.json;
            
            // Save fresh data for offline use
            await window.SochStorage.saveJsonData(jsonData);
            console.log("✅ Using fresh API data and saved for offline use");
          } catch (err) {
            console.log("⚠️ API fetch failed, falling back to local data:", err.message);
            
            // API failed: Try to use local cached data as fallback
            jsonData = await window.SochStorage.readLocalJsonData();
            if (jsonData) {
              useLocalData = true;
              console.log("✅ Using local cached data as fallback");
            } else {
              throw new Error("Unable to fetch fresh data and no local cache available");
            }
          }
        } else {
          // Offline: Use local cached data only
          console.log("📴 Offline mode: Using cached data...");
          window.SochUI.updateProgress("Loading from cache (offline mode)...");
          
          jsonData = await window.SochStorage.readLocalJsonData();
          if (jsonData) {
            useLocalData = true;
            console.log("✅ Using local cached data (offline mode)");
          } else {
            throw new Error("No local data available and device is offline. Please connect to internet for first-time setup.");
          }
        }
      } else {
        // Browser mode: Always fetch from API
        console.log("🌐 Browser mode: Fetching data from API...");
        const apiData = await window.SochNetwork.makeApiCall('json');
        jsonData = apiData.json;
        console.log("✅ Using API data (browser mode)");
      }

      // STEP 2: HANDLE HTML FILE (download vs cached)
      if (config.isCapacitor) {
        // Mobile mode: Check for cached HTML, download if needed
        
        const htmlExists = await this.checkLocalHtmlExists();
        
        if (!htmlExists && window.SochNetwork.isOnline) {
          console.log("📥 HTML not cached locally, downloading...");
          window.SochUI.updateProgress("Downloading flipbook interface...");
          await this.downloadAndSaveHtml();
        } else if (!htmlExists && !window.SochNetwork.isOnline) {
          throw new Error("No cached HTML available and device is offline. Please connect to internet for first-time setup.");
        }

        // STEP 3: DOWNLOAD MEDIA FILES (only if online and using fresh data)
        if (window.SochNetwork.isOnline && !useLocalData) {
          console.log("📥 Downloading media files...");
          await window.SochMedia.downloadMediaFiles(jsonData);
        } else {
          console.log("ℹ️ Skipping media downloads (offline or using cached data)");
        }

        // STEP 4: REPLACE URLS WITH LOCAL PATHS
        window.SochUI.updateProgress("Preparing content for offline use...");
        const modifiedJsonData = await window.SochMedia.replaceUrlsWithLocalPaths(jsonData);

        // STEP 5: READ LOCAL HTML FILE
        console.log("📄 Reading cached HTML file...");
        const { Filesystem } = config.getPlugins();
        const htmlContent = await Filesystem.readFile({
          path: `${config.APP_FOLDER}/html/flipbook.html`,
          directory: 'DOCUMENTS',
          encoding: 'utf8'
        });

        // STEP 6: MODIFY HTML FOR LOCAL VIDEO SUPPORT
        let modifiedHtml = this.modifyHtmlForLocalVideos(htmlContent.data, modifiedJsonData);

        // STEP 7: INJECT JSON DATA INTO HTML
        modifiedHtml = modifiedHtml.replace(
          /collections = \{\};/, // Find this placeholder in HTML
          `collections = ${JSON.stringify(modifiedJsonData.collections, null, 2)};` // Replace with actual data
        );

        // STEP 8: RENDER FLIPBOOK IN IFRAME
        const container = document.getElementById('flipbookContainer');
        if (container) {
          container.innerHTML = `
            <iframe id="flipbookFrame" 
                    style="width: 100%; height: 100vh; border: none;"
                    srcdoc="${modifiedHtml.replace(/"/g, '&quot;')}"
                    allow="autoplay; fullscreen; camera; microphone">
            </iframe>
          `;
          console.log("✅ Flipbook loaded successfully with local media files and video support");
          return true;
        }
      } else {
        // Browser mode: Load flipbook directly from API with remote URLs
        console.log("🌐 Browser mode: Loading flipbook with remote URLs...");
        
        const htmlContent = await this.downloadAndSaveHtml();
        
        // Inject JSON data into HTML
        const modifiedHtml = htmlContent.replace(
          /collections = \{\};/,
          `collections = ${JSON.stringify(jsonData.collections, null, 2)};`
        );
        
        // Render in browser
        const container = document.getElementById('flipbookContainer');
        if (container) {
          container.innerHTML = `
            <iframe id="flipbookFrame" 
                    style="width: 100%; height: 100vh; border: none;"
                    srcdoc="${modifiedHtml.replace(/"/g, '&quot;')}"
                    allow="autoplay; fullscreen">
            </iframe>
          `;
          console.log("✅ Flipbook loaded successfully (browser mode)");
          return true;
        }
      }
      
      return false;
    } catch (err) {
      console.error("❌ Failed to load flipbook:", err);
      
      // Show error message to user
      this.showErrorMessage(err.message);
      return false;
    }
  },

  /**
   * SHOW ERROR MESSAGE
   * Displays a user-friendly error message when flipbook fails to load.
   * Provides helpful suggestions based on online/offline status.
   * 
   * @param {string} errorMessage - The error message to display
   */
  showErrorMessage: function(errorMessage) {
    const container = document.getElementById('flipbookContainer');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: white; text-align: center; font-family: Arial, sans-serif; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <div style="background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; backdrop-filter: blur(10px); max-width: 500px;">
            <h2 style="margin-bottom: 20px; color: #fff;">❌ Unable to Load Collection</h2>
            <p style="margin-bottom: 20px; color: #fff; opacity: 0.9;">We couldn't load your digital collection at this time.</p>
            <p style="margin-bottom: 20px; font-size: 14px; color: #fff; opacity: 0.8; background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;">
              <strong>Error Details:</strong><br>${errorMessage}
            </p>
            <p style="font-size: 12px; color: #fff; opacity: 0.7;">
              ${window.SochNetwork.isOnline ? 
                'Please check your internet connection and try again.' : 
                'Please connect to internet for first-time setup, then the app will work offline.'}
            </p>
          </div>
        </div>
      `;
    }
  }
};

// Log successful module loading
console.log("✅ Flipbook module loaded");
