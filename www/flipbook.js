/**
 * FLIPBOOK.JS - Flipbook Management Module with Correct Flow
 * 
 * CORRECTED FLOW:
 * 1. Always load from local storage first (online or offline)
 * 2. Only check versions when online + app opens
 * 3. If versions changed: download all content, then show from local storage
 * 4. If versions unchanged: skip downloads, show from local storage immediately
 */
window.SochFlipbook = {
  
  // Track if we've already checked versions this session
  hasCheckedVersionsThisSession: false,
  
  /**
   * CREATE ON-SCREEN DEBUG CONSOLE
   */
  createDebugConsole: function() {
    // Remove existing debug console if any
    const existingConsole = document.getElementById('videoDebugConsole');
    if (existingConsole) {
      existingConsole.remove();
    }
    
    // Create debug console overlay
    const debugConsole = document.createElement('div');
    debugConsole.id = 'videoDebugConsole';
    debugConsole.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      width: 350px;
      max-height: 80vh;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: monospace;
      font-size: 10px;
      padding: 10px;
      border-radius: 5px;
      overflow-y: auto;
      z-index: 10000;
      border: 2px solid #00ff00;
    `;
    debugConsole.innerHTML = `
      <div style="color: #ffff00; font-weight: bold; margin-bottom: 5px;">
        🎥 FLIPBOOK DEBUG CONSOLE
        <button onclick="this.parentElement.parentElement.style.display='none'" 
                style="float: right; background: red; color: white; border: none; padding: 2px 5px;">✕</button>
      </div>
      <div id="debugContent" style="font-size: 9px; line-height: 1.2;"></div>
    `;
    document.body.appendChild(debugConsole);
    return debugConsole;
  },
  
  /**
   * LOG TO ON-SCREEN CONSOLE
   */
  logToScreen: function(message, type = 'info') {
    const colors = {
      info: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      success: '#00ffff'
    };
    const debugContent = document.getElementById('debugContent');
    if (debugContent) {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = document.createElement('div');
      logEntry.style.color = colors[type] || colors.info;
      logEntry.style.marginBottom = '2px';
      logEntry.innerHTML = `[${timestamp}] ${message}`;
      
      debugContent.appendChild(logEntry);
      debugContent.scrollTop = debugContent.scrollHeight;
      
      // Limit logs to prevent memory issues
      while (debugContent.children.length > 100) {
        debugContent.removeChild(debugContent.firstChild);
      }
    }
    // Also log to regular console
    console.log(`[FLIPBOOK] ${message}`);
  },
  
  /**
   * CHECK IF WE HAVE LOCAL DATA AVAILABLE
   */
  checkLocalDataExists: async function() {
    const config = window.SochConfig;
    
    if (!config.isCapacitor) {
      this.logToScreen("🌐 Browser mode - no local storage check needed", 'info');
      return false;
    }
    
    try {
      // Check if we have local JSON data
      const localJsonData = await window.SochStorage.readLocalJsonData();
      if (!localJsonData) {
        this.logToScreen("❌ No local JSON data found", 'warning');
        return false;
      }
      
      // Check if we have local HTML file
      const { Filesystem } = config.getPlugins();
      await Filesystem.readFile({
        path: `${config.APP_FOLDER}/html/flipbook.html`,
        directory: 'DOCUMENTS',
        encoding: 'utf8'
      });
      
      this.logToScreen("✅ Local data exists - JSON and HTML files found", 'success');
      return true;
      
    } catch (err) {
      this.logToScreen(`❌ Local data check failed: ${err.message}`, 'error');
      return false;
    }
  },
  
  /**
   * CHECK IF VERSIONS HAVE CHANGED (ONLY WHEN ONLINE)
   */
  checkIfVersionsChanged: async function() {
    try {
      this.logToScreen("🔍 Checking if versions have changed...", 'info');
      
      // Get current versions from API
      const [htmlUrlData, jsonData] = await Promise.all([
        window.SochNetwork.makeApiCall('html_url'),
        window.SochNetwork.makeApiCall('json')
      ]);
      
      const currentHtmlUrl = htmlUrlData.html_url;
      const currentJsonVersion = JSON.stringify(jsonData.json); // Simple version check
      
      // Get stored versions
      const config = window.SochConfig;
      let storedHtmlUrl = '';
      let storedJsonVersion = '';
      
      if (config.isCapacitor) {
        try {
          const { Preferences } = config.getPlugins();
          
          const htmlResult = await Preferences.get({ key: 'stored_html_url' });
          const jsonResult = await Preferences.get({ key: 'stored_json_version' });
          
          storedHtmlUrl = htmlResult.value || '';
          storedJsonVersion = jsonResult.value || '';
        } catch (err) {
          this.logToScreen(`⚠️ Could not read stored versions: ${err.message}`, 'warning');
        }
      }
      
      // Compare versions
      const htmlChanged = currentHtmlUrl !== storedHtmlUrl;
      const jsonChanged = currentJsonVersion !== storedJsonVersion;
      
      this.logToScreen(`📊 Version check results:`, 'info');
      this.logToScreen(`   HTML changed: ${htmlChanged}`, htmlChanged ? 'warning' : 'success');
      this.logToScreen(`   JSON changed: ${jsonChanged}`, jsonChanged ? 'warning' : 'success');
      
      return {
        changed: htmlChanged || jsonChanged,
        htmlChanged,
        jsonChanged,
        currentHtmlUrl,
        currentJsonVersion,
        apiData: { htmlUrlData, jsonData }
      };
      
    } catch (err) {
      this.logToScreen(`❌ Version check failed: ${err.message}`, 'error');
      throw new Error(`Version check failed: ${err.message}`);
    }
  },
  
  /**
   * DOWNLOAD AND UPDATE ALL CONTENT
   */
  downloadAndUpdateContent: async function(apiData) {
    try {
      this.logToScreen("📥 Starting content download and update...", 'info');
      window.SochUI.updateProgress("Downloading latest content...");
      
      const { htmlUrlData, jsonData } = apiData;
      const config = window.SochConfig;
      
      // Step 1: Download and save HTML
      this.logToScreen("📄 Downloading HTML file...", 'info');
      await this.downloadAndSaveHtml(htmlUrlData.html_url);
      
      // Step 2: Save JSON data
      this.logToScreen("💾 Saving JSON data...", 'info');
      await window.SochStorage.saveJsonData(jsonData.json);
      
      // Step 3: Download all media files
      this.logToScreen("🎬 Downloading media files...", 'info');
      window.SochUI.updateProgress("Downloading images and videos...");
      await window.SochMedia.downloadMediaFiles(jsonData.json);
      
      // Step 4: Store version information
      if (config.isCapacitor) {
        try {
          const { Preferences } = config.getPlugins();
          
          await Preferences.set({
            key: 'stored_html_url',
            value: htmlUrlData.html_url
          });
          
          await Preferences.set({
            key: 'stored_json_version',
            value: JSON.stringify(jsonData.json)
          });
          
          this.logToScreen("✅ Version information stored", 'success');
        } catch (err) {
          this.logToScreen(`⚠️ Could not store version info: ${err.message}`, 'warning');
        }
      }
      
      this.logToScreen("✅ Content download and update completed", 'success');
      
    } catch (err) {
      this.logToScreen(`❌ Content download failed: ${err.message}`, 'error');
      throw new Error(`Content download failed: ${err.message}`);
    }
  },
  
  /**
   * DOWNLOAD AND SAVE HTML FILE
   */
  downloadAndSaveHtml: async function(htmlUrl) {
    try {
      this.logToScreen(`🔗 HTML URL: ${htmlUrl}`, 'info');
      
      const config = window.SochConfig;
      
      if (config.isCapacitor) {
        const { Filesystem, FileTransfer } = config.getPlugins();
        
        const fileUri = await Filesystem.getUri({
          directory: 'DOCUMENTS',
          path: `${config.APP_FOLDER}/html/flipbook.html`,
        });
        
        await FileTransfer.downloadFile({
          url: htmlUrl,
          path: fileUri.uri,
        });
        
        this.logToScreen("✅ HTML file downloaded and saved", 'success');
      } else {
        // Browser mode - fetch and return content
        const response = await fetch(htmlUrl);
        const htmlContent = await response.text();
        this.logToScreen("✅ HTML content fetched (browser mode)", 'success');
        return htmlContent;
      }
    } catch (err) {
      this.logToScreen(`❌ Failed to download HTML: ${err.message}`, 'error');
      throw new Error(`HTML download failed: ${err.message}`);
    }
  },
  
  /**
   * LOAD FLIPBOOK FROM LOCAL STORAGE
   */
  loadFlipbookFromLocalStorage: async function() {
    try {
      this.logToScreen("📖 Loading flipbook from local storage...", 'info');
      window.SochUI.updateProgress("Loading from local storage...");
      
      const config = window.SochConfig;
      
      // Step 1: Read local JSON data
      this.logToScreen("📄 Reading local JSON data...", 'info');
      const jsonData = await window.SochStorage.readLocalJsonData();
      if (!jsonData) {
        throw new Error("No local JSON data available");
      }
      
      // Step 2: Replace URLs with local paths
      this.logToScreen("🔄 Converting URLs to local paths...", 'info');
      const modifiedJsonData = await window.SochMedia.replaceUrlsWithLocalPaths(jsonData);
      
      // Step 3: Read HTML file and inject data
      let htmlContent;
      if (config.isCapacitor) {
        this.logToScreen("📄 Reading local HTML file...", 'info');
        const { Filesystem } = config.getPlugins();
        const htmlFile = await Filesystem.readFile({
          path: `${config.APP_FOLDER}/html/flipbook.html`,
          directory: 'DOCUMENTS',
          encoding: 'utf8'
        });
        htmlContent = htmlFile.data;
      } else {
        // Browser mode - fetch from API
        this.logToScreen("🌐 Browser mode - fetching HTML from API...", 'info');
        const htmlUrlData = await window.SochNetwork.makeApiCall('html_url');
        htmlContent = await this.downloadAndSaveHtml(htmlUrlData.html_url);
      }
      
      // Step 4: Inject JSON data into HTML
      this.logToScreen("💉 Injecting JSON data into HTML...", 'info');
      const jsonString = JSON.stringify(modifiedJsonData.collections, null, 2);
      const modifiedHtml = htmlContent.replace(
        /collections = \{\};/,
        `collections = ${jsonString};`
      );
      
      // Step 5: Render flipbook
      this.logToScreen("🎬 Rendering flipbook...", 'info');
      const container = document.getElementById('flipbookContainer');
      if (container) {
        container.innerHTML = `
          <iframe id="flipbookFrame" 
                  style="width: 100%; height: 100vh; border: none;"
                  srcdoc="${modifiedHtml.replace(/"/g, '&quot;')}"
                  allow="autoplay; fullscreen; camera; microphone"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals">
          </iframe>
        `;
        
        this.logToScreen("✅ Flipbook loaded successfully from local storage", 'success');
        window.SochUI.updateProgress("Ready!");
        return true;
      }
      
      return false;
      
    } catch (err) {
      this.logToScreen(`❌ Failed to load from local storage: ${err.message}`, 'error');
      throw new Error(`Local storage load failed: ${err.message}`);
    }
  },
  
  /**
   * MAIN LOAD FLIPBOOK FUNCTION - IMPLEMENTS YOUR EXACT FLOW
   */
  loadFlipbook: async function() {
    try {
      // Create debug console
      this.createDebugConsole();
      this.logToScreen("🚀 Starting flipbook load with correct flow...", 'info');
      
      const config = window.SochConfig;
      const isOnline = window.SochNetwork.isOnline;
      
      this.logToScreen(`📱 Platform: ${config.isCapacitor ? 'Mobile (Capacitor)' : 'Browser'}`, 'info');
      this.logToScreen(`🌐 Network: ${isOnline ? 'Online' : 'Offline'}`, 'info');
      this.logToScreen(`📊 Session check: ${this.hasCheckedVersionsThisSession ? 'Already checked' : 'First time'}`, 'info');
      
      // STEP 1: Check if we have local data
      const hasLocalData = await this.checkLocalDataExists();
      
      if (!hasLocalData) {
        // No local data - must be first time setup
        this.logToScreen("🆕 First time setup - no local data found", 'warning');
        
        if (!isOnline) {
          throw new Error("First time setup requires internet connection. Please connect to internet and try again.");
        }
        
        // Force download everything for first time
        this.logToScreen("📥 First time - downloading all content...", 'info');
        const versionCheck = await this.checkIfVersionsChanged();
        await this.downloadAndUpdateContent(versionCheck.apiData);
        this.hasCheckedVersionsThisSession = true;
        
        // Now load from local storage
        return await this.loadFlipbookFromLocalStorage();
      }
      
      // STEP 2: We have local data - check if we need to update (only when online + first time this session)
      if (isOnline && !this.hasCheckedVersionsThisSession) {
        this.logToScreen("🔍 Online + first session - checking for updates...", 'info');
        
        try {
          const versionCheck = await this.checkIfVersionsChanged();
          this.hasCheckedVersionsThisSession = true;
          
          if (versionCheck.changed) {
            this.logToScreen("🆙 Updates found - downloading new content...", 'warning');
            await this.downloadAndUpdateContent(versionCheck.apiData);
          } else {
            this.logToScreen("✅ No updates needed - content is current", 'success');
          }
        } catch (versionErr) {
          this.logToScreen(`⚠️ Version check failed, using local data: ${versionErr.message}`, 'warning');
        }
      } else if (!isOnline) {
        this.logToScreen("📴 Offline mode - skipping version check", 'info');
      } else {
        this.logToScreen("✅ Already checked versions this session - skipping", 'info');
      }
      
      // STEP 3: Always load from local storage
      this.logToScreen("📖 Loading content from local storage...", 'info');
      return await this.loadFlipbookFromLocalStorage();
      
    } catch (err) {
      this.logToScreen(`❌ Flipbook load failed: ${err.message}`, 'error');
      this.showErrorMessage(err.message);
      return false;
    }
  },
  
  /**
   * SHOW ERROR MESSAGE
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
            <button onclick="window.SochFlipbook.loadFlipbook()" style="background: white; color: #667eea; border: none; padding: 12px 24px; border-radius: 20px; font-weight: bold; margin-top: 20px; cursor: pointer;">
              Try Again
            </button>
          </div>
        </div>
      `;
    }
  }
};

console.log("✅ Flipbook module loaded with correct offline-first flow");