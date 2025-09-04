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
        
        // Supported websites and their handlers
        this.supportedWebsites = {
            'youtube.com': this.downloadYouTube.bind(this),
            'youtu.be': this.downloadYouTube.bind(this),
            'instagram.com': this.downloadInstagram.bind(this),
            'xvideos.com': this.downloadXvideos.bind(this),
            'twitter.com': this.downloadTwitter.bind(this),
            'pornpics.com': this.downloadPornpics.bind(this),
            'motherless.com': this.downloadMotherless.bind(this),
            'pornhits.com': this.downloadPornHits.bind(this),
            'x.com': this.downloadTwitter.bind(this),
            'tiktok.com': this.downloadTikTok.bind(this),
            'facebook.com': this.downloadFacebook.bind(this),
            'reddit.com': this.downloadReddit.bind(this),
            'tik.porn': this.downloadTikporn.bind(this),
            'pinterest.com': this.downloadPinterest.bind(this),
            'spotify.com': this.downloadSpotify.bind(this),
            'soundcloud.com': this.downloadSoundCloud.bind(this),
            'pornhub.com': this.downloadPornhub.bind(this)
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
        // Instagram download logic using external API or scraping
        try {
            // This would typically use an Instagram API or scraping service
            // For now, we'll use a generic download
            return await this.downloadGeneric(url, phoneNumber);
        } catch (error) {
            throw new Error(`Instagram download failed: ${error.message}`);
        }
    }

    async downloadTwitter(url, phoneNumber) {
        // Twitter download logic
        try {
            // Use twitter-dl or similar service
            const userDir = path.join(this.downloadsDir, phoneNumber);
            const filename = `twitter_${Date.now()}.mp4`;
            const filePath = path.join(userDir, filename);

            // This would use a Twitter download API
            return await this.downloadGeneric(url, phoneNumber);
        } catch (error) {
            throw new Error(`Twitter download failed: ${error.message}`);
        }
    }

    async downloadTikTok(url, phoneNumber) {
        // TikTok download logic
        try {
            // Use tiktok-dl or similar service
            return await this.downloadGeneric(url, phoneNumber);
        } catch (error) {
            throw new Error(`TikTok download failed: ${error.message}`);
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
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const contentType = response.headers['content-type'];
            const extension = this.getExtensionFromContentType(contentType, url);
            const filename = `download_${Date.now()}${extension}`;
            const filePath = path.join(userDir, filename);

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    const stats = fs.statSync(filePath);
                    resolve({
                        path: filePath,
                        name: filename,
                        size: stats.size,
                        type: this.getFileTypeFromExtension(extension),
                        url: url
                    });
                });
                writer.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Generic download failed: ${error.message}`);
        }
    }

    getExtensionFromContentType(contentType, url) {
        if (contentType) {
            const extensions = {
                'image/jpeg': '.jpg',
                'image/png': '.png',
                'image/gif': '.gif',
                'image/webp': '.webp',
                'video/mp4': '.mp4',
                'video/webm': '.webm',
                'audio/mpeg': '.mp3',
                'audio/wav': '.wav',
                'application/pdf': '.pdf'
            };
            return extensions[contentType] || '.bin';
        }
        
        // Fallback to URL extension
        const urlParts = url.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        const dotIndex = lastPart.lastIndexOf('.');
        if (dotIndex !== -1) {
            return lastPart.substring(dotIndex);
        }
        
        return '.bin';
    }

    getFileTypeFromExtension(extension) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv'];
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a'];
        
        if (imageExtensions.includes(extension.toLowerCase())) return 'image';
        if (videoExtensions.includes(extension.toLowerCase())) return 'video';
        if (audioExtensions.includes(extension.toLowerCase())) return 'audio';
        return 'document';
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
                date: stats.mtime,
                type: this.getFileTypeFromExtension(path.extname(file))
            };
        });
    }

    deleteUserFile(phoneNumber, filename) {
        const filePath = path.join(this.downloadsDir, phoneNumber, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    }

    getUserDirectory(phoneNumber) {
        return path.join(this.downloadsDir, phoneNumber);
    }

    getStorageUsage(phoneNumber) {
        const userDir = this.getUserDirectory(phoneNumber);
        if (!fs.existsSync(userDir)) return 0;
        
        const files = fs.readdirSync(userDir);
        let totalSize = 0;
        
        files.forEach(file => {
            const filePath = path.join(userDir, file);
            totalSize += fs.statSync(filePath).size;
        });
        
        return totalSize;
    }

    // Additional platform-specific download methods
    async downloadFacebook(url, phoneNumber) {
        // Facebook download implementation
        return await this.downloadGeneric(url, phoneNumber);
    }

    async downloadReddit(url, phoneNumber) {
        // Reddit download implementation
        return await this.downloadGeneric(url, phoneNumber);
    }

    async downloadPinterest(url, phoneNumber) {
        // Pinterest download implementation
        return await this.downloadGeneric(url, phoneNumber);
    }

    async downloadSpotify(url, phoneNumber) {
        // Spotify download implementation (would need special handling)
        return await this.downloadGeneric(url, phoneNumber);
    }

    async downloadSoundCloud(url, phoneNumber) {
        // SoundCloud download implementation
        return await this.downloadGeneric(url, phoneNumber);
    }

    // Advanced: Download from search query
    async downloadFromSearch(query, phoneNumber, type = 'video') {
        try {
            // This would use a search API to find content
            // For now, we'll simulate this functionality
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
        // This would integrate with a search API
        // For demonstration, return a mock URL
        return `https://example.com/${type}/${encodeURIComponent(query)}`;
    }
}

module.exports = DownloadManager;
