const axios = require('axios');
const fs = require('fs');
const path = require('path');

class DownloadManager {
    constructor() {
        this.downloadsDir = path.join(__dirname, 'downloads');
        this.ensureDownloadsDirectoryExists();
    }

    ensureDownloadsDirectoryExists() {
        if (!fs.existsSync(this.downloadsDir)) {
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }
    }

    async downloadFile(url, phoneNumber) {
        try {
            // Create user directory if it doesn't exist
            const userDir = path.join(this.downloadsDir, phoneNumber);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }

            // Determine file type from URL
            const fileType = this.getFileTypeFromUrl(url);
            const extension = this.getExtensionFromType(fileType);
            const filename = `download_${Date.now()}${extension}`;
            const filePath = path.join(userDir, filename);

            // Download the file
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    const stats = fs.statSync(filePath);
                    resolve({
                        path: filePath,
                        name: filename,
                        size: stats.size,
                        type: fileType
                    });
                });
                writer.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    getFileTypeFromUrl(url) {
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
        if (url.match(/\.(mp4|mov|avi|wmv|flv|webm)$/i)) return 'video';
        if (url.match(/\.(mp3|wav|ogg|flac)$/i)) return 'audio';
        return 'document';
    }

    getExtensionFromType(fileType) {
        switch (fileType) {
            case 'image': return '.jpg';
            case 'video': return '.mp4';
            case 'audio': return '.mp3';
            default: return '.bin';
        }
    }

    getUserDownloads(phoneNumber) {
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (!fs.existsSync(userDir)) return [];
        
        return fs.readdirSync(userDir).map(file => {
            const filePath = path.join(userDir, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                date: stats.mtime
            };
        });
    }
}

module.exports = DownloadManager;    }

    getExtensionFromType(fileType) {
        switch (fileType) {
            case 'image': return '.jpg';
            case 'video': return '.mp4';
            case 'audio': return '.mp3';
            default: return '.bin';
        }
    }

    getUserDownloads(phoneNumber) {
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (!fs.existsSync(userDir)) return [];
        
        return fs.readdirSync(userDir).map(file => {
            const filePath = path.join(userDir, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                date: stats.mtime
            };
        });
    }
}

module.exports = DownloadManager;const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const sizeOf = require('image-size');
const ffmpeg = require('fluent-ffmpeg');

class EnhancedDownloader {
    constructor() {
        this.downloadPath = process.env.DOWNLOAD_PATH || './downloads';
        this.websiteUrl = process.env.WEBSITE_URL || 'https://youPorn.com';
        this.searchResults = new Map(); // Store search results by user
    }

    async ensureDirectory() {
        try {
            await fs.ensureDir(this.downloadPath);
        } catch (error) {
            console.error('Error creating directory:', error);
        }
    }

    // Store search results for user
    storeSearchResults(phoneNumber, results) {
        this.searchResults.set(phoneNumber, {
            results: results,
            timestamp: Date.now()
        });
        
        // Clean up old results after 10 minutes
        setTimeout(() => {
            this.searchResults.delete(phoneNumber);
        }, 10 * 60 * 1000);
    }

    // Get search results for user
    getSearchResults(phoneNumber) {
        const data = this.searchResults.get(phoneNumber);
        if (!data || Date.now() - data.timestamp > 10 * 60 * 1000) {
            this.searchResults.delete(phoneNumber);
            return null;
        }
        return data.results;
    }

    // Download media from various sources
    async downloadMedia(mediaUrl, filename, customPath = null) {
        try {
            await this.ensureDirectory();
            const downloadDir = customPath || this.downloadPath;
            const filePath = path.join(downloadDir, filename);
            
            console.log(`Downloading from: ${mediaUrl}`);
            
            const response = await axios({
                method: 'GET',
                url: mediaUrl,
                responseType: 'stream',
                timeout: 30000
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', async () => {
                    try {
                        const stats = await fs.stat(filePath);
                        let fileInfo = {
                            path: filePath,
                            size: stats.size,
                            type: this.getFileType(filename)
                        };

                        // Get media-specific info
                        if (fileInfo.type === 'image') {
                            const dimensions = sizeOf(filePath);
                            fileInfo.dimensions = dimensions;
                        } else if (fileInfo.type === 'video') {
                            fileInfo = await this.getVideoInfo(filePath, fileInfo);
                        }

                        resolve(fileInfo);
                    } catch (error) {
                        resolve({ path: filePath, error: 'Could not get file info' });
                    }
                });
                writer.on('error', reject);
            });

        } catch (error) {
            console.error('Download error:', error.message);
            throw error;
        }
    }

    // Get file type
    getFileType(filename) {
        const ext = path.extname(filename).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
            return 'image';
        } else if (['.mp4', '.avi', '.mov', '.wmv', '.webm'].includes(ext)) {
            return 'video';
        } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
            return 'audio';
        }
        return 'unknown';
    }

    // Get video information
    async getVideoInfo(filePath, fileInfo) {
        return new Promise((resolve) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (!err && metadata.format) {
                    fileInfo.duration = metadata.format.duration;
                    fileInfo.bitrate = metadata.format.bit_rate;
                    if (metadata.streams && metadata.streams[0]) {
                        fileInfo.resolution = `${metadata.streams[0].width}x${metadata.streams[0].height}`;
                    }
                }
                resolve(fileInfo);
            });
        });
    }

    // List downloaded media with filtering
    async listDownloads(filter = {}) {
        try {
            await this.ensureDirectory();
            const files = await fs.readdir(this.downloadPath);
            
            const mediaFiles = [];
            for (const file of files) {
                if (this.isMediaFile(file)) {
                    try {
                        const filePath = path.join(this.downloadPath, file);
                        const stats = await fs.stat(filePath);
                        const fileType = this.getFileType(file);
                        
                        mediaFiles.push({
                            name: file,
                            path: filePath,
                            type: fileType,
                            size: stats.size,
                            modified: stats.mtime
                        });
                    } catch (error) {
                        mediaFiles.push({
                            name: file,
                            error: 'Could not read file info'
                        });
                    }
                }
            }
            
            // Apply filters
            return mediaFiles.filter(file => {
                if (filter.type && file.type !== filter.type) return false;
                if (filter.minSize && file.size < filter.minSize) return false;
                return true;
            });
        } catch (error) {
            console.error('Error listing downloads:', error);
            return [];
        }
    }
}

module.exports = EnhancedDownloader;
