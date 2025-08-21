const axios = require('axios');
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
