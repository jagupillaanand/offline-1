/**
 * FLIPBOOK.JS - Flipbook Management Module - PRODUCTION VERSION
 * 
 * This version converts file:// URLs to blob URLs for iframe compatibility
 */
window.SochFlipbook = {
  
  // Store active blob URLs for cleanup
  activeBlobUrls: new Set(),
  
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
      
      return true;
    } catch (err) {
      return false;
    }
  },
  
  /**
   * DOWNLOAD AND SAVE HTML FILE WITH IMMEDIATE PROCESSING
   */
  downloadAndSaveHtml: async function() {
    try {
      const htmlUrlData = await window.SochNetwork.makeApiCall('html_url');
      const htmlUrl = htmlUrlData.html_url;
      
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
        
        // Process the downloaded HTML file
        window.SochUI.updateProgress("Optimizing HTML for offline use...", true);
        await window.SochMedia.processHtmlAfterDownload();
        
        return true;
      } else {
        const response = await fetch(htmlUrl);
        const htmlContent = await response.text();
        return htmlContent;
      }
    } catch (err) {
      throw new Error(`HTML download failed: ${err.message}`);
    }
  },
  
  /**
   * CHECK LOCAL JSON EXISTS AND IS PROCESSED
   */
  checkLocalJsonExists: async function() {
    const config = window.SochConfig;
    
    if (!config.isCapacitor) return false;
    
    try {
      const jsonData = await window.SochStorage.readLocalJsonData();
      if (jsonData && jsonData.collections) {
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  },
  
  /**
   * CONVERT FILE URI TO BLOB URL
   */
  convertFileToBlobUrl: async function(fileUri) {
    try {
      const config = window.SochConfig;
      const { Filesystem } = config.getPlugins();
      
      // Extract the path from the file URI
      let path = fileUri;
      if (fileUri.startsWith('file://')) {
        path = fileUri.replace('file:///storage/emulated/0/Documents/', '');
      }
      
      // Read the file as base64
      const fileData = await Filesystem.readFile({
        path: path,
        directory: 'DOCUMENTS'
      });
      
      // Determine MIME type from extension
      let mimeType = 'application/octet-stream';
      if (fileUri.includes('.jpg') || fileUri.includes('.jpeg')) {
        mimeType = 'image/jpeg';
      } else if (fileUri.includes('.png')) {
        mimeType = 'image/png';
      } else if (fileUri.includes('.mp4')) {
        mimeType = 'video/mp4';
      } else if (fileUri.includes('.mov')) {
        mimeType = 'video/quicktime';
      }
      
      // Convert base64 to blob
      const base64Response = await fetch(`data:${mimeType};base64,${fileData.data}`);
      const blob = await base64Response.blob();
      
      // Create blob URL
      const blobUrl = URL.createObjectURL(blob);
      
      // Store for cleanup later
      this.activeBlobUrls.add(blobUrl);
      
      return blobUrl;
      
    } catch (err) {
      console.error(`Failed to convert file to blob: ${fileUri}`, err);
      return fileUri; // Return original if conversion fails
    }
  },
  
  /**
   * PROCESS JSON DATA TO CONVERT FILE URLS TO BLOB URLS
   */
  processJsonForBlobs: async function(jsonData) {
    const processedData = JSON.parse(JSON.stringify(jsonData));
    
    try {
      for (const collectionKey of Object.keys(processedData.collections)) {
        const collection = processedData.collections[collectionKey];
        
        // Convert collection image
        if (collection.collection_image_url && collection.collection_image_url.startsWith('file://')) {
          collection.collection_image_url = await this.convertFileToBlobUrl(collection.collection_image_url);
        }
        
        // Convert product images and videos
        if (collection.products && Array.isArray(collection.products)) {
          for (const product of collection.products) {
            // Convert product image
            if (product.image_url && product.image_url.startsWith('file://')) {
              product.image_url = await this.convertFileToBlobUrl(product.image_url);
            }
            
            // Convert product video
            if (product.video && product.video.startsWith('file://')) {
              product.video = await this.convertFileToBlobUrl(product.video);
            }
          }
        }
      }
      
      return processedData;
      
    } catch (err) {
      throw err;
    }
  },
  
  /**
   * CLEANUP BLOB URLS
   */
  cleanupBlobUrls: function() {
    if (this.activeBlobUrls && this.activeBlobUrls.size > 0) {
      for (const blobUrl of this.activeBlobUrls) {
        URL.revokeObjectURL(blobUrl);
      }
      this.activeBlobUrls.clear();
    }
  },
  
  /**
   * LOAD FLIPBOOK USING IFRAME WITH BLOB URLS
   */
  loadFlipbook: async function() {
    try {
      const config = window.SochConfig;
      let needsDownload = false;
      
      // STEP 1: CHECK IF WE HAVE LOCAL CONTENT FIRST
      const hasLocalJson = await this.checkLocalJsonExists();
      const hasLocalHtml = await this.checkLocalHtmlExists();
      
      // STEP 2: DECIDE STRATEGY BASED ON CONNECTIVITY AND LOCAL CONTENT
      if (!window.SochNetwork.isOnline) {
        // OFFLINE: Must use local content only
        window.SochUI.updateProgress("Loading from local storage (offline)...");
        
        if (hasLocalJson && hasLocalHtml) {
          // Continue with local content
        } else {
          throw new Error("No local content available and device is offline. Please connect to internet for first-time setup.");
        }
      } else {
        // ONLINE: Check versions and decide what to do
        if (hasLocalJson && hasLocalHtml) {
          // We have local content - check if updates are needed
          try {
            // Get current local JSON version
            const localVersion = await window.SochStorage.getCurrentJsonVersion();
            
            // Get remote JSON version
            const remoteVersionData = await window.SochNetwork.makeApiCall('json');
            const remoteVersion = remoteVersionData.json.version;
            
            if (localVersion === remoteVersion) {
              // No updates needed - use local content
              window.SochUI.updateProgress("Content is up to date - loading from local storage...");
            } else {
              // Updates needed - download fresh content
              window.SochUI.updateProgress("Updates found - downloading latest content...");
              needsDownload = true;
            }
          } catch (versionCheckErr) {
            // Use local content as fallback
          }
        } else {
          // No local content - must download
          window.SochUI.updateProgress("First time setup - downloading content...");
          needsDownload = true;
        }
        
        // Download fresh content if needed
        if (needsDownload) {
          try {
            // Download JSON and process it
            const apiData = await window.SochNetwork.makeApiCall('json');
            const jsonData = apiData.json;
            
            // Save the original JSON first
            await window.SochStorage.saveJsonData(jsonData);
            
            // Download and process media files
            await window.SochMedia.downloadMediaFiles(jsonData);
            
            // Download and process HTML
            await this.downloadAndSaveHtml();
            
          } catch (downloadErr) {
            if (hasLocalJson && hasLocalHtml) {
              // Fall back to local content
            } else {
              throw new Error("Download failed and no local content available");
            }
          }
        }
      }
      
      // STEP 3: VERIFY WE HAVE THE REQUIRED LOCAL FILES
      const finalHtmlCheck = await this.checkLocalHtmlExists();
      const finalJsonCheck = await this.checkLocalJsonExists();
      
      if (!finalHtmlCheck || !finalJsonCheck) {
        throw new Error("Required local files not available");
      }
      
      // STEP 4: READ THE LOCAL JSON DATA
      const jsonData = await window.SochStorage.readLocalJsonData();
      
      if (!jsonData || !jsonData.collections) {
        throw new Error("Invalid JSON data structure");
      }
      
      // STEP 5: CONVERT FILE URLS TO BLOB URLS
      window.SochUI.updateProgress("Processing media files for display...");
      const processedJsonData = await this.processJsonForBlobs(jsonData);
      
      // STEP 6: LOAD THE HTML IN AN IFRAME
      window.SochUI.updateProgress("Loading flipbook interface...");
      
      const { Filesystem } = config.getPlugins();
      const htmlContent = await Filesystem.readFile({
        path: `${config.APP_FOLDER}/html/flipbook.html`,
        directory: 'DOCUMENTS',
        encoding: 'utf8'
      });
      
      // Create the flipbook container
      const container = document.getElementById('flipbookContainer');
      if (container) {
        // Create iframe with blob URL
        const blob = new Blob([htmlContent.data], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        
        container.innerHTML = `
          <iframe id="flipbookFrame" 
                  style="width: 100%; height: 100vh; border: none;"
                  src="${blobUrl}"
                  allow="autoplay; fullscreen">
          </iframe>
        `;
        
        // Wait for iframe to load, then send the processed JSON data
        const iframe = document.getElementById('flipbookFrame');
        iframe.onload = () => {
          // Send the processed JSON data with blob URLs to the iframe
          setTimeout(() => {
            iframe.contentWindow.postMessage({
              type: 'loadCollections',
              collections: processedJsonData.collections
            }, '*');
            
            // Clean up blob URL
            URL.revokeObjectURL(blobUrl);
          }, 500);
        };
        
        // Show the flipbook container
        window.SochUI.showFlipbook();
        
        return true;
      }
      
      return false;
      
    } catch (err) {
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

console.log("✅ Flipbook module loaded");