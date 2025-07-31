/**
* MEDIA.JS - Media File Management Module with Complete Video Fix
* 
* This file handles all media-related operations including:
* - Downloading images and videos from remote URLs
* - Progress tracking during downloads
* - Duplicate prevention for same URLs
* - URL replacement (remote to local paths)
* - Media file organization and cleanup
* - Multiple Blob URL creation methods for iframe video access
* - In-app logging display
* 
* Dependencies: config.js, storage.js (must be loaded first)
*/
window.SochMedia = {
 
 // Store active blob URLs for cleanup
 activeBlobUrls: new Set(),
 
 // In-app logging system
 logContainer: null,
 logs: [],
 
 /**
  * INITIALIZE IN-APP LOGGING SYSTEM
  */
 initializeLogging: function() {
   // Create floating log container
   const logContainer = document.createElement('div');
   logContainer.id = 'inAppLogger';
   logContainer.style.cssText = `
     position: fixed;
     top: 10px;
     right: 10px;
     width: 350px;
     max-height: 400px;
     background: rgba(0, 0, 0, 0.95);
     color: #00ff00;
     font-family: monospace;
     font-size: 10px;
     padding: 10px;
     border-radius: 8px;
     overflow-y: auto;
     z-index: 99999;
     border: 2px solid #00ff00;
     box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
   `;
   
   logContainer.innerHTML = `
     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; color: #ffff00; font-weight: bold;">
       🎥 VIDEO DEBUG LOGS
       <div>
         <button onclick="window.SochMedia.clearLogs()" style="background: #cc4400; color: white; border: none; padding: 2px 6px; margin-left: 5px; border-radius: 3px; font-size: 9px;">Clear</button>
         <button onclick="window.SochMedia.copyLogs()" style="background: #0066cc; color: white; border: none; padding: 2px 6px; margin-left: 5px; border-radius: 3px; font-size: 9px;">Copy</button>
         <button onclick="this.parentElement.parentElement.parentElement.style.display='none'" style="background: #666; color: white; border: none; padding: 2px 6px; margin-left: 5px; border-radius: 3px; font-size: 9px;">Hide</button>
       </div>
     </div>
     <div id="logContent" style="font-size: 9px; line-height: 1.3; max-height: 350px; overflow-y: auto;"></div>
   `;
   
   document.body.appendChild(logContainer);
   this.logContainer = logContainer;
   
   this.addLog('📱 In-app logging initialized', 'success');
 },
 
 /**
  * ADD LOG ENTRY TO IN-APP DISPLAY
  */
 addLog: function(message, type = 'info') {
   if (!this.logContainer) {
     this.initializeLogging();
   }
   
   const colors = {
     info: '#00ff00',
     warning: '#ffaa00',
     error: '#ff4444',
     success: '#44ff44',
     debug: '#00aaff'
   };
   
   const timestamp = new Date().toLocaleTimeString();
   const logEntry = `[${timestamp}] ${message}`;
   
   // Store in array
   this.logs.push(logEntry);
   
   // Add to display
   const logContent = document.getElementById('logContent');
   if (logContent) {
     const logDiv = document.createElement('div');
     logDiv.style.color = colors[type] || colors.info;
     logDiv.style.marginBottom = '2px';
     logDiv.innerHTML = logEntry;
     logContent.appendChild(logDiv);
     
     // Auto-scroll to bottom
     logContent.scrollTop = logContent.scrollHeight;
     
     // Limit logs to prevent memory issues
     while (logContent.children.length > 100) {
       logContent.removeChild(logContent.firstChild);
       this.logs.shift();
     }
   }
   
   // Also log to console
   console.log(`[MEDIA] ${message}`);
 },
 
 /**
  * CLEAR LOGS
  */
 clearLogs: function() {
   this.logs = [];
   const logContent = document.getElementById('logContent');
   if (logContent) {
     logContent.innerHTML = '';
   }
   this.addLog('🗑️ Logs cleared', 'info');
 },
 
 /**
  * COPY LOGS TO CLIPBOARD
  */
 copyLogs: function() {
   const logText = this.logs.join('\n');
   if (navigator.clipboard) {
     navigator.clipboard.writeText(logText).then(() => {
       this.addLog('📋 Logs copied to clipboard', 'success');
     });
   } else {
     this.addLog('❌ Clipboard not available', 'error');
   }
 },
 
 /**
  * CONVERT DROPBOX URL TO DIRECT DOWNLOAD
  */
 convertDropboxUrl: function(url) {
   if (!url.includes('dropbox.com')) {
     return url;
   }
   
   try {
     let cleanUrl = url.replace(/[?&]dl=[01]/, '');
     const separator = cleanUrl.includes('?') ? '&' : '?';
     const directUrl = cleanUrl + separator + 'dl=1';
     
     this.addLog(`📦 Converted Dropbox URL`, 'debug');
     return directUrl;
   } catch (err) {
     this.addLog(`❌ Error converting Dropbox URL: ${err.message}`, 'error');
     return url;
   }
 },
 
 /**
  * SHOW PROGRESS BAR
  */
 showProgressBar: function(current, total, message) {
   const percentage = Math.round((current / total) * 100);
   const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
   
   this.addLog(`📊 ${message} ${current}/${total} (${percentage}%)`, 'info');
   this.addLog(`[${progressBar}]`, 'debug');
   
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
  */
 getFileNameFromUrl: function(url, prefix = "") {
   try {
     if (url.includes('dropbox.com')) {
       const sclMatch = url.match(/\/scl\/fi\/([^\/]+)\/([^\/\?]+)/);
       if (sclMatch) {
         const fileId = sclMatch[1];
         const originalName = sclMatch[2];
         
         let extension = '.mp4';
         const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
         if (extMatch) {
           extension = '.' + extMatch[1].toLowerCase();
         } else if (url.includes('.jpg') || url.includes('.jpeg')) {
           extension = '.jpg';
         } else if (url.includes('.png')) {
           extension = '.png';
         }
         
         const shortFileId = fileId.substring(0, 8);
         const fileName = prefix + shortFileId + extension;
         
         this.addLog(`📝 Generated filename: ${fileName}`, 'debug');
         return fileName;
       }
       
       const oldMatch = url.match(/\/([^\/\?]+)\.(mp4|mov|avi|mkv|jpg|jpeg|png|gif)/i);
       if (oldMatch) {
         return prefix + oldMatch[1] + '.' + oldMatch[2].toLowerCase();
       }
       
       const urlHash = btoa(url).substring(0, 8).replace(/[\/\+]/g, '');
       return prefix + urlHash + '.mp4';
     }
     
     const urlParts = url.split('/');
     let fileName = urlParts[urlParts.length - 1];
     fileName = fileName.split('?')[0];
     
     if (fileName && fileName.includes('.')) {
       const urlHash = btoa(url).substring(0, 8).replace(/[\/\+]/g, '');
       return prefix + urlHash + '_' + fileName;
     }
     
     const urlHash = btoa(url).substring(0, 8).replace(/[\/\+]/g, '');
     const extension = url.includes('.mp4') ? '.mp4' : 
                      url.includes('.jpg') ? '.jpg' : 
                      url.includes('.png') ? '.png' : '.jpg';
     return prefix + urlHash + extension;
   } catch (err) {
     this.addLog(`❌ Error extracting filename: ${err.message}`, 'error');
     return prefix + Date.now() + '.jpg';
   }
 },
 
 /**
  * EXTRACT UNIQUE MEDIA FILES FROM JSON
  */
 extractUniqueMediaFiles: function(jsonData) {
   const urlToFileMap = new Map();
   const collections = jsonData.collections;
   
   this.addLog("🔍 Analyzing JSON data for media files...", 'info');
   
   Object.keys(collections).forEach(collectionKey => {
     const collection = collections[collectionKey];
     
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
         directUrl
       });
       this.addLog(`📷 Found collection image: ${collectionKey}`, 'debug');
     }
     
     if (collection.products && Array.isArray(collection.products)) {
       collection.products.forEach((product, index) => {
         
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
           this.addLog(`📷 Found product image: ${product.style_code}`, 'debug');
         }
         
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
           this.addLog(`🎥 Found product video: ${product.style_code}`, 'debug');
         }
       });
     }
   });
   
   const imageCount = Array.from(urlToFileMap.values()).filter(f => f.folder === 'images').length;
   const videoCount = Array.from(urlToFileMap.values()).filter(f => f.folder === 'videos').length;
   this.addLog(`📊 Found ${urlToFileMap.size} unique media files - Images: ${imageCount}, Videos: ${videoCount}`, 'success');
   
   return urlToFileMap;
 },
 
 /**
  * CLEANUP UNUSED FILES
  */
 cleanupUnusedFiles: async function(jsonData) {
   const config = window.SochConfig;
   
   if (!config.isCapacitor) {
     this.addLog("📱 Browser mode - skipping file cleanup", 'debug');
     return;
   }
   
   try {
     this.addLog("🧹 Starting cleanup of unused files...", 'info');
     
     const activeUrls = this.extractUniqueMediaFiles(jsonData);
     const activeImageFiles = new Set();
     const activeVideoFiles = new Set();
     
     for (const [url, fileInfo] of activeUrls) {
       if (fileInfo.folder === 'images') {
         activeImageFiles.add(fileInfo.fileName);
       } else if (fileInfo.folder === 'videos') {
         activeVideoFiles.add(fileInfo.fileName);
       }
     }
     
     this.addLog(`📊 Active files - Images: ${activeImageFiles.size}, Videos: ${activeVideoFiles.size}`, 'debug');
     
     const { Filesystem } = config.getPlugins();
     let deletedCount = 0;
     
     // Clean up images folder
     try {
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
             this.addLog(`🗑️ Deleted unused image: ${file.name}`, 'debug');
             deletedCount++;
           } catch (deleteErr) {
             this.addLog(`❌ Failed to delete image ${file.name}: ${deleteErr.message}`, 'error');
           }
         }
       }
     } catch (err) {
       this.addLog("ℹ️ No images folder found or already empty", 'debug');
     }
     
     // Clean up videos folder
     try {
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
             this.addLog(`🗑️ Deleted unused video: ${file.name}`, 'debug');
             deletedCount++;
           } catch (deleteErr) {
             this.addLog(`❌ Failed to delete video ${file.name}: ${deleteErr.message}`, 'error');
           }
         }
       }
     } catch (err) {
       this.addLog("ℹ️ No videos folder found or already empty", 'debug');
     }
     
     this.addLog(`✅ Cleanup completed - ${deletedCount} unused files removed`, 'success');
     
   } catch (err) {
     this.addLog(`❌ File cleanup process failed: ${err.message}`, 'error');
   }
 },
 
 /**
  * DOWNLOAD ALL MEDIA FILES
  */
 downloadMediaFiles: async function(jsonData) {
   const config = window.SochConfig;
   
   if (!config.isCapacitor) {
     this.addLog("📱 Browser mode - skipping actual media downloads", 'debug');
     return;
   }
   
   try {
     this.addLog("📥 Starting media download process...", 'info');
     
     const urlToFileMap = this.extractUniqueMediaFiles(jsonData);
     const totalFiles = urlToFileMap.size;
     let downloadCount = 0;
     let skippedCount = 0;
     let errorCount = 0;
     
     this.addLog(`📊 Total unique media files to process: ${totalFiles}`, 'info');
     
     for (const [originalUrl, fileInfo] of urlToFileMap) {
       try {
         this.showProgressBar(downloadCount, totalFiles, "Downloading media files");
         
         const downloadUrl = fileInfo.directUrl || originalUrl;
         this.addLog(`⬇️ Downloading: ${fileInfo.fileName}`, 'debug');
         
         const result = await window.SochStorage.downloadFile(
           downloadUrl,
           `${config.APP_FOLDER}/${fileInfo.folder}`, 
           fileInfo.fileName
         );
         
         if (result === null) {
           skippedCount++;
           this.addLog(`⏭️ Skipped: ${fileInfo.fileName}`, 'debug');
         } else {
           this.addLog(`✅ Downloaded: ${fileInfo.fileName}`, 'success');
         }
         
         downloadCount++;
       } catch (err) {
         this.addLog(`❌ Failed to download ${fileInfo.fileName}: ${err.message}`, 'error');
         errorCount++;
         downloadCount++;
       }
     }
     
     this.showProgressBar(totalFiles, totalFiles, "Download completed");
     this.addLog(`✅ Media download completed: ${totalFiles} processed, ${skippedCount} skipped, ${totalFiles - skippedCount - errorCount} downloaded, ${errorCount} errors`, 'success');
     
     if (errorCount > 0) {
       this.addLog(`⚠️ ${errorCount} files failed to download - app will use remote URLs for those`, 'warning');
     }
     
     await this.cleanupUnusedFiles(jsonData);
     
   } catch (err) {
     this.addLog(`❌ Media download process failed: ${err.message}`, 'error');
     throw new Error(`Media download failed: ${err.message}`);
   }
 },
 
 /**
  * CONVERT DATA URL TO BLOB URL FOR IFRAME COMPATIBILITY
  * CRITICAL FIX: Data URLs don't work in iframe srcdoc, but Blob URLs do
  */
 convertDataUrlToBlobUrl: async function(dataUrl) {
   this.addLog("🔄 Converting Data URL to Blob URL for iframe...", 'info');
   
   try {
     if (!dataUrl.startsWith('data:video/')) {
       this.addLog("⚠️ Not a Data URL - returning as-is", 'warning');
       return dataUrl;
     }
     
     // Extract base64 data from Data URL
     const [header, base64Data] = dataUrl.split(',');
     if (!base64Data) {
       throw new Error("Invalid Data URL format");
     }
     
     // Convert base64 to binary
     const binaryString = atob(base64Data);
     const bytes = new Uint8Array(binaryString.length);
     
     for (let i = 0; i < binaryString.length; i++) {
       bytes[i] = binaryString.charCodeAt(i);
     }
     
     // Create Blob
     const blob = new Blob([bytes], { type: 'video/mp4' });
     const blobUrl = URL.createObjectURL(blob);
     
     // Store for cleanup
     this.activeBlobUrls.add(blobUrl);
     
     this.addLog(`✅ Data URL converted to Blob URL: ${blobUrl}`, 'success');
     this.addLog(`📊 Blob size: ${blob.size} bytes`, 'debug');
     
     return blobUrl;
     
   } catch (err) {
     this.addLog(`❌ Data URL to Blob conversion failed: ${err.message}`, 'error');
     this.addLog("⚠️ Falling back to original Data URL", 'warning');
     return dataUrl;
   }
 },
 
 /**
  * COMPLETE FIXED: CREATE BLOB URL FROM LOCAL VIDEO FILE
  * Multiple fallback methods for maximum compatibility
  */
 createVideoBlobUrl: async function(localUri) {
   const config = window.SochConfig;
   
   this.addLog("🎥 ===== BLOB URL CREATION STARTED =====", 'info');
   this.addLog(`🎥 Input: ${localUri}`, 'debug');
   
   if (!config.isCapacitor || !localUri.startsWith('file://')) {
     this.addLog("🎥 Skipping Blob URL creation - not Capacitor or not file:// URL", 'warning');
     return localUri;
   }
   
   try {
     const { Filesystem } = config.getPlugins();
     
     // Extract filename from the file path
     const fileName = localUri.split('/').pop();
     this.addLog(`🎥 Extracted filename: ${fileName}`, 'debug');
     
     // METHOD 1: Try to read as ArrayBuffer directly (most reliable)
     this.addLog("🎥 METHOD 1: Attempting to read file as ArrayBuffer...", 'debug');
     
     try {
       const fileData = await Filesystem.readFile({
         path: `${config.APP_FOLDER}/videos/${fileName}`,
         directory: 'DOCUMENTS'
         // No encoding specified - should return ArrayBuffer
       });
       
       if (fileData.data instanceof ArrayBuffer) {
         this.addLog(`🎥 ArrayBuffer received: ${fileData.data.byteLength} bytes`, 'debug');
         
         // Create Blob directly from ArrayBuffer
         const blob = new Blob([fileData.data], { type: 'video/mp4' });
         const blobUrl = URL.createObjectURL(blob);
         
         // Store for cleanup
         this.activeBlobUrls.add(blobUrl);
         
         this.addLog(`🎥 Blob URL created from ArrayBuffer: ${blobUrl}`, 'success');
         this.addLog(`🎥 Blob size: ${blob.size} bytes`, 'success');
         
         this.addLog("🎥 ===== BLOB URL CREATION SUCCESS (ArrayBuffer) =====", 'success');
         return blobUrl;
       }
     } catch (arrayBufferErr) {
       this.addLog(`⚠️ METHOD 1 failed: ${arrayBufferErr.message}`, 'warning');
     }
     
     // METHOD 2: Base64 with fetch (avoids atob issues)
     this.addLog("🎥 METHOD 2: Using base64 with fetch method...", 'info');
     
     const fileData = await Filesystem.readFile({
       path: `${config.APP_FOLDER}/videos/${fileName}`,
       directory: 'DOCUMENTS',
       encoding: 'base64'
     });
     
     const dataLength = fileData.data ? fileData.data.length : 0;
     this.addLog(`🎥 Base64 data received: ${dataLength} characters`, 'debug');
     
     if (!fileData.data || dataLength === 0) {
       throw new Error("File data is empty or invalid");
     }
     
     // Clean base64 data more thoroughly
     let cleanBase64 = fileData.data
       .replace(/[\r\n\s]/g, '') // Remove whitespace
       .replace(/[^A-Za-z0-9+/=]/g, ''); // Remove any non-base64 characters
     
     // Add proper padding
     while (cleanBase64.length % 4 !== 0) {
       cleanBase64 += '=';
     }
     
     this.addLog(`🎥 Cleaned base64 length: ${cleanBase64.length}`, 'debug');
     
     // Use fetch with data URL instead of atob() for better compatibility
     try {
       const dataUrl = `data:video/mp4;base64,${cleanBase64}`;
       const response = await fetch(dataUrl);
       const arrayBuffer = await response.arrayBuffer();
       
       // Create Blob from the fetched ArrayBuffer
       const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
       const blobUrl = URL.createObjectURL(blob);
       
       // Store for cleanup
       this.activeBlobUrls.add(blobUrl);
       
       this.addLog(`🎥 Blob URL created from fetch: ${blobUrl}`, 'success');
       this.addLog(`🎥 Blob size: ${blob.size} bytes`, 'success');
       
       this.addLog("🎥 ===== BLOB URL CREATION SUCCESS (Fetch) =====", 'success');
       return blobUrl;
       
     } catch (fetchErr) {
       this.addLog(`❌ METHOD 2 failed: ${fetchErr.message}`, 'error');
       
       // METHOD 3: Chunked atob processing (last resort)
       try {
         this.addLog("🎥 METHOD 3: Trying chunked atob processing...", 'warning');
         
         // Process base64 in smaller chunks to avoid issues
         const chunkSize = 1024 * 1024; // 1MB chunks
         const chunks = [];
         
         for (let i = 0; i < cleanBase64.length; i += chunkSize) {
           const chunk = cleanBase64.substring(i, i + chunkSize);
           try {
             const binaryChunk = atob(chunk);
             chunks.push(binaryChunk);
           } catch (chunkErr) {
             this.addLog(`❌ Chunk ${Math.floor(i/chunkSize)} failed: ${chunkErr.message}`, 'error');
             throw new Error(`Base64 chunk processing failed at position ${i}`);
           }
         }
         
         const binaryString = chunks.join('');
         const bytes = new Uint8Array(binaryString.length);
         
         for (let i = 0; i < binaryString.length; i++) {
           bytes[i] = binaryString.charCodeAt(i);
         }
         
         // Create Blob and URL
         const blob = new Blob([bytes], { type: 'video/mp4' });
         const blobUrl = URL.createObjectURL(blob);
         
         // Store for cleanup
         this.activeBlobUrls.add(blobUrl);
         
         this.addLog(`🎥 Blob URL created from chunked atob: ${blobUrl}`, 'success');
         this.addLog(`🎥 Blob size: ${blob.size} bytes`, 'success');
         
         this.addLog("🎥 ===== BLOB URL CREATION SUCCESS (Chunked) =====", 'success');
         return blobUrl;
         
       } catch (atobErr) {
         this.addLog(`❌ METHOD 3 failed: ${atobErr.message}`, 'error');
         throw new Error(`All Blob URL creation methods failed: ${atobErr.message}`);
       }
     }
     
   } catch (err) {
     this.addLog("🎥 ===== BLOB URL CREATION FAILED =====", 'error');
     this.addLog(`🎥 Error: ${err.message}`, 'error');
     this.addLog(`🎥 Using capacitor:// URL as final fallback`, 'warning');
     
     // FINAL FALLBACK: Use capacitor:// URL which might work in iframe
     const capacitorUrl = localUri.replace('file://', 'capacitor://localhost/_capacitor_file_');
     this.addLog(`🎥 Final fallback URL: ${capacitorUrl}`, 'warning');
     return capacitorUrl;
   }
 },
 
 /**
  * CLEANUP BLOB URLS
  */
 cleanupBlobUrls: function() {
   this.addLog(`🧹 Cleaning up ${this.activeBlobUrls.size} Blob URLs`, 'info');
   
   for (const blobUrl of this.activeBlobUrls) {
     URL.revokeObjectURL(blobUrl);
   }
   
   this.activeBlobUrls.clear();
 },
 
 /**
  * CONVERT VIDEO URL FOR MOBILE PLAYBACK - BLOB URL SOLUTION
  * Uses multiple methods for maximum compatibility
  */
 convertVideoUrlForMobile: async function(localUri) {
   const config = window.SochConfig;
   
   this.addLog("🎥 ===== VIDEO URL CONVERSION STARTED =====", 'info');
   this.addLog(`🎥 Input: ${localUri}`, 'debug');
   this.addLog(`🎥 Is Capacitor: ${config.isCapacitor}`, 'debug');
   
   // Browser mode - no conversion needed
   if (!config.isCapacitor) {
     this.addLog("🎥 Browser mode - no conversion needed", 'debug');
     return localUri;
   }
   
   // Check if we have a local file URI
   if (localUri && localUri.startsWith('file://')) {
     this.addLog("🎥 Creating Blob URL for iframe compatibility", 'info');
     const blobUrl = await this.createVideoBlobUrl(localUri);
     this.addLog(`🎥 RESULT: ${blobUrl.substring(0, 50)}...`, 'success');
     return blobUrl;
   }
   
   this.addLog("🎥 No conversion needed - returning original", 'debug');
   return localUri;
 },
 
 /**
  * REPLACE REMOTE URLS WITH LOCAL PATHS
  */
 replaceUrlsWithLocalPaths: async function(jsonData) {
   const config = window.SochConfig;
   
   if (!config.isCapacitor) {
     this.addLog("📱 Browser mode - keeping remote URLs", 'debug');
     return jsonData;
   }
   
   try {
     this.addLog("🔄 Starting URL replacement process...", 'info');
     
     const modifiedData = JSON.parse(JSON.stringify(jsonData));
     const collections = modifiedData.collections;
     let replacementCount = 0;
     
     for (const collectionKey of Object.keys(collections)) {
       const collection = collections[collectionKey];
       
       if (collection.collection_image_url) {
         const fileName = this.getFileNameFromUrl(
           collection.collection_image_url, 
           `collection_${collectionKey}_`
         );
         const localUri = await window.SochStorage.getLocalFileUri('images', fileName);
         
         if (localUri) {
           collection.collection_image_url = localUri;
           this.addLog(`🔄 Replaced collection image URL: ${collectionKey}`, 'debug');
           replacementCount++;
         } else {
           this.addLog(`⚠️ Local file not found for collection image: ${collectionKey}`, 'warning');
         }
       }
       
       if (collection.products && Array.isArray(collection.products)) {
         for (const product of collection.products) {
           
           if (product.image_url) {
             const fileName = this.getFileNameFromUrl(
               product.image_url, 
               `${product.style_code}_img_`
             );
             const localUri = await window.SochStorage.getLocalFileUri('images', fileName);
             
             if (localUri) {
               product.image_url = localUri;
               this.addLog(`🔄 Replaced product image URL: ${product.style_code}`, 'debug');
               replacementCount++;
             } else {
               this.addLog(`⚠️ Local file not found for product image: ${product.style_code}`, 'warning');
             }
           }
           
           if (product.video) {
             const fileName = this.getFileNameFromUrl(
               product.video, 
               `${product.style_code}_vid_`
             );
             const localUri = await window.SochStorage.getLocalFileUri('videos', fileName);
             
             if (localUri) {
               // CRITICAL FIX: Convert to Blob URL for iframe access
               product.video = await this.convertVideoUrlForMobile(localUri);
               this.addLog(`🔄 Replaced product video URL: ${product.style_code} -> ${product.video.substring(0, 50)}...`, 'success');
               replacementCount++;
             } else {
               this.addLog(`⚠️ Local file not found for product video: ${product.style_code}`, 'warning');
             }
           }
         }
       }
     }
     
     this.addLog(`✅ URL replacement completed - ${replacementCount} URLs replaced`, 'success');
     return modifiedData;
     
   } catch (err) {
     this.addLog(`❌ Error during URL replacement: ${err.message}`, 'error');
     this.addLog("⚠️ Falling back to original data with remote URLs", 'warning');
     return jsonData;
   }
 }
};

// Initialize logging when module loads
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    window.SochMedia.initializeLogging();
  }, 1000);
});

// Log successful module loading
console.log("✅ Media module loaded with complete multi-method Blob URL solution for offline iframe videos");