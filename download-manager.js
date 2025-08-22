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
}

module.exports = DownloadManager;
