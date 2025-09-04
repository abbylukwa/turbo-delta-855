const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class DownloadManager {
    constructor() {
        this.downloadsDir = path.join(__dirname, 'downloads');
        this.tempDir = path.join(__dirname, 'temp');
        this.ensureDirectoriesExist();
        
        // Supported websites with arrow functions to automatically bind 'this'
        this.supportedWebsites = {
            'youtube.com': (url, phoneNumber, options) => this.downloadYouTube(url, phoneNumber, options),
            'youtu.be': (url, phoneNumber, options) => this.downloadYouTube(url, phoneNumber, options),
            'instagram.com': (url, phoneNumber) => this.downloadInstagram(url, phoneNumber),
            'twitter.com': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber),
            'tik.porn': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber),
            'xvideos.com': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber),
            'reddit.com': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber),
            'pornhub.com': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber),
            'wonporn.com': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber),
            'xnxx.com': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber),
            'pornhits.com': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber),
            'soundcloud.com': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber),
            'x.com': (url, phoneNumber) => this.downloadGeneric(url, phoneNumber)
        };
    }

    ensureDirectoriesExist() {
        [this.downloadsDir, this.tempDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async downloadContent(url, phoneNumber, options = {}) {
        try {
            // Check if URL is from a supported website
            const website = Object.keys(this.supportedWebsites).find(site => 
                url.includes(site)
            );

            if (website) {
                return await this.supportedWebsites[website](url, phoneNumber, options);
            }

            // Generic download for other websites
            return await this.downloadGeneric(url, phoneNumber, options);
        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    async downloadYouTube(url, phoneNumber, options = {}) {
        try {
            const info = await ytdl.getInfo(url);
            const format = this.chooseBestFormat(info.formats, options.quality || 'highest');
            
            const userDir = path.join(this.downloadsDir, phoneNumber);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }

            const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
            const filename = `${title}_${Date.now()}.${format.container}`;
            const filePath = path.join(userDir, filename);

            const video = ytdl(url, { quality: format.itag });
            const writer = fs.createWriteStream(filePath);

            return new Promise((resolve, reject) => {
                video.pipe(writer);
                
                writer.on('finish', () => {
                    const stats = fs.statSync(filePath);
                    resolve({
                        path: filePath,
                        name: filename,
                        size: stats.size,
                        type: 'video',
                        title: info.videoDetails.title,
                        duration: info.videoDetails.lengthSeconds,
                        thumbnail: info.videoDetails.thumbnails[0]?.url
                    });
                });
                
                writer.on('error', reject);
            });
        } catch (error) {
            throw new Error(`YouTube download failed: ${error.message}`);
        }
    }

    chooseBestFormat(formats, quality) {
        // Filter for video+audio formats
        const videoWithAudio = formats.filter(format => 
            format.hasAudio && format.hasVideo
        );

        switch (quality) {
            case 'highest':
                return videoWithAudio.sort((a, b) => b.bitrate - a.bitrate)[0];
            case 'lowest':
                return videoWithAudio.sort((a, b) => a.bitrate - b.bitrate)[0];
            case '720p':
                return videoWithAudio.find(f => f.qualityLabel === '720p') || videoWithAudio[0];
            case '480p':
                return videoWithAudio.find(f => f.qualityLabel === '480p') || videoWithAudio[0];
            default:
                return videoWithAudio[0];
        }
    }

    async downloadInstagram(url, phoneNumber) {
        try {
            // Instagram download logic - using generic download for now
            // You can implement specific Instagram downloading logic here later
            console.log('Downloading from Instagram:', url);
            return await this.downloadGeneric(url, phoneNumber);
        } catch (error) {
            throw new Error(`Instagram download failed: ${error.message}`);
        }
    }

    async downloadGeneric(url, phoneNumber, options = {}) {
        try {
            const userDir = path.join(this.downloadsDir, phoneNumber);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }

            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'identity',
                    'Connection': 'keep-alive'
                },
                timeout: 30000
            });

            const contentType = response.headers['content-type'];
            const contentDisposition = response.headers['content-disposition'];
            const extension = this.getExtensionFromContentType(contentType, url, contentDisposition);
            const filename = `download_${Date.now()}${extension}`;
            const filePath = path.join(userDir, filename);

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                let downloadedBytes = 0;
                let totalBytes = parseInt(response.headers['content-length'], 10) || 0;

                response.data.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    // You can add progress reporting here if needed
                });

                writer.on('finish', () => {
                    const stats = fs.statSync(filePath);
                    resolve({
                        path: filePath,
                        name: filename,
                        size: stats.size,
                        type: this.getFileTypeFromExtension(extension),
                        url: url,
                        originalName: this.getOriginalFilename(contentDisposition, url)
                    });
                });
                
                writer.on('error', (error) => {
                    // Clean up partial file on error
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    reject(error);
                });

                // Handle request errors
                response.data.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Generic download failed: ${error.message}`);
        }
    }

    getExtensionFromContentType(contentType, url, contentDisposition = '') {
        // First try to get extension from content-disposition
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
                const filename = filenameMatch[1];
                const dotIndex = filename.lastIndexOf('.');
                if (dotIndex !== -1) {
                    return filename.substring(dotIndex);
                }
            }
        }

        // Then try content-type
        if (contentType) {
            const extensions = {
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/png': '.png',
                'image/gif': '.gif',
                'image/webp': '.webp',
                'image/svg+xml': '.svg',
                'video/mp4': '.mp4',
                'video/mpeg': '.mpeg',
                'video/quicktime': '.mov',
                'video/webm': '.webm',
                'video/x-msvideo': '.avi',
                'video/x-ms-wmv': '.wmv',
                'audio/mpeg': '.mp3',
                'audio/wav': '.wav',
                'audio/ogg': '.ogg',
                'audio/x-m4a': '.m4a',
                'application/pdf': '.pdf',
                'text/plain': '.txt',
                'application/zip': '.zip',
                'application/x-rar-compressed': '.rar'
            };
            
            const extension = extensions[contentType.split(';')[0].trim()];
            if (extension) return extension;
        }
        
        // Fallback to URL extension
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const dotIndex = pathname.lastIndexOf('.');
            if (dotIndex !== -1) {
                const ext = pathname.substring(dotIndex);
                // Basic validation to ensure it's a reasonable extension
                if (ext.length <= 8 && /^\.\w+$/.test(ext)) {
                    return ext;
                }
            }
        } catch (e) {
            // URL parsing failed, try simple string method
            const urlParts = url.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            const dotIndex = lastPart.lastIndexOf('.');
            if (dotIndex !== -1) {
                const ext = lastPart.substring(dotIndex);
                if (ext.length <= 8 && /^\.\w+$/.test(ext)) {
                    return ext;
                }
            }
        }
        
        return '.bin';
    }

    getOriginalFilename(contentDisposition, url) {
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
                return filenameMatch[1];
            }
        }
        
        // Extract from URL as fallback
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.split('/').pop() || 'download';
        } catch (e) {
            return url.split('/').pop() || 'download';
        }
    }

    getFileTypeFromExtension(extension) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff'];
        const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.mpeg', '.mpg'];
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma'];
        const documentExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.xls', '.xlsx', '.ppt', '.pptx'];
        
        const ext = extension.toLowerCase();
        
        if (imageExtensions.includes(ext)) return 'image';
        if (videoExtensions.includes(ext)) return 'video';
        if (audioExtensions.includes(ext)) return 'audio';
        if (documentExtensions.includes(ext)) return 'document';
        if (ext === '.zip' || ext === '.rar' || ext === '.7z') return 'archive';
        
        return 'unknown';
    }

    getUserDownloads(phoneNumber) {
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (!fs.existsSync(userDir)) return [];
        
        return fs.readdirSync(userDir).map(file => {
            const filePath = path.join(userDir, file);
            try {
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    date: stats.mtime,
                    type: this.getFileTypeFromExtension(path.extname(file)),
                    path: filePath
                };
            } catch (error) {
                console.error(`Error reading file ${filePath}:`, error);
                return null;
            }
        }).filter(Boolean); // Remove null entries
    }

    deleteUserFile(phoneNumber, filename) {
        const filePath = path.join(this.downloadsDir, phoneNumber, filename);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                return true;
            } catch (error) {
                console.error(`Error deleting file ${filePath}:`, error);
                return false;
            }
        }
        return false;
    }

    deleteAllUserFiles(phoneNumber) {
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (fs.existsSync(userDir)) {
            try {
                fs.rmSync(userDir, { recursive: true, force: true });
                return true;
            } catch (error) {
                console.error(`Error deleting user directory ${userDir}:`, error);
                return false;
            }
        }
        return true; // Directory doesn't exist, so consider it deleted
    }

    getUserDirectory(phoneNumber) {
        return path.join(this.downloadsDir, phoneNumber);
    }

    getStorageUsage(phoneNumber) {
        const userDir = this.getUserDirectory(phoneNumber);
        if (!fs.existsSync(userDir)) return 0;
        
        let totalSize = 0;
        try {
            const files = fs.readdirSync(userDir);
            files.forEach(file => {
                const filePath = path.join(userDir, file);
                try {
                    totalSize += fs.statSync(filePath).size;
                } catch (error) {
                    console.error(`Error getting stats for ${filePath}:`, error);
                }
            });
        } catch (error) {
            console.error(`Error reading user directory ${userDir}:`, error);
        }
        
        return totalSize;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async cleanupOldFiles(phoneNumber, maxAgeHours = 24) {
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (!fs.existsSync(userDir)) return 0;
        
        const now = Date.now();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
        let deletedCount = 0;
        
        try {
            const files = fs.readdirSync(userDir);
            for (const file of files) {
                const filePath = path.join(userDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > maxAgeMs) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                } catch (error) {
                    console.error(`Error cleaning up file ${filePath}:`, error);
                }
            }
        } catch (error) {
            console.error(`Error during cleanup for ${userDir}:`, error);
        }
        
        return deletedCount;
    }

    async downloadFromSearch(query, phoneNumber, type = 'video') {
        try {
            const searchUrl = await this.searchContent(query, type);
            if (searchUrl) {
                return await this.downloadContent(searchUrl, phoneNumber);
            }
            throw new Error('No results found for your search');
        } catch (error) {
            throw new Error(`Search download failed: ${error.message}`);
        }
    }

    async searchContent(query, type = 'video') {
        // Placeholder for search functionality
        // In a real implementation, you would integrate with a search API
        console.log(`Searching for ${type}: ${query}`);
        return `https://example.com/${type}/${encodeURIComponent(query)}`;
    }

    // Utility method to check if a URL is supported
    isUrlSupported(url) {
        return Object.keys(this.supportedWebsites).some(site => 
            url.includes(site)
        );
    }

    // Method to get download progress (useful for large files)
    async downloadWithProgress(url, phoneNumber, onProgress) {
        // Implementation for progress tracking would go here
        return await this.downloadGeneric(url, phoneNumber);
    }
}

module.exports = DownloadManager;
