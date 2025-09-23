const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const util = require('util');
const axios = require('axios');

const execPromise = util.promisify(exec);

class RealDownloadManager {
    constructor() {
        this.downloadsDir = path.join(__dirname, 'downloads');
        this.tempDir = path.join(__dirname, 'temp');
        this.ensureDirectoriesExist();
    }

    ensureDirectoriesExist() {
        [this.downloadsDir, this.tempDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // REAL YouTube download using yt-dlp
    async downloadYouTube(url, phoneNumber, format = 'mp4') {
        try {
            const userDir = path.join(this.downloadsDir, phoneNumber);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }

            let ytDlpCommand;
            
            if (format === 'mp3') {
                ytDlpCommand = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${userDir}/%(title)s.%(ext)s" "${url}"`;
            } else {
                ytDlpCommand = `yt-dlp -f "best[height<=720]" -o "${userDir}/%(title)s.%(ext)s" "${url}"`;
            }

            console.log('Executing:', ytDlpCommand);
            
            const { stdout, stderr } = await execPromise(ytDlpCommand, { timeout: 300000 });
            
            // Find the downloaded file
            const files = fs.readdirSync(userDir);
            const downloadedFile = files.find(file => file.includes(path.basename(url)) || stdout.includes(file));
            
            if (!downloadedFile) {
                throw new Error('Downloaded file not found');
            }

            const filePath = path.join(userDir, downloadedFile);
            const stats = fs.statSync(filePath);

            return {
                path: filePath,
                name: downloadedFile,
                size: this.formatBytes(stats.size),
                type: format === 'mp3' ? 'audio' : 'video',
                success: true
            };

        } catch (error) {
            console.error('YouTube download error:', error);
            
            // Fallback to ytdl-core if yt-dlp fails
            return await this.downloadYouTubeFallback(url, phoneNumber, format);
        }
    }

    // Fallback YouTube download
    async downloadYouTubeFallback(url, phoneNumber, format) {
        try {
            const ytdl = await import('ytdl-core');
            const userDir = path.join(this.downloadsDir, phoneNumber);
            
            const info = await ytdl.default.getInfo(url);
            const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `${title}_${Date.now()}.${format === 'mp3' ? 'mp3' : 'mp4'}`;
            const filePath = path.join(userDir, filename);

            const video = ytdl.default(url, {
                quality: format === 'mp3' ? 'highestaudio' : 'highest',
                filter: format === 'mp3' ? 'audioonly' : 'audioandvideo'
            });

            return new Promise((resolve, reject) => {
                const writer = fs.createWriteStream(filePath);
                video.pipe(writer);

                writer.on('finish', () => {
                    const stats = fs.statSync(filePath);
                    resolve({
                        path: filePath,
                        name: filename,
                        size: this.formatBytes(stats.size),
                        type: format === 'mp3' ? 'audio' : 'video',
                        success: true
                    });
                });

                writer.on('error', reject);
            });
        } catch (fallbackError) {
            throw new Error(`YouTube download failed: ${fallbackError.message}`);
        }
    }

    // REAL Instagram download using external API
    async downloadInstagram(url, phoneNumber) {
        try {
            // Using a public Instagram downloader API
            const apiUrl = `https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index`;
            
            const response = await axios.get(apiUrl, {
                params: { url: url },
                headers: {
                    'X-RapidAPI-Key': 'your-api-key-here', // You need to get a free API key
                    'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com'
                },
                timeout: 30000
            });

            if (response.data.media) {
                const mediaUrl = response.data.media;
                return await this.downloadGeneric(mediaUrl, phoneNumber, 'instagram');
            }
            
            throw new Error('No media found in Instagram response');
        } catch (error) {
            throw new Error(`Instagram download failed: ${error.message}`);
        }
    }

    // REAL TikTok download using external API
    async downloadTikTok(url, phoneNumber) {
        try {
            const apiUrl = `https://tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com/vid/index`;
            
            const response = await axios.get(apiUrl, {
                params: { url: url },
                headers: {
                    'X-RapidAPI-Key': 'your-api-key-here',
                    'X-RapidAPI-Host': 'tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com'
                },
                timeout: 30000
            });

            if (response.data.video) {
                const videoUrl = response.data.video[0];
                return await this.downloadGeneric(videoUrl, phoneNumber, 'tiktok');
            }
            
            throw new Error('No video found in TikTok response');
        } catch (error) {
            throw new Error(`TikTok download failed: ${error.message}`);
        }
    }

    // REAL Generic file download
    async downloadGeneric(url, phoneNumber, source = 'generic') {
        try {
            const userDir = path.join(this.downloadsDir, phoneNumber);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }

            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'identity',
                    'Connection': 'keep-alive'
                }
            });

            const contentDisposition = response.headers['content-disposition'];
            const contentType = response.headers['content-type'];
            const filename = this.generateFilename(url, contentDisposition, contentType, source);
            const filePath = path.join(userDir, filename);

            const writer = fs.createWriteStream(filePath);

            return new Promise((resolve, reject) => {
                let downloadedBytes = 0;
                const totalBytes = parseInt(response.headers['content-length'], 10);

                response.data.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    // Progress reporting can be added here
                });

                response.data.pipe(writer);

                writer.on('finish', () => {
                    const stats = fs.statSync(filePath);
                    resolve({
                        path: filePath,
                        name: filename,
                        size: this.formatBytes(stats.size),
                        type: this.getFileType(filename),
                        success: true
                    });
                });

                writer.on('error', (error) => {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    reject(error);
                });

                response.data.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    // REAL Search and download first YouTube result
    async searchAndDownload(query, phoneNumber, format = 'mp4') {
        try {
            // Search YouTube using Invidious API
            const searchUrl = `https://inv.odyssey346.dev/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
            const response = await axios.get(searchUrl, { timeout: 15000 });
            
            if (response.data.length === 0) {
                throw new Error('No results found');
            }

            const firstResult = response.data[0];
            const youtubeUrl = `https://youtube.com/watch?v=${firstResult.videoId}`;
            
            await this.downloadYouTube(youtubeUrl, phoneNumber, format);

            return {
                title: firstResult.title,
                url: youtubeUrl,
                duration: this.formatDuration(firstResult.lengthSeconds),
                author: firstResult.author
            };
        } catch (error) {
            throw new Error(`Search and download failed: ${error.message}`);
        }
    }

    // Helper methods
    generateFilename(url, contentDisposition, contentType, source) {
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?(.+?)"?$/);
            if (match) return match[1];
        }

        const ext = this.getExtensionFromContentType(contentType) || 
                   (source === 'instagram' ? '.mp4' : '.download');
        
        return `${source}_${Date.now()}${ext}`;
    }

    getExtensionFromContentType(contentType) {
        const extensions = {
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'audio/mpeg': '.mp3',
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif'
        };
        return extensions[contentType] || null;
    }

    getFileType(filename) {
        const ext = path.extname(filename).toLowerCase();
        if (['.mp4', '.avi', '.mov', '.webm'].includes(ext)) return 'video';
        if (['.mp3', '.wav', '.m4a'].includes(ext)) return 'audio';
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) return 'image';
        return 'file';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        if (!seconds) return 'Unknown';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
                    size: this.formatBytes(stats.size),
                    date: stats.mtime,
                    path: filePath
                };
            } catch (error) {
                return null;
            }
        }).filter(Boolean);
    }

    getStorageUsage(phoneNumber) {
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (!fs.existsSync(userDir)) return '0 Bytes';

        let totalSize = 0;
        const files = fs.readdirSync(userDir);
        files.forEach(file => {
            const filePath = path.join(userDir, file);
            try {
                totalSize += fs.statSync(filePath).size;
            } catch (error) {
                console.error('Error getting file size:', error);
            }
        });

        return this.formatBytes(totalSize);
    }
}

module.exports = RealDownloadManager;