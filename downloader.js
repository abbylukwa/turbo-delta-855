const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class ImageDownloader {
    constructor() {
        this.downloadPath = process.env.DOWNLOAD_PATH || './downloads';
        this.websiteUrl = process.env.WEBSITE_URL || 'https://your-website.com/images';
    }

    // Ensure download directory exists
    async ensureDirectory() {
        try {
            await fs.ensureDir(this.downloadPath);
            console.log(`Download directory ensured: ${this.downloadPath}`);
        } catch (error) {
            console.error('Error creating download directory:', error);
        }
    }

    // Download single image
    async downloadImage(imageName, customPath = null) {
        try {
            await this.ensureDirectory();
            
            const imageUrl = `${this.websiteUrl}/${imageName}`;
            const downloadDir = customPath || this.downloadPath;
            const filePath = path.join(downloadDir, imageName);
            
            console.log(`Downloading image from: ${imageUrl}`);
            
            const response = await axios({
                method: 'GET',
                url: imageUrl,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(filePath);
            
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`Image downloaded successfully: ${filePath}`);
                    resolve(filePath);
                });
                writer.on('error', reject);
            });
            
        } catch (error) {
            console.error('Error downloading image:', error.message);
            throw error;
        }
    }

    // Download multiple images
    async downloadMultipleImages(imageNames, customPath = null) {
        try {
            const results = [];
            for (const imageName of imageNames) {
                try {
                    const filePath = await this.downloadImage(imageName, customPath);
                    results.push({ imageName, success: true, path: filePath });
                } catch (error) {
                    results.push({ imageName, success: false, error: error.message });
                }
            }
            return results;
        } catch (error) {
            console.error('Error downloading multiple images:', error);
            throw error;
        }
    }

    // List downloaded images
    async listDownloadedImages() {
        try {
            await this.ensureDirectory();
            const files = await fs.readdir(this.downloadPath);
            const imageFiles = files.filter(file => 
                /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file)
            );
            return imageFiles;
        } catch (error) {
            console.error('Error listing images:', error);
            return [];
        }
    }

    // Get image info
    async getImageInfo(imageName) {
        try {
            const filePath = path.join(this.downloadPath, imageName);
            const stats = await fs.stat(filePath);
            return {
                name: imageName,
                path: filePath,
                size: stats.size,
                modified: stats.mtime
            };
        } catch (error) {
            console.error('Error getting image info:', error);
            return null;
        }
    }
}

module.exports = ImageDownloader;
