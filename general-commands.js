const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const mime = require('mime-types');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');

class GeneralCommands {
    constructor(userManager, downloadManager, subscriptionManager) {
        this.userManager = userManager;
        this.downloadManager = downloadManager;
        this.subscriptionManager = subscriptionManager;
        this.activationCode = "Abbie0121";
        this.downloadsDir = path.join(__dirname, 'downloads');
        this.userSearches = new Map(); // Store user search results
        
        // Ensure downloads directory exists
        if (!fs.existsSync(this.downloadsDir)) {
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }
    }

    // ... (keep the activation and general command handling methods the same) ...

    async handleGeneralCommand(sock, sender, phoneNumber, username, text, message) {
        const user = await this.userManager.getUser(phoneNumber);
        if (!user || !user.isActivated) return false;

        // Check if user has active subscription or free downloads remaining
        const canDownload = this.subscriptionManager.canUserDownload(phoneNumber);
        
        // Handle any message that starts with "search" (case insensitive)
        if (text.toLowerCase().startsWith('search ')) {
            const query = text.substring(text.toLowerCase().indexOf('search ') + 7).trim();
            if (!query) {
                await sock.sendMessage(sender, { text: "Usage: search <query>" });
                return true;
            }

            await this.handleSearchCommand(sock, sender, query, phoneNumber);
            return true;
        }

        // Handle any message that starts with "download" (case insensitive)
        if (text.toLowerCase().startsWith('download ')) {
            if (!canDownload) {
                await this.sendSubscriptionMessage(sock, sender, phoneNumber);
                return true;
            }

            const downloadParam = text.substring(text.toLowerCase().indexOf('download ') + 9).trim();
            
            // Check if it's a number (selection from search results)
            if (/^\d+$/.test(downloadParam)) {
                const selection = parseInt(downloadParam);
                await this.handleDownloadSelection(sock, sender, phoneNumber, selection);
                return true;
            }
            
            // Otherwise treat as URL
            if (!downloadParam) {
                await sock.sendMessage(sender, { text: "Usage: download <url> or download <number>" });
                return true;
            }

            await this.handleDownloadCommand(sock, sender, downloadParam, phoneNumber);
            return true;
        }

        // ... (keep other commands the same) ...

        return false;
    }

    async handleSearchCommand(sock, sender, query, phoneNumber) {
        try {
            await sock.sendMessage(sender, { text: `🔍 Searching for "${query}"...` });

            // Search using Google and extract image results
            const results = await this.searchGoogleImages(query);
            
            if (results.length === 0) {
                await sock.sendMessage(sender, { text: "No results found for your search." });
                return;
            }

            // Store results for this user
            this.userSearches.set(phoneNumber, results);

            let response = `📋 Search Results for "${query}":\n\n`;
            results.forEach((result, index) => {
                response += `${index + 1}. ${result.title}\n`;
                response += `   🔗 Source: ${result.source}\n`;
                response += `   ⬇️ Download: download ${index + 1}\n\n`;
            });

            response += `💡 Type "download <number>" to download any of these images.`;

            await sock.sendMessage(sender, { text: response });
            
        } catch (error) {
            console.error('Search error:', error);
            await sock.sendMessage(sender, { text: "❌ Search failed. Please try again later." });
        }
    }

    async searchGoogleImages(query) {
        try {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 15000
            });
            
            const $ = cheerio.load(response.data);
            const results = [];
            
            // Extract image results from Google search
            $('div[data-ved]').each((i, element) => {
                if (results.length >= 6) return false; // Limit to 6 results
                
                const imgElement = $(element).find('img');
                const src = imgElement.attr('src') || imgElement.attr('data-src');
                const alt = imgElement.attr('alt') || 'Image';
                
                if (src && src.startsWith('http')) {
                    results.push({
                        title: alt.substring(0, 50) + (alt.length > 50 ? '...' : ''),
                        type: 'image',
                        source: 'Google Images',
                        url: src
                    });
                }
            });
            
            return results;
        } catch (error) {
            console.error('Google search error:', error.message);
            return [];
        }
    }

    async handleDownloadSelection(sock, sender, phoneNumber, selection) {
        const results = this.userSearches.get(phoneNumber);
        
        if (!results || results.length === 0) {
            await sock.sendMessage(sender, { text: "❌ No recent search results found. Please perform a search first." });
            return;
        }
        
        if (selection < 1 || selection > results.length) {
            await sock.sendMessage(sender, { text: `❌ Invalid selection. Please choose between 1 and ${results.length}.` });
            return;
        }
        
        const selectedResult = results[selection - 1];
        await this.handleDownloadCommand(sock, sender, selectedResult.url, phoneNumber);
    }

    async handleDownloadCommand(sock, sender, url, phoneNumber) {
        try {
            await sock.sendMessage(sender, { text: "⬇️ Downloading file..." });
            
            // Check if user can download
            if (!this.subscriptionManager.canUserDownload(phoneNumber)) {
                await this.sendSubscriptionMessage(sock, sender, phoneNumber);
                return;
            }

            // Download the actual file
            const fileInfo = await this.downloadActualFile(url, phoneNumber);
            
            if (!fileInfo) {
                await sock.sendMessage(sender, { 
                    text: "❌ Failed to download file. The URL might be invalid or unsupported."
                });
                return;
            }
            
            // Record the download
            this.subscriptionManager.recordDownload(phoneNumber);
            
            // Send the file based on its type
            const fileBuffer = fs.readFileSync(fileInfo.path);
            
            if (fileInfo.type.startsWith('image/')) {
                await sock.sendMessage(sender, {
                    image: fileBuffer,
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            } else if (fileInfo.type.startsWith('video/')) {
                await sock.sendMessage(sender, {
                    video: fileBuffer,
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            } else if (fileInfo.type.startsWith('audio/')) {
                await sock.sendMessage(sender, {
                    audio: fileBuffer,
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            } else {
                await sock.sendMessage(sender, {
                    document: fileBuffer,
                    fileName: fileInfo.name,
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            }
            
            // Clean up the temporary file
            fs.unlinkSync(fileInfo.path);
            
            // Check if user needs subscription after this download
            const downloadsLeft = this.subscriptionManager.getDownloadsLeft(phoneNumber);
            if (downloadsLeft <= 2) {
                await sock.sendMessage(sender, {
                    text: `⚠️ You have ${downloadsLeft} download(s) left. Please subscribe to continue downloading.`
                });
            }
            
        } catch (error) {
            console.error('Download error:', error);
            await sock.sendMessage(sender, { 
                text: `❌ Download failed: ${error.message}`
            });
        }
    }

    // ... (keep the rest of the methods the same) ...
}

module.exports = GeneralCommands;
