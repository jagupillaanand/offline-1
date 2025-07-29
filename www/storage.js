/**
 * STORAGE.JS - File System and Storage Management Module
 * 
 * This file handles all local storage operations including:
 * - Folder creation and management
 * - File downloads and caching
 * - Local file existence checking
 * - Media file organization (images/videos)
 * - Duplicate download prevention
 * 
 * Dependencies: config.js (must be loaded first)
 */

window.SochStorage = {
  
  // Track downloaded URLs to prevent duplicates
  downloadedUrls: new Set(),
  
  /**
   * REQUEST STORAGE PERMISSIONS
   * Requests necessary file system permissions on mobile devices.
   * In browser mode, permissions are automatically granted.
   * 
   * @returns {Promise<void>}
   */
  checkAndRequestPermissions: async function() {
    try {
      const config = window.SochConfig;
      
      if (config.isCapacitor) {
        console.log("📱 Mobile mode - checking storage permissions...");
        const { Filesystem } = config.getPlugins();
        
        // Check current permission status
        const status = await Filesystem.checkPermissions();
        
        if (status.publicStorage !== "granted") {
          console.log("⚠️ Requesting storage permissions...");
          await Filesystem.requestPermissions();
          console.log("✅ Storage permissions requested");
        } else {
          console.log("✅ Storage permissions already granted");
        }
      } else {
        console.log("🌐 Browser mode - no permissions needed");
      }
    } catch (err) {
      console.error("❌ Permission check/request failed:", err);
      throw new Error(`Permission error: ${err.message}`);
    }
  },

  /**
   * CHECK IF FOLDER EXISTS
   * Checks if a specific folder exists in the Documents directory.
   * Prevents errors when trying to create folders that already exist.
   * 
   * @param {string} path - The folder path to check
   * @returns {boolean} - True if folder exists, false otherwise
   */
  folderExists: async function(path) {
    const config = window.SochConfig;
    
    // In browser mode, always return true (simulated folders)
    if (!config.isCapacitor) return true;
    
    try {
      const { Filesystem } = config.getPlugins();
      
      // Use stat() to check if folder exists
      await Filesystem.stat({
        path: path,
        directory: 'DOCUMENTS'
      });
      
      return true; // If no error thrown, folder exists
    } catch (err) {
      return false; // Error means folder doesn't exist
    }
  },

  /**
   * CREATE APP FOLDER STRUCTURE
   * Creates the main SochApp folder and all required subfolders.
   * Only creates folders that don't already exist to prevent errors.
   * 
   * Directory structure created:
   * - SochApp/
   *   - html/     (flipbook HTML files)
   *   - json/     (collection data)
   *   - images/   (product and collection images)
   *   - videos/   (product videos)
   * 
   * @returns {Promise<void>}
   */
  ensureAppFolders: async function() {
    const config = window.SochConfig;
    
    if (!config.isCapacitor) {
      console.log("📂 Browser mode - folders simulated");
      return;
    }

    try {
      const { Filesystem } = config.getPlugins();
      
      // Step 1: Create main app folder if it doesn't exist
      const mainFolderExists = await this.folderExists(config.APP_FOLDER);
      if (!mainFolderExists) {
        await Filesystem.mkdir({
          path: config.APP_FOLDER,
          directory: 'DOCUMENTS',
          recursive: true, // Create parent directories if needed
        });
        console.log("📂 Main folder created:", config.APP_FOLDER);
      } else {
        console.log("ℹ️ Main folder already exists:", config.APP_FOLDER);
      }

      // Step 2: Create each subfolder if it doesn't exist
      for (const subfolder of config.SUBFOLDERS) {
        const subfolderPath = `${config.APP_FOLDER}/${subfolder}`;
        const subfolderExists = await this.folderExists(subfolderPath);
        
        if (!subfolderExists) {
          await Filesystem.mkdir({
            path: subfolderPath,
            directory: 'DOCUMENTS',
            recursive: true,
          });
          console.log("📂 Subfolder created:", subfolder);
        } else {
          console.log("ℹ️ Subfolder already exists:", subfolder);
        }
      }
      
      console.log("✅ All folders ensured successfully");
    } catch (err) {
      console.error("❌ Error in folder creation:", err);
      // Don't throw error if folders already exist
      if (!err.message.includes("already exists")) {
        throw new Error(`Folder creation failed: ${err.message}`);
      }
    }
  },

  /**
   * EXTRACT FILENAME FROM URL
   * Generates a unique, safe filename from a URL. Handles different URL formats
   * and prevents duplicate downloads by creating hash-based filenames.
   * 
   * @param {string} url - The URL to extract filename from
   * @param {string} prefix - Optional prefix for the filename (e.g., style code)
   * @returns {string} - A safe, unique filename
   */
  getFileNameFromUrl: function(url, prefix = "") {
    try {
      // Create a hash of the URL to ensure unique filenames for identical URLs
      const urlHash = btoa(url).substring(0, 8).replace(/[\/\+]/g, '');
      
      // Handle Dropbox URLs specifically
      if (url.includes('dropbox.com')) {
        const match = url.match(/\/([^\/\?]+)\.(mp4|mov|avi|mkv|jpg|jpeg|png|gif)/i);
        if (match) {
          // Use hash + original filename for uniqueness
          return prefix + urlHash + '_' + match[1] + '.' + match[2].toLowerCase();
        }
        // Fallback: use URL hash with mp4 extension for videos
        return prefix + urlHash + '.mp4';
      }
      
      // Handle regular URLs
      const urlParts = url.split('/');
      let fileName = urlParts[urlParts.length - 1];
      fileName = fileName.split('?')[0]; // Remove query parameters
      
      if (fileName && fileName.includes('.')) {
        return prefix + urlHash + '_' + fileName;
      }
      
      // Final fallback: generate filename from URL with appropriate extension
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
   * CHECK IF FILE EXISTS LOCALLY
   * Checks if a specific file already exists in local storage.
   * Used to prevent re-downloading files that are already cached.
   * 
   * @param {string} folderName - The subfolder name (images, videos, etc.)
   * @param {string} fileName - The filename to check
   * @returns {boolean} - True if file exists, false otherwise
   */
  fileExists: async function(folderName, fileName) {
    const config = window.SochConfig;
    
    // In browser mode, files don't actually exist
    if (!config.isCapacitor) return false;
    
    try {
      const { Filesystem } = config.getPlugins();
      
      // Use stat() to check if file exists
      await Filesystem.stat({
        path: `${config.APP_FOLDER}/${folderName}/${fileName}`,
        directory: 'DOCUMENTS'
      });
      
      return true; // If no error thrown, file exists
    } catch (err) {
      return false; // Error means file doesn't exist
    }
  },

  /**
   * DOWNLOAD FILE WITH DUPLICATE PREVENTION
   * Downloads a file from URL to local storage, but only if:
   * 1. The URL hasn't been downloaded before (prevents duplicates)
   * 2. The file doesn't already exist locally (prevents re-downloads)
   * 
   * @param {string} url - The URL to download from
   * @param {string} folderPath - The local folder path to save to
   * @param {string} fileName - The filename to save as
   * @returns {Promise<Object>} - Download result or null if skipped
   */
  downloadFile: async function(url, folderPath, fileName) {
    try {
      const config = window.SochConfig;
      
      // Prevention 1: Skip if this exact URL was already downloaded
      if (this.downloadedUrls.has(url)) {
        console.log("⏭️ Skipping duplicate URL:", fileName);
        return null;
      }
      
      // Prevention 2: Skip if file already exists locally
      const folderName = folderPath.split('/').pop();
      const exists = await this.fileExists(folderName, fileName);
      if (exists) {
        console.log("⏭️ File already exists locally:", fileName);
        this.downloadedUrls.add(url); // Mark as processed
        return null;
      }
      
      console.log("⬇️ Starting download:", fileName);
      
      const { Filesystem, FileTransfer } = config.getPlugins();
      
      // Get the local file URI where the file will be saved
      const fileUri = await Filesystem.getUri({
        directory: 'DOCUMENTS',
        path: `${folderPath}/${fileName}`,
      });

      // Download the file from URL to local storage
      const result = await FileTransfer.downloadFile({
        url: url,
        path: fileUri.uri,
      });

      console.log("✅ Download completed:", fileName);
      this.downloadedUrls.add(url); // Mark URL as downloaded
      return result;
    } catch (err) {
      console.error("❌ Download failed for", fileName + ":", err);
      throw new Error(`Download failed for ${fileName}: ${err.message}`);
    }
  },

  /**
   * GET LOCAL FILE URI
   * Gets the local file system URI for a file that should exist in storage.
   * Used to convert local filenames back to URIs that can be used in HTML.
   * 
   * @param {string} folderName - The subfolder name (images, videos, etc.)
   * @param {string} fileName - The filename to get URI for
   * @returns {string|null} - The local file URI or null if error
   */
  getLocalFileUri: async function(folderName, fileName) {
    try {
      const config = window.SochConfig;
      const { Filesystem } = config.getPlugins();
      
      // Get the URI for the local file
      const fileUri = await Filesystem.getUri({
        directory: 'DOCUMENTS',
        path: `${config.APP_FOLDER}/${folderName}/${fileName}`,
      });
      
      return fileUri.uri;
    } catch (err) {
      console.error("❌ Error getting local file URI for", fileName + ":", err);
      return null;
    }
  },

  /**
   * SAVE JSON DATA LOCALLY
   * Saves JSON collection data to local storage for offline access.
   * Creates a backup of the current content for when device is offline.
   * 
   * @param {Object} jsonData - The JSON data to save
   * @returns {Promise<void>}
   */
  saveJsonData: async function(jsonData) {
    const config = window.SochConfig;
    
    // Skip in browser mode
    if (!config.isCapacitor) {
      console.log("🌐 Browser mode - JSON saving skipped");
      return;
    }
    
    try {
      const { Filesystem } = config.getPlugins();
      
      // Save JSON data as formatted string to local file
      await Filesystem.writeFile({
        path: `${config.APP_FOLDER}/json/data.json`,
        directory: 'DOCUMENTS',
        data: JSON.stringify(jsonData, null, 2), // Pretty formatted JSON
        encoding: 'utf8'
      });
      
      console.log("✅ JSON data saved locally for offline access");
    } catch (err) {
      console.error("❌ Failed to save JSON data locally:", err);
      throw new Error(`JSON save failed: ${err.message}`);
    }
  },

  /**
   * GET CURRENT JSON VERSION
   * Reads the locally stored JSON file and extracts the version number.
   * Used to compare with remote version and determine if update is needed.
   * 
   * @returns {string|null} - The current version or null if no local file
   */
  getCurrentJsonVersion: async function() {
    const config = window.SochConfig;
    
    // No local files in browser mode
    if (!config.isCapacitor) return null;
    
    try {
      const { Filesystem } = config.getPlugins();
      
      // Read the local JSON file
      const jsonContent = await Filesystem.readFile({
        path: `${config.APP_FOLDER}/json/data.json`,
        directory: 'DOCUMENTS',
        encoding: 'utf8'
      });
      
      // Parse and extract version
      const jsonData = JSON.parse(jsonContent.data);
      const version = jsonData.version;
      
      console.log("📄 Current local JSON version:", version);
      return version;
    } catch (err) {
      console.log("ℹ️ No existing local JSON file found (first time setup)");
      return null;
    }
  },

  /**
   * READ LOCAL JSON DATA
   * Reads and returns the complete JSON data from local storage.
   * Used when device is offline or as fallback when API fails.
   * 
   * @returns {Object|null} - The JSON data or null if not available
   */
  readLocalJsonData: async function() {
    const config = window.SochConfig;
    
    if (!config.isCapacitor) return null;
    
    try {
      const { Filesystem } = config.getPlugins();
      
      // Read the complete local JSON file
      const jsonContent = await Filesystem.readFile({
        path: `${config.APP_FOLDER}/json/data.json`,
        directory: 'DOCUMENTS',
        encoding: 'utf8'
      });
      
      const jsonData = JSON.parse(jsonContent.data);
      console.log("✅ Local JSON data loaded successfully");
      return jsonData;
    } catch (err) {
      console.log("❌ Failed to read local JSON data:", err.message);
      return null;
    }
  }
};

// Log successful module loading
console.log("✅ Storage module loaded");
