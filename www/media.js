/**
 * MEDIA.JS - Media File Management Module
 * 
 * This file handles all media-related operations including:
 * - Downloading images and videos from remote URLs
 * - Progress tracking during downloads
 * - Duplicate prevention for same URLs
 * - URL replacement (remote to local paths)
 * - Media file organization and cleanup
 * 
 * Dependencies: config.js, storage.js (must be loaded first)
 */

window.SochMedia = {

  /**
   * SHOW PROGRESS BAR
   * Displays a visual progress bar in the UI during file downloads.
   * Updates both console logs and user interface with download progress.
   * 
   * @param {number} current - Current number of files downloaded
   * @param {number} total - Total number of files to download
   * @param {string} message - Progress message to display
   */
  showProgressBar: function(current, total, message) {
    // Calculate percentage completed
    const percentage = Math.round((current / total) * 100);
    
    // Create visual progress bar using Unicode characters
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    
    // Log to console for debugging
    console.log(`📊 ${message} ${current}/${total} (${percentage}%)`);
    console.log(`[${progressBar}]`);
    
    // Update UI with visual progress bar
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="text-align: center;">
          <div style="margin-bottom: 10px; font-weight: 600;">${message}</div>
          <div style="margin-bottom: 8px; color: #666;">${current}/${total} files (${percentage}%)</div>
          <div style="width: 100%; background: #f0f0f0; border-radius: 10px; overflow: hidden; height: 12px;">
            <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s ease; border-radius: 10px;"></div>
          </div>
        </div>
      `;
    }
  },

  /**
   * EXTRACT UNIQUE MEDIA FILES FROM JSON
   * Analyzes the JSON data to create a map of unique media files to download.
   * Prevents downloading the same URL multiple times even if it appears
   * in multiple products (like same video used for image_url and video fields).
   * 
   * @param {Object} jsonData - The collection JSON data
   * @returns {Map} - Map of unique URLs to file information
   */
  extractUniqueMediaFiles: function(jsonData) {
    const urlToFileMap = new Map(); // Track unique URLs
    const collections = jsonData.collections;
    
    console.log("🔍 Analyzing JSON data for media files...");
    
    // Iterate through each collection
    Object.keys(collections).forEach(collectionKey => {
      const collection = collections[collectionKey];
      
      // Process collection banner image
      if (collection.collection_image_url && !urlToFileMap.has(collection.collection_image_url)) {
        const fileName = window.SochStorage.getFileNameFromUrl(
          collection.collection_image_url, 
          `collection_${collectionKey}_`
        );
        urlToFileMap.set(collection.collection_image_url, { 
          fileName, 
          folder: 'images',
          type: 'collection_image',
          collectionKey 
        });
        console.log(`📷 Found collection image: ${collectionKey}`);
      }
      
      // Process product media
      if (collection.products && Array.isArray(collection.products)) {
        collection.products.forEach((product, index) => {
          
          // Process product image (avoid duplicates)
          if (product.image_url && !urlToFileMap.has(product.image_url)) {
            const fileName = window.SochStorage.getFileNameFromUrl(
              product.image_url, 
              `${product.style_code}_`
            );
            urlToFileMap.set(product.image_url, { 
              fileName, 
              folder: 'images',
              type: 'product_image',
              styleCode: product.style_code 
            });
            console.log(`📷 Found product image: ${product.style_code}`);
          }
          
          // Process product video (avoid duplicates)
          if (product.video && !urlToFileMap.has(product.video)) {
            const fileName = window.SochStorage.getFileNameFromUrl(
              product.video, 
              `${product.style_code}_`
            );
            urlToFileMap.set(product.video, { 
              fileName, 
              folder: 'videos',
              type: 'product_video',
              styleCode: product.style_code 
            });
            console.log(`🎥 Found product video: ${product.style_code}`);
          }
        });
      }
    });
    
    console.log(`📊 Found ${urlToFileMap.size} unique media files to download`);
    return urlToFileMap;
  },

  /**
   * DOWNLOAD ALL MEDIA FILES
   * Downloads all unique media files from the JSON data with progress tracking.
   * Skips files that already exist locally and shows progress to user.
   * 
   * @param {Object} jsonData - The collection JSON data containing media URLs
   * @returns {Promise<void>}
   */
  downloadMediaFiles: async function(jsonData) {
    const config = window.SochConfig;
    
    // Skip downloads in browser mode
    if (!config.isCapacitor) {
      console.log("📱 Browser mode - skipping actual media downloads");
      return;
    }

    try {
      console.log("📥 Starting media download process...");
      
      // Step 1: Extract unique media files to prevent duplicates
      const urlToFileMap = this.extractUniqueMediaFiles(jsonData);
      const totalFiles = urlToFileMap.size;
      let downloadCount = 0;
      let skippedCount = 0;
      
      console.log(`📊 Total unique media files to process: ${totalFiles}`);
      
      // Step 2: Download each unique file with progress updates
      for (const [url, fileInfo] of urlToFileMap) {
        try {
          // Show current progress
          this.showProgressBar(downloadCount, totalFiles, "Downloading media files");
          
          // Attempt to download the file (will skip if already exists)
          const result = await window.SochStorage.downloadFile(
            url, 
            `${config.APP_FOLDER}/${fileInfo.folder}`, 
            fileInfo.fileName
          );
          
          if (result === null) {
            skippedCount++; // File was skipped (already exists or duplicate)
          }
          
          downloadCount++;
        } catch (err) {
          console.error(`❌ Failed to download ${fileInfo.fileName}:`, err);
          downloadCount++; // Still increment to keep progress accurate
        }
      }
      
      // Step 3: Show completion status
      this.showProgressBar(totalFiles, totalFiles, "Download completed");
      console.log(`✅ Media download process completed:`);
      console.log(`   - Total files processed: ${totalFiles}`);
      console.log(`   - Files skipped (already existed): ${skippedCount}`);
      console.log(`   - New files downloaded: ${totalFiles - skippedCount}`);
      
    } catch (err) {
      console.error("❌ Media download process failed:", err);
      throw new Error(`Media download failed: ${err.message}`);
    }
  },

  /**
   * CONVERT VIDEO URL FOR MOBILE PLAYBACK
   * Converts local file URIs to formats that work with mobile video players.
   * Ensures videos can be played properly in the Capacitor WebView.
   * 
   * @param {string} localUri - The local file URI
   * @returns {string} - Mobile-compatible video URL
   */
  convertVideoUrlForMobile: function(localUri) {
    // For Capacitor apps, file:// URLs should work directly
    if (localUri && localUri.startsWith('file://')) {
      console.log("🎥 Converting video URL for mobile playback");
      return localUri; // Use directly - Capacitor handles file:// URLs
    }
    return localUri;
  },

  /**
   * REPLACE REMOTE URLS WITH LOCAL PATHS
   * Processes the JSON data and replaces all remote URLs with local file paths.
   * This enables the flipbook to use downloaded files instead of fetching from internet.
   * 
   * Process:
   * 1. Creates a deep copy of the JSON data
   * 2. Finds each media URL in the data
   * 3. Generates the expected local filename
   * 4. Gets the local file URI
   * 5. Replaces the remote URL with local URI
   * 
   * @param {Object} jsonData - Original JSON data with remote URLs
   * @returns {Object} - Modified JSON data with local file URIs
   */
  replaceUrlsWithLocalPaths: async function(jsonData) {
    const config = window.SochConfig;
    
    // In browser mode, keep using remote URLs
    if (!config.isCapacitor) {
      console.log("📱 Browser mode - keeping remote URLs");
      return jsonData;
    }

    try {
      console.log("🔄 Starting URL replacement process...");
      
      // Create deep copy to avoid modifying original data
      const modifiedData = JSON.parse(JSON.stringify(jsonData));
      const collections = modifiedData.collections;
      let replacementCount = 0;
      
      // Process each collection
      for (const collectionKey of Object.keys(collections)) {
        const collection = collections[collectionKey];
        
        // Replace collection banner image URL
        if (collection.collection_image_url) {
          const fileName = window.SochStorage.getFileNameFromUrl(
            collection.collection_image_url, 
            `collection_${collectionKey}_`
          );
          const localUri = await window.SochStorage.getLocalFileUri('images', fileName);
          
          if (localUri) {
            collection.collection_image_url = localUri;
            console.log(`🔄 Replaced collection image URL: ${collectionKey}`);
            replacementCount++;
          }
        }
        
        // Replace product media URLs
        if (collection.products && Array.isArray(collection.products)) {
          for (const product of collection.products) {
            
            // Replace product image URL
            if (product.image_url) {
              const fileName = window.SochStorage.getFileNameFromUrl(
                product.image_url, 
                `${product.style_code}_`
              );
              const localUri = await window.SochStorage.getLocalFileUri('images', fileName);
              
              if (localUri) {
                product.image_url = localUri;
                console.log(`🔄 Replaced product image URL: ${product.style_code}`);
                replacementCount++;
              }
            }
            
            // Replace product video URL with mobile-compatible format
            if (product.video) {
              const fileName = window.SochStorage.getFileNameFromUrl(
                product.video, 
                `${product.style_code}_`
              );
              const localUri = await window.SochStorage.getLocalFileUri('videos', fileName);
              
              if (localUri) {
                // Convert to mobile-compatible format
                product.video = this.convertVideoUrlForMobile(localUri);
                console.log(`🔄 Replaced product video URL: ${product.style_code}`);
                replacementCount++;
              }
            }
          }
        }
      }
      
      console.log(`✅ URL replacement completed - ${replacementCount} URLs replaced with local paths`);
      return modifiedData;
      
    } catch (err) {
      console.error("❌ Error during URL replacement:", err);
      console.log("⚠️ Falling back to original data with remote URLs");
      return jsonData; // Return original data if replacement fails
    }
  }
};

// Log successful module loading
console.log("✅ Media module loaded");
