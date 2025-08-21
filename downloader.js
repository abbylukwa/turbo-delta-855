const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const sizeOf = require('image-size');

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
                responseType: 'stream',
                timeout: 15000
            });

            const writer = fs.createWriteStream(filePath);
            
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', async () => {
                    try {
                        // Get image dimensions
                        const dimensions = sizeOf(filePath);
                        console.log(`Image downloaded successfully: ${filePath} (${dimensions.width}x${dimensions.height})`);
                        resolve({
                            path: filePath,
                            dimensions: dimensions,
                            size: (await fs.stat(filePath)).size
                        });
                    } catch (error) {
                        console.log(`Image downloaded successfully: ${filePath}`);
                        resolve({ path: filePath });
                    }
                });
                writer.on('error', reject);
            });
            
        } catch (error) {
            console.error('Error downloading image:', error.message);
            throw error;
        }
    }

    // List downloaded images with details
    async listDownloadedImages() {
        try {
            await this.ensureDirectory();
            const files = await fs.readdir(this.downloadPath);
            
            const imageFiles = [];
            for (const file of files) {
                if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file)) {
                    try {
                        const filePath = path.join(this.downloadPath, file);
                        const stats = await fs.stat(filePath);
                        const dimensions = sizeOf(filePath);
                        
                        imageFiles.push({
                            name: file,
                            path: filePath,
                            size: stats.size,
                            dimensions: dimensions,
                            modified: stats.mtime
                        });
                    } catch (error) {
                        imageFiles.push({
                            name: file,
                            path: path.join(this.downloadPath, file),
                            error: 'Could not read file info'
                        });
                    }
                }
            }
            
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
            const dimensions = sizeOf(filePath);
            
            return {
                name: imageName,
                path: filePath,
                size: stats.size,
                dimensions: dimensions,
                modified: stats.mtime
            };
        } catch (error) {
            console.error('Error getting image info:', error);
            return null;
        }
    }

    // Delete downloaded image
    async deleteImage(imageName) {
        try {
            const filePath = path.join(this.downloadPath, imageName);
            await fs.remove(filePath);
            console.log(`Deleted image: ${imageName}`);
            return true;
        } catch (error) {
            console.error('Error deleting image:', error);
            throw error;
        }
    }

    // Clear all downloaded images
    async clearDownloads() {
        try {
            await fs.emptyDir(this.downloadPath);
            console.log('Cleared all downloaded images');
            return true;
        } catch (error) {
            console.error('Error clearing downloads:', error);
            throw error;
        }
    }
}

module.exports = ImageDownloader;
