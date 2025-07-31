/**
 * FLIPBOOK.JS - Flipbook Management Module with ON-SCREEN VIDEO DEBUGGING
 * 
 * This version shows all video debug information directly on the screen
 */

window.SochFlipbook = {

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
        🎥 VIDEO DEBUG CONSOLE
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
    }

    // Also log to regular console
    console.log(`[VIDEO DEBUG] ${message}`);
  },

  /**
   * CHECK IF HTML FILE EXISTS LOCALLY
   */
  checkLocalHtmlExists: async function() {
    const config = window.SochConfig;
    
    if (!config.isCapacitor) return false;
    
    try {
      const { Filesystem } = config.getPlugins();
      
      await Filesystem.readFile({
        path: `${config.APP_FOLDER}/html/flipbook.html`,
        directory: 'DOCUMENTS',
        encoding: 'utf8'
      });
      
      this.logToScreen("✅ Local HTML file found in cache", 'success');
      return true;
    } catch (err) {
      this.logToScreen("ℹ️ Local HTML file not found - will need to download", 'warning');
      return false;
    }
  },

  /**
   * DOWNLOAD AND SAVE HTML FILE
   */
  downloadAndSaveHtml: async function() {
    try {
      this.logToScreen("📥 Downloading latest flipbook HTML...", 'info');
      
      const htmlUrlData = await window.SochNetwork.makeApiCall('html_url');
      const htmlUrl = htmlUrlData.html_url;
      
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
        
        this.logToScreen("✅ HTML file downloaded and cached locally", 'success');
        return true;
      } else {
        const response = await fetch(htmlUrl);
        const htmlContent = await response.text();
        
        this.logToScreen("✅ HTML content fetched for browser use", 'success');
        return htmlContent;
      }
    } catch (err) {
      this.logToScreen(`❌ Failed to download HTML: ${err.message}`, 'error');
      throw new Error(`HTML download failed: ${err.message}`);
    }
  },

  /**
   * DEBUG VIDEO FILES - CHECK WHAT'S ACTUALLY IN THE VIDEOS FOLDER
   */
  debugVideoFiles: async function() {
    const config = window.SochConfig;
    
    if (!config.isCapacitor) {
      this.logToScreen("🌐 Browser mode - skipping video debug", 'warning');
      return;
    }

    try {
      this.logToScreen("🔍 === CHECKING VIDEO FILES ===", 'info');
      const { Filesystem } = config.getPlugins();
      
      // Check if videos folder exists
      try {
        const videoDir = await Filesystem.readdir({
          path: `${config.APP_FOLDER}/videos`,
          directory: 'DOCUMENTS'
        });
        
        this.logToScreen(`📁 Videos folder has ${videoDir.files.length} files`, 'info');
        
        let videoFileCount = 0;
        videoDir.files.forEach((file, index) => {
          if (file.type === 'file' && file.name.endsWith('.mp4')) {
            videoFileCount++;
            this.logToScreen(`🎥 Video ${videoFileCount}: ${file.name} (${file.size} bytes)`, 'success');
          }
        });
        
        if (videoFileCount === 0) {
          this.logToScreen("❌ NO VIDEO FILES FOUND!", 'error');
        }
        
        // Try to get URI for first video file
        for (const file of videoDir.files) {
          if (file.type === 'file' && file.name.endsWith('.mp4')) {
            try {
              const fileUri = await Filesystem.getUri({
                directory: 'DOCUMENTS',
                path: `${config.APP_FOLDER}/videos/${file.name}`,
              });
              this.logToScreen(`📄 Video URI: ${fileUri.uri}`, 'info');
              break; // Only show first one to save space
            } catch (uriErr) {
              this.logToScreen(`❌ Failed to get URI for ${file.name}: ${uriErr.message}`, 'error');
            }
          }
        }
        
      } catch (dirErr) {
        this.logToScreen(`❌ Failed to read videos directory: ${dirErr.message}`, 'error');
      }
      
    } catch (err) {
      this.logToScreen(`❌ Video debug failed: ${err.message}`, 'error');
    }
  },

  /**
   * DEBUG JSON DATA - SEE WHAT VIDEO URLS ARE IN THE DATA
   */
  debugJsonVideoUrls: function(jsonData, label) {
    this.logToScreen(`📄 === ${label} ===`, 'info');
    
    const collections = jsonData.collections;
    let videoCount = 0;
    
    Object.keys(collections).forEach(collectionKey => {
      const collection = collections[collectionKey];
      
      if (collection.products && Array.isArray(collection.products)) {
        collection.products.forEach(product => {
          if (product.video) {
            videoCount++;
            const isFileUrl = product.video.startsWith('file://');
            const isHttpUrl = product.video.startsWith('http');
            const isCapacitorUrl = product.video.includes('_capacitor_file_');
            
            this.logToScreen(`🎥 ${product.style_code}: ${product.video.substring(0, 50)}...`, 'info');
            this.logToScreen(`   Type: ${isFileUrl ? 'FILE' : isHttpUrl ? 'HTTP' : isCapacitorUrl ? 'CAPACITOR' : 'OTHER'}`, 'info');
          }
        });
      }
    });
    
    this.logToScreen(`📊 Total videos in JSON: ${videoCount}`, 'info');
  },

  /**
   * INJECT ON-SCREEN VIDEO DEBUG SCRIPT
   */
  injectVideoDebugScript: function(htmlContent) {
    const videoScript = `
    <script>
    // Create debug overlay inside iframe
    function createIframeDebugOverlay() {
      const debugOverlay = document.createElement('div');
      debugOverlay.id = 'iframeVideoDebug';
      debugOverlay.style.cssText = \`
        position: fixed;
        top: 50px;
        right: 10px;
        width: 300px;
        max-height: 70vh;
        background: rgba(255, 0, 0, 0.9);
        color: white;
        font-family: monospace;
        font-size: 10px;
        padding: 10px;
        border-radius: 5px;
        overflow-y: auto;
        z-index: 10000;
        border: 2px solid red;
      \`;
      
      debugOverlay.innerHTML = \`
        <div style="color: yellow; font-weight: bold; margin-bottom: 5px;">
          🎥 IFRAME VIDEO DEBUG
          <button onclick="this.parentElement.parentElement.style.display='none'" 
                  style="float: right; background: black; color: white; border: none; padding: 2px 5px;">✕</button>
        </div>
        <div id="iframeDebugContent" style="font-size: 9px; line-height: 1.2;"></div>
      \`;
      
      document.body.appendChild(debugOverlay);
      return debugOverlay;
    }
    
    function logToIframeDebug(message, type = 'info') {
      const colors = {
        info: 'white',
        warning: 'yellow',
        error: 'red',
        success: 'lightgreen'
      };
      
      let debugContent = document.getElementById('iframeDebugContent');
      if (!debugContent) {
        createIframeDebugOverlay();
        debugContent = document.getElementById('iframeDebugContent');
      }
      
      if (debugContent) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.style.color = colors[type] || colors.info;
        logEntry.style.marginBottom = '2px';
        logEntry.innerHTML = \`[\${timestamp}] \${message}\`;
        
        debugContent.appendChild(logEntry);
        debugContent.scrollTop = debugContent.scrollHeight;
      }
      
      console.log(\`[IFRAME VIDEO DEBUG] \${message}\`);
    }
    
    function enhanceVideoHandling() {
      logToIframeDebug("🎥 Starting video enhancement...", 'info');
      
      // Create debug overlay
      createIframeDebugOverlay();
      
      setTimeout(() => {
        debugAllVideos();
      }, 2000);
      
      // Override flipbook generation if available
      if (typeof generateFlipbook !== 'undefined') {
        const originalGenerateFlipbook = generateFlipbook;
        
        generateFlipbook = function(collection, collectionKey) {
          logToIframeDebug(\`🎥 Generating flipbook for: \${collectionKey}\`, 'info');
          
          const result = originalGenerateFlipbook.call(this, collection, collectionKey);
          
          setTimeout(() => {
            logToIframeDebug("🔄 Post-flipbook video debug", 'info');
            debugAllVideos();
            enhanceAllVideos();
          }, 3000);
          
          return result;
        };
      }
    }
    
    function debugAllVideos() {
      logToIframeDebug("🔍 === IFRAME VIDEO ANALYSIS ===", 'info');
      
      const allIframes = document.querySelectorAll('iframe');
      const allVideos = document.querySelectorAll('video');
      const allVideoPages = document.querySelectorAll('.video-page');
      
      logToIframeDebug(\`📊 Elements: \${allIframes.length} iframes, \${allVideos.length} videos, \${allVideoPages.length} video pages\`, 'info');
      
      // Debug video pages
      allVideoPages.forEach((page, index) => {
        logToIframeDebug(\`📄 Video Page \${index + 1}:\`, 'info');
        const pageIframes = page.querySelectorAll('iframe');
        const pageVideos = page.querySelectorAll('video');
        logToIframeDebug(\`   Has \${pageIframes.length} iframes, \${pageVideos.length} videos\`, 'info');
        
        pageIframes.forEach((iframe, iIndex) => {
          logToIframeDebug(\`   Iframe \${iIndex + 1}: src=\${iframe.src || 'NONE'}\`, 'warning');
          if (iframe.srcdoc) {
            const hasVideo = iframe.srcdoc.includes('.mp4');
            logToIframeDebug(\`   Iframe \${iIndex + 1}: srcdoc has video=\${hasVideo}\`, hasVideo ? 'success' : 'error');
            if (hasVideo) {
              const videoMatch = iframe.srcdoc.match(/src="([^"]+\.mp4[^"]*)"/);
              if (videoMatch) {
                logToIframeDebug(\`   Found video URL: \${videoMatch[1]}\`, 'success');
              }
            }
          }
        });
      });
    }
    
    function enhanceAllVideos() {
      logToIframeDebug("🔄 Starting video enhancement...", 'info');
      
      const videoPages = document.querySelectorAll('.video-page');
      
      videoPages.forEach((page, pageIndex) => {
        const iframes = page.querySelectorAll('iframe');
        
        iframes.forEach((iframe, iframeIndex) => {
          let videoSrc = iframe.src;
          
          if (!videoSrc && iframe.srcdoc) {
            const srcDocMatch = iframe.srcdoc.match(/src="([^"]+\.mp4[^"]*)"/);
            if (srcDocMatch) {
              videoSrc = srcDocMatch[1];
              logToIframeDebug(\`✅ Found video in srcdoc: \${videoSrc}\`, 'success');
            }
          }
          
          if (videoSrc && videoSrc.includes('.mp4')) {
            logToIframeDebug(\`🎥 Creating video for: \${videoSrc}\`, 'info');
            
            const video = document.createElement('video');
            video.src = videoSrc;
            video.controls = true;
            video.autoplay = false;
            video.loop = true;
            video.muted = true;
            
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.maxHeight = '90vh';
            video.style.objectFit = 'contain';
            video.style.backgroundColor = '#000';
            video.style.border = '3px solid lime';
            
            video.addEventListener('loadedmetadata', () => {
              logToIframeDebug(\`✅ Video loaded: \${videoSrc}\`, 'success');
            });
            
            video.addEventListener('error', (e) => {
              logToIframeDebug(\`❌ Video error: \${video.error ? video.error.code : 'Unknown'}\`, 'error');
              logToIframeDebug(\`❌ Source: \${videoSrc}\`, 'error');
              
              // Show detailed error on the video element
              const errorDisplay = document.createElement('div');
              errorDisplay.style.cssText = \`
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                background: red;
                color: white;
                text-align: center;
                padding: 20px;
                font-size: 12px;
              \`;
              
              errorDisplay.innerHTML = \`
                <div>
                  <h3>🚨 VIDEO ERROR</h3>
                  <p>Error Code: \${video.error ? video.error.code : 'Unknown'}</p>
                  <p>Source: \${videoSrc}</p>
                  <p>File: \${videoSrc.split('/').pop()}</p>
                  <p>Ready State: \${video.readyState}</p>
                  <p>Network State: \${video.networkState}</p>
                </div>
              \`;
              
              video.parentNode.replaceChild(errorDisplay, video);
            });
            
            iframe.parentNode.replaceChild(video, iframe);
            logToIframeDebug(\`✅ Replaced iframe with video element\`, 'success');
          }
        });
      });
    }
    
    // Initialize
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', enhanceVideoHandling);
    } else {
      enhanceVideoHandling();
    }
    
    // Periodic checks
    let checkCount = 0;
    const checker = setInterval(() => {
      checkCount++;
      logToIframeDebug(\`🔄 Check #\${checkCount}\`, 'info');
      debugAllVideos();
      
      if (checkCount >= 5) {
        clearInterval(checker);
        logToIframeDebug("🛑 Stopping periodic checks", 'warning');
      }
    }, 4000);
    
    </script>
    `;
    
    return htmlContent.replace('</body>', videoScript + '</body>');
  },

  /**
   * LOAD FLIPBOOK WITH ON-SCREEN VIDEO DEBUGGING
   */
  loadFlipbook: async function() {
    try {
      // Create debug console first
      this.createDebugConsole();
      this.logToScreen("📖 Starting flipbook loading with on-screen debugging...", 'info');
      
      const config = window.SochConfig;
      let jsonData;
      let useLocalData = false;
      
      // STEP 1: GET JSON DATA
      if (config.isCapacitor) {
        if (window.SochNetwork.isOnline) {
          try {
            this.logToScreen("🌐 Online: Fetching latest data...", 'info');
            window.SochUI.updateProgress("Fetching latest collection data...");
            
            const apiData = await window.SochNetwork.makeApiCall('json');
            jsonData = apiData.json;
            
            await window.SochStorage.saveJsonData(jsonData);
            this.logToScreen("✅ Using fresh API data", 'success');
          } catch (err) {
            this.logToScreen(`⚠️ API failed: ${err.message}`, 'warning');
            jsonData = await window.SochStorage.readLocalJsonData();
            if (jsonData) {
              useLocalData = true;
              this.logToScreen("✅ Using local cached data as fallback", 'success');
            } else {
              throw new Error("Unable to fetch fresh data and no local cache available");
            }
          }
        } else {
          this.logToScreen("📴 Offline: Using cached data...", 'warning');
          window.SochUI.updateProgress("Loading from cache (offline mode)...");
          
          jsonData = await window.SochStorage.readLocalJsonData();
          if (jsonData) {
            useLocalData = true;
            this.logToScreen("✅ Using local cached data (offline mode)", 'success');
          } else {
            throw new Error("No local data available and device is offline. Please connect to internet for first-time setup.");
          }
        }
      } else {
        this.logToScreen("🌐 Browser mode: Fetching from API...", 'info');
        const apiData = await window.SochNetwork.makeApiCall('json');
        jsonData = apiData.json;
        this.logToScreen("✅ Using API data (browser mode)", 'success');
      }

      // DEBUG: Check what videos are in the JSON
      this.debugJsonVideoUrls(jsonData, "ORIGINAL JSON VIDEOS");

      // STEP 2: HANDLE HTML FILE
      if (config.isCapacitor) {
        const htmlExists = await this.checkLocalHtmlExists();
        
        if (!htmlExists && window.SochNetwork.isOnline) {
          await this.downloadAndSaveHtml();
        } else if (!htmlExists && !window.SochNetwork.isOnline) {
          throw new Error("No cached HTML available and device is offline.");
        }

        // STEP 3: DOWNLOAD MEDIA FILES
        if (window.SochNetwork.isOnline && !useLocalData) {
          this.logToScreen("📥 Downloading media files...", 'info');
          await window.SochMedia.downloadMediaFiles(jsonData);
        } else {
          this.logToScreen("ℹ️ Skipping media downloads", 'warning');
        }

        // DEBUG: Check what video files are actually downloaded
        await this.debugVideoFiles();

        // STEP 4: REPLACE URLS WITH LOCAL PATHS
        this.logToScreen("🔄 Replacing URLs with local paths...", 'info');
        window.SochUI.updateProgress("Preparing offline content...");
        const modifiedJsonData = await window.SochMedia.replaceUrlsWithLocalPaths(jsonData);

        // DEBUG: Check URLs after replacement
        this.debugJsonVideoUrls(modifiedJsonData, "MODIFIED JSON VIDEOS");

        // STEP 5: READ AND MODIFY HTML
        this.logToScreen("📄 Reading HTML file...", 'info');
        const { Filesystem } = config.getPlugins();
        const htmlContent = await Filesystem.readFile({
          path: `${config.APP_FOLDER}/html/flipbook.html`,
          directory: 'DOCUMENTS',
          encoding: 'utf8'
        });

        // STEP 6: INJECT DEBUG SCRIPT AND DATA
        this.logToScreen("🎥 Injecting video debug script...", 'info');
        let modifiedHtml = this.injectVideoDebugScript(htmlContent.data);

        modifiedHtml = modifiedHtml.replace(
          /collections = \{\};/,
          `collections = ${JSON.stringify(modifiedJsonData.collections, null, 2)};`
        );

        // STEP 7: RENDER FLIPBOOK
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
          this.logToScreen("✅ Flipbook loaded with on-screen debugging", 'success');
          return true;
        }
      } else {
        // Browser mode
        this.logToScreen("🌐 Browser mode loading...", 'info');
        
        const htmlContent = await this.downloadAndSaveHtml();
        
        const modifiedHtml = htmlContent.replace(
          /collections = \{\};/,
          `collections = ${JSON.stringify(jsonData.collections, null, 2)};`
        );
        
        const container = document.getElementById('flipbookContainer');
        if (container) {
          container.innerHTML = `
            <iframe id="flipbookFrame" 
                    style="width: 100%; height: 100vh; border: none;"
                    srcdoc="${modifiedHtml.replace(/"/g, '&quot;')}"
                    allow="autoplay; fullscreen">
            </iframe>
          `;
          this.logToScreen("✅ Flipbook loaded (browser mode)", 'success');
          return true;
        }
      }
      
      return false;
    } catch (err) {
      this.logToScreen(`❌ Failed to load flipbook: ${err.message}`, 'error');
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
          </div>
        </div>
      `;
    }
  }
};

console.log("✅ Flipbook module loaded with ON-SCREEN video debugging");
