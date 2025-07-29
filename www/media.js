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
   * CONVERT DROPBOX URL TO DIRECT DOWNLOAD
   * Dropbox URLs need special handling to work as direct download links.
   * Converts sharing URLs to direct download URLs by adding dl=1 parameter.
   * 
   * @param {string} url - Original Dropbox URL
   * @returns {string} - Direct download URL
   */
  convertDropboxUrl: function(url) {
    if (!url.includes('dropbox.com')) {
      return url; // Not a Dropbox URL, return as-is
    }
    
    try {
      // Remove existing dl parameter if present
      let cleanUrl = url.replace(/[?&]dl=[01]/, '');
      
      // Add direct download parameter
      const separator = cleanUrl.includes('?') ? '&' : '?';
      const directUrl = cleanUrl + separator + 'dl=1';
      
      console.log("�� Converted Dropbox URL:", url, "→", directUrl);
      return directUrl;
    } catch (err) {
      console.error("❌ Error converting Dropbox URL:", err);
      return url; // Return original if conversion fails
    }
  },

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
   * IMPROVED FILENAME EXTRACTION FOR DROPBOX
   * Generates better filenames specifically for Dropbox URLs.
   * Handles the new Dropbox URL format and ensures unique filenames.
   * 
   * @param {string} url - The URL to extract filename from
   * @param {string} prefix - Prefix for the filename (e.g., style code)
   * @returns {string} - A safe, unique filename
   */
  getFileNameFromUrl: function(url, prefix = "") {
    try {
      // For Dropbox URLs, extract the file ID from the path
      if (url.includes('dropbox.com')) {
        // New Dropbox URL format: /scl/fi/FILE_ID/FILENAME.ext
        const sclMatch = url.match(/\/scl\/fi\/([^\/]+)\/([^\/\?]+)/);
        if (sclMatch) {
          const fileId = sclMatch[1];
          const originalName = sclMatch[2];
          
          // Extract extension from original filename or URL
          let extension = '.mp4'; // Default for videos
          const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
          if (extMatch) {
            extension = '.' + extMatch[1].toLowerCase();
          } else if (url.includes('.jpg') || url.includes('.jpeg')) {
            extension = '.jpg';
          } else if (url.includes('.png')) {
            extension = '.png';
          }
          
          // Create filename: prefix + first 8 chars of file ID + extension
          const shortFileId = fileId.substring(0, 8);
          const fileName = prefix + shortFileId + extension;
          
          console.log(`📝 Generated filename for Dropbox: ${fileName}`);
          return fileName;
        }
        
        // Fallback for old Dropbox URL format
        const oldMatch = url.match(/\/([^\/\?]+)\.(mp4|mov|avi|mkv|jpg|jpeg|png|gif)/i);
        if (oldMatch) {
          return prefix + oldMatch[1] + '.' + oldMatch[2].toLowerCase();
        }
        
        // Final fallback for Dropbox
        const urlHash = btoa(url).substring(0, 8).replace(/[\/\+]/g, '');
        return prefix + urlHash + '.mp4';
      }
      
      // Handle regular URLs (non-Dropbox)
      const urlParts = url.split('/');
      let fileName = urlParts[urlParts.length - 1];
      fileName = fileName.split('?')[0]; // Remove query parameters
      
      if (fileName && fileName.includes('.')) {
        const urlHash = btoa(url).substring(0, 8).replace(/[\/\+]/g, '');
        return prefix + urlHash + '_' + fileName;
      }
      
      // Final fallback: generate filename from URL with appropriate extension
      const urlHash = btoa(url).substring(0, 8).replace(/[\/\+]/g, '');
      const extension = url.includes('.mp4') ? '.mp4' : 
                       url.includes('.jpg') ? '.jpg' : 
                       url.includes('.png') ? '.png' : '.jpg';
      return prefix + urlHash + extension;
    } catch (err) {
      console.error("❌ Error extracting filename from URL:", err);
      // Emergency fallback using timestamp
      return prefix + Date.now() + '.jpg';
    }
  },

  /**
   * EXTRACT UNIQUE MEDIA FILES FROM JSON
   * Analyzes the JSON data to create a map of unique media files to download.
   * FIXED: Better handling of identical URLs and improved Dropbox support.
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
        const fileName = this.getFileNameFromUrl(
          collection.collection_image_url, 
          `collection_${collectionKey}_`
        );
        const directUrl = this.convertDropboxUrl(collection.collection_image_url);
        
        urlToFileMap.set(collection.collection_image_url, { 
          fileName, 
          folder: 'images',
          type: 'collection_image',
          collectionKey,
          directUrl // Store the direct download URL
        });
        console.log(`📷 Found collection image: ${collectionKey}`);
      }
      
      // Process product media
      if (collection.products && Array.isArray(collection.products)) {
        collection.products.forEach((product, index) => {
          
          // Process product image (avoid duplicates)
          if (product.image_url && !urlToFileMap.has(product.image_url)) {
            const fileName = this.getFileNameFromUrl(
              product.image_url, 
              `${product.style_code}_img_`
            );
            const directUrl = this.convertDropboxUrl(product.image_url);
            
            urlToFileMap.set(product.image_url, { 
              fileName, 
              folder: 'images',
              type: 'product_image',
              styleCode: product.style_code,
              directUrl
            });
            console.log(`📷 Found product image: ${product.style_code}`);
          }
          
          // Process product video (avoid duplicates)
          if (product.video && !urlToFileMap.has(product.video)) {
            const fileName = this.getFileNameFromUrl(
              product.video, 
              `${product.style_code}_vid_`
            );
            const directUrl = this.convertDropboxUrl(product.video);
            
            urlToFileMap.set(product.video, { 
              fileName, 
              folder: 'videos',
              type: 'product_video',
              styleCode: product.style_code,
              directUrl
            });
            console.log(`🎥 Found product video: ${product.style_code}`);
          }
        });
      }
    });
    
    console.log(`📊 Found ${urlToFileMap.size} unique media files to download`);
    
    // Log breakdown by type
    const imageCount = Array.from(urlToFileMap.values()).filter(f => f.folder === 'images').length;
    const videoCount = Array.from(urlToFileMap.values()).filter(f => f.folder === 'videos').length;
    console.log(`   - Images: ${imageCount}`);
    console.log(`   - Videos: ${videoCount}`);
    
    return urlToFileMap;
  },

  /**
   * CLEANUP UNUSED FILES
   * Removes files from local storage that are no longer referenced in the current JSON.
   * This prevents storage bloat when content is updated and old files are no longer needed.
   * 
   * @param {Object} jsonData - Current JSON data with active file references
   */
  cleanupUnusedFiles: async function(jsonData) {
    const config = window.SochConfig;
    
    // Skip cleanup in browser mode
    if (!config.isCapacitor) {
      console.log("📱 Browser mode - skipping file cleanup");
      return;
    }

    try {
      console.log("🧹 Starting cleanup of unused files...");
      
      // Get current active media files from JSON
      const activeUrls = this.extractUniqueMediaFiles(jsonData);
      const activeImageFiles = new Set();
      const activeVideoFiles = new Set();
      
      // Build sets of currently needed filenames
      for (const [url, fileInfo] of activeUrls) {
        if (fileInfo.folder === 'images') {
          activeImageFiles.add(fileInfo.fileName);
        } else if (fileInfo.folder === 'videos') {
          activeVideoFiles.add(fileInfo.fileName);
        }
      }
      
      console.log(`📊 Active files - Images: ${activeImageFiles.size}, Videos: ${activeVideoFiles.size}`);
      
      const { Filesystem } = config.getPlugins();
      let deletedCount = 0;
      
      // Clean up images folder
      try {
        console.log("🧹 Cleaning images folder...");
        const imageDir = await Filesystem.readdir({
          path: `${config.APP_FOLDER}/images`,
          directory: 'DOCUMENTS'
        });
        
        for (const file of imageDir.files) {
          if (file.type === 'file' && !activeImageFiles.has(file.name)) {
            try {
              await Filesystem.deleteFile({
                path: `${config.APP_FOLDER}/images/${file.name}`,
                directory: 'DOCUMENTS'
              });
              console.log(`🗑️ Deleted unused image: ${file.name}`);
              deletedCount++;
            } catch (deleteErr) {
              console.error(`❌ Failed to delete image ${file.name}:`, deleteErr);
            }
          }
        }
      } catch (err) {
        console.log("ℹ️ No images folder found or already empty");
      }
      
      // Clean up videos folder
      try {
        console.log("🧹 Cleaning videos folder...");
        const videoDir = await Filesystem.readdir({
          path: `${config.APP_FOLDER}/videos`,
          directory: 'DOCUMENTS'
        });
        
        for (const file of videoDir.files) {
          if (file.type === 'file' && !activeVideoFiles.has(file.name)) {
            try {
              await Filesystem.deleteFile({
                path: `${config.APP_FOLDER}/videos/${file.name}`,
                directory: 'DOCUMENTS'
              });
              console.log(`🗑️ Deleted unused video: ${file.name}`);
              deletedCount++;
            } catch (deleteErr) {
              console.error(`❌ Failed to delete video ${file.name}:`, deleteErr);
            }
          }
        }
      } catch (err) {
        console.log("ℹ️ No videos folder found or already empty");
      }
      
      console.log(`✅ Cleanup completed - ${deletedCount} unused files removed`);
      
    } catch (err) {
      console.error("❌ File cleanup process failed:", err);
      // Don't throw error - cleanup failure shouldn't stop the app
    }
  },

  /**
   * DOWNLOAD ALL MEDIA FILES
   * Downloads all unique media files from the JSON data with progress tracking.
   * FIXED: Uses direct Dropbox URLs and better error handling.
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
      let errorCount = 0;
      
      console.log(`📊 Total unique media files to process: ${totalFiles}`);
      
      // Step 2: Download each unique file with progress updates
      for (const [originalUrl, fileInfo] of urlToFileMap) {
        try {
          // Show current progress
          this.showProgressBar(downloadCount, totalFiles, "Downloading media files");
          
          // Use the direct download URL for Dropbox files
          const downloadUrl = fileInfo.directUrl || originalUrl;
          console.log(`⬇️ Downloading: ${fileInfo.fileName} from ${downloadUrl}`);
          
          // Attempt to download the file (will skip if already exists)
          const result = await window.SochStorage.downloadFile(
            downloadUrl, // Use direct URL instead of original
            `${config.APP_FOLDER}/${fileInfo.folder}`, 
            fileInfo.fileName
          );
          
          if (result === null) {
            skippedCount++; // File was skipped (already exists or duplicate)
            console.log(`⏭️ Skipped: ${fileInfo.fileName}`);
          } else {
            console.log(`✅ Downloaded: ${fileInfo.fileName}`);
          }
          
          downloadCount++;
        } catch (err) {
          console.error(`❌ Failed to download ${fileInfo.fileName}:`, err);
          errorCount++;
          downloadCount++; // Still increment to keep progress accurate
        }
      }
      
      // Step 3: Show completion status
      this.showProgressBar(totalFiles, totalFiles, "Download completed");
      console.log(`✅ Media download process completed:`);
      console.log(`   - Total files processed: ${totalFiles}`);
      console.log(`   - Files skipped (already existed): ${skippedCount}`);
      console.log(`   - New files downloaded: ${totalFiles - skippedCount - errorCount}`);
      console.log(`   - Download errors: ${errorCount}`);
      
      if (errorCount > 0) {
        console.warn(`⚠️ ${errorCount} files failed to download - app will use remote URLs for those`);
      }
      
      // Step 4: Cleanup unused files after downloads
      await this.cleanupUnusedFiles(jsonData);
      
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
   * FIXED: Uses the same filename generation logic as download process.
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
          const fileName = this.getFileNameFromUrl(
            collection.collection_image_url, 
            `collection_${collectionKey}_`
          );
          const localUri = await window.SochStorage.getLocalFileUri('images', fileName);
          
          if (localUri) {
            collection.collection_image_url = localUri;
            console.log(`🔄 Replaced collection image URL: ${collectionKey}`);
            replacementCount++;
          } else {
            console.log(`⚠️ Local file not found for collection image: ${collectionKey}, keeping remote URL`);
          }
        }
        
        // Replace product media URLs
        if (collection.products && Array.isArray(collection.products)) {
          for (const product of collection.products) {
            
            // Replace product image URL
            if (product.image_url) {
              const fileName = this.getFileNameFromUrl(
                product.image_url, 
                `${product.style_code}_img_`
              );
              const localUri = await window.SochStorage.getLocalFileUri('images', fileName);
              
              if (localUri) {
                product.image_url = localUri;
                console.log(`🔄 Replaced product image URL: ${product.style_code}`);
                replacementCount++;
              } else {
                console.log(`⚠️ Local file not found for product image: ${product.style_code}, keeping remote URL`);
              }
            }
            
            // Replace product video URL with mobile-compatible format
            if (product.video) {
              const fileName = this.getFileNameFromUrl(
                product.video, 
                `${product.style_code}_vid_`
              );
              const localUri = await window.SochStorage.getLocalFileUri('videos', fileName);
              
              if (localUri) {
                // Convert to mobile-compatible format
                product.video = this.convertVideoUrlForMobile(localUri);
                console.log(`🔄 Replaced product video URL: ${product.style_code}`);
                replacementCount++;
              } else {
                console.log(`⚠️ Local file not found for product video: ${product.style_code}, keeping remote URL`);
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
