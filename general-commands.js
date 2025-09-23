const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const mime = require('mime-types');
const cheerio = require('cheerio');

class GeneralCommands {
    constructor(userManager, downloadManager, subscriptionManager) {
        this.userManager = userManager;
        this.downloadManager = downloadManager;
        this.subscriptionManager = subscriptionManager;
        this.activationCode = "Abbie911";
        this.downloadsDir = path.join(__dirname, 'downloads');
        this.userSearches = new Map();
        this.userDownloadLimits = new Map();
        
        // Ensure downloads directory exists
        if (!fs.existsSync(this.downloadsDir)) {
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }
    }

    async handleGeneralCommand(sock, sender, phoneNumber, username, text, message) {
        const command = text.toLowerCase().trim();
        
        try {
            switch (true) {
                case command === '!help':
                    await this.showHelp(sock, sender, phoneNumber);
                    return true;
                
                case command.startsWith('!download '):
                    await this.handleDownload(sock, sender, phoneNumber, text.substring(10).trim());
                    return true;
                
                case command.startsWith('!search '):
                    await this.handleSearch(sock, sender, phoneNumber, text.substring(8).trim());
                    return true;
                
                case command === '!mydownloads':
                    await this.showMyDownloads(sock, sender, phoneNumber);
                    return true;
                
                case command.startsWith('!delete '):
                    await this.deleteDownload(sock, sender, phoneNumber, text.substring(8).trim());
                    return true;
                
                case command === '!storage':
                    await this.showStorageUsage(sock, sender, phoneNumber);
                    return true;
                
                case command.startsWith('!get '):
                    await this.handleDirectDownload(sock, sender, phoneNumber, text.substring(5).trim());
                    return true;
                
                case command.startsWith('!yt '):
                    await this.handleYouTubeDownload(sock, sender, phoneNumber, text.substring(4).trim());
                    return true;
                
                case command.startsWith('!ig '):
                    await this.handleInstagramDownload(sock, sender, phoneNumber, text.substring(4).trim());
                    return true;
                
                case command.startsWith('!tt '):
                    await this.handleTikTokDownload(sock, sender, phoneNumber, text.substring(4).trim());
                    return true;
                
                case command.startsWith('!fb '):
                    await this.handleFacebookDownload(sock, sender, phoneNumber, text.substring(4).trim());
                    return true;
                
                case command === '!cleardownloads':
                    await this.clearDownloads(sock, sender, phoneNumber);
                    return true;
                
                case command.startsWith('!searchvideo '):
                    await this.handleVideoSearch(sock, sender, phoneNumber, text.substring(13).trim());
                    return true;
                
                case command.startsWith('!searchimage '):
                    await this.handleImageSearch(sock, sender, phoneNumber, text.substring(13).trim());
                    return true;
                
                case command.startsWith('!searchgame '):
                    await this.handleGameSearch(sock, sender, phoneNumber, text.substring(12).trim());
                    return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error in general command:', error);
            await sock.sendMessage(sender, {
                text: `❌ Error: ${error.message}`
            });
            return true;
        }
    }

    async showHelp(sock, sender, phoneNumber) {
        const user = await this.userManager.getUser(phoneNumber);
        const isPremium = this.subscriptionManager.isUserSubscribed(phoneNumber);
        
        let helpText = `🤖 *DOWNLOAD BOT HELP* 🤖\n\n`;
        helpText += `*Basic Commands:*\n`;
        helpText += `• !download [url] - Download from any website\n`;
        helpText += `• !get [url] - Direct download (no processing)\n`;
        helpText += `• !search [query] - Search for content\n`;
        helpText += `• !mydownloads - View your download history\n`;
        helpText += `• !delete [filename] - Delete a file\n`;
        helpText += `• !storage - Check your storage usage\n`;
        helpText += `• !cleardownloads - Clear all your downloads\n\n`;
        
        helpText += `*Platform Specific:*\n`;
        helpText += `• !yt [url/query] - YouTube download\n`;
        helpText += `• !ig [url] - Instagram download\n`;
        helpText += `• !tt [url] - TikTok download\n`;
        helpText += `• !fb [url] - Facebook download\n\n`;
        
        helpText += `*Advanced Search:*\n`;
        helpText += `• !searchvideo [query] - Search for videos\n`;
        helpText += `• !searchimage [query] - Search for images\n`;
        helpText += `• !searchgame [query] - Search for games\n\n`;
        
        if (isPremium) {
            helpText += `🎉 *Premium Features:* Unlimited downloads, Priority processing, Higher quality\n\n`;
        } else {
            helpText += `💎 Upgrade to premium with !subscription for unlimited downloads!\n\n`;
        }
        
        helpText += `📊 Your role: ${user.role}\n`;
        helpText += `💾 Storage used: ${this.formatBytes(this.downloadManager.getStorageUsage(phoneNumber))}`;
        
        await sock.sendMessage(sender, { text: helpText });
    }

    async handleDownload(sock, sender, phoneNumber, urlOrQuery) {
        // Check download limits for non-premium users
        if (!this.subscriptionManager.isUserSubscribed(phoneNumber)) {
            const today = new Date().toDateString();
            const userDownloads = this.userDownloadLimits.get(phoneNumber) || { date: today, count: 0 };
            
            if (userDownloads.date !== today) {
                userDownloads.date = today;
                userDownloads.count = 0;
            }
            
            if (userDownloads.count >= 5) { // Limit to 5 downloads per day for free users
                await sock.sendMessage(sender, {
                    text: `❌ Download limit reached! You've used ${userDownloads.count}/5 downloads today.\n` +
                          `💎 Upgrade to premium with !subscription for unlimited downloads!`
                });
                return;
            }
        }
        
        await sock.sendMessage(sender, {
            text: `⏳ Processing your download request...`
        });
        
        try {
            let result;
            
            // Check if it's a URL or a search query
            if (urlOrQuery.startsWith('http')) {
                result = await this.downloadManager.downloadContent(urlOrQuery, phoneNumber);
            } else {
                // Treat as search query
                result = await this.downloadManager.downloadFromSearch(urlOrQuery, phoneNumber);
            }
            
            // Update download count
            if (!this.subscriptionManager.isUserSubscribed(phoneNumber)) {
                const today = new Date().toDateString();
                const userDownloads = this.userDownloadLimits.get(phoneNumber) || { date: today, count: 0 };
                userDownloads.count++;
                this.userDownloadLimits.set(phoneNumber, userDownloads);
            }
            
            await sock.sendMessage(sender, {
                text: `✅ Download complete!\n` +
                      `📁 File: ${result.name}\n` +
                      `💾 Size: ${this.formatBytes(result.size)}\n` +
                      `🔗 Type: ${result.type}\n` +
                      `📊 Remaining today: ${this.getRemainingDownloads(phoneNumber)}/5`
            });
            
            // Send the actual file if it's not too large
            if (result.size < 45 * 1024 * 1024) { // 45MB limit for WhatsApp
                await sock.sendMessage(sender, {
                    document: { url: `file://${result.path}` },
                    fileName: result.name,
                    mimetype: this.getMimeType(result.name)
                });
            } else {
                await sock.sendMessage(sender, {
                    text: `📁 File is too large to send via WhatsApp. Use !mydownloads to access it.`
                });
            }
            
        } catch (error) {
            await sock.sendMessage(sender, {
                text: `❌ Download failed: ${error.message}`
            });
        }
    }

    async handleDirectDownload(sock, sender, phoneNumber, url) {
        try {
            await sock.sendMessage(sender, {
                text: `⏳ Starting direct download...`
            });
            
            const result = await this.downloadManager.downloadContent(url, phoneNumber, {
                direct: true,
                quality: 'original'
            });
            
            await sock.sendMessage(sender, {
                text: `✅ Direct download complete!\n` +
                      `📁 ${result.name} (${this.formatBytes(result.size)})`
            });
            
        } catch (error) {
            await sock.sendMessage(sender, {
                text: `❌ Direct download failed: ${error.message}`
            });
        }
    }

    async handleYouTubeDownload(sock, sender, phoneNumber, input) {
        try {
            let url = input;
            
            // If input doesn't look like a URL, search for it
            if (!input.startsWith('http')) {
                const searchResults = await this.searchYouTube(input);
                if (searchResults.length > 0) {
                    url = searchResults[0].url;
                    await sock.sendMessage(sender, {
                        text: `🎥 Found: ${searchResults[0].title}`
                    });
                } else {
                    throw new Error('No YouTube videos found for your search');
                }
            }
            
            await sock.sendMessage(sender, {
                text: `⏳ Downloading from YouTube...`
            });
            
            const result = await this.downloadManager.downloadYouTube(url, phoneNumber, {
                quality: 'highest'
            });
            
            await sock.sendMessage(sender, {
                text: `✅ YouTube download complete!\n` +
                      `🎬 ${result.title}\n` +
                      `⏱️ Duration: ${this.formatDuration(result.duration)}\n` +
                      `💾 Size: ${this.formatBytes(result.size)}`
            });
            
            // Send video if not too large
            if (result.size < 45 * 1024 * 1024) {
                await sock.sendMessage(sender, {
                    video: { url: `file://${result.path}` },
                    caption: result.title
                });
            }
            
        } catch (error) {
            await sock.sendMessage(sender, {
                text: `❌ YouTube download failed: ${error.message}`
            });
        }
    }

    async handleInstagramDownload(sock, sender, phoneNumber, url) {
        try {
            await sock.sendMessage(sender, {
                text: `⏳ Downloading from Instagram...`
            });
            
            const result = await this.downloadManager.downloadInstagram(url, phoneNumber);
            
            await sock.sendMessage(sender, {
                text: `✅ Instagram download complete!\n` +
                      `📁 ${result.name} (${this.formatBytes(result.size)})`
            });
            
            // Send media based on type
            if (result.type === 'image' && result.size < 5 * 1024 * 1024) {
                await sock.sendMessage(sender, {
                    image: { url: `file://${result.path}` }
                });
            } else if (result.type === 'video' && result.size < 45 * 1024 * 1024) {
                await sock.sendMessage(sender, {
                    video: { url: `file://${result.path}` }
                });
            }
            
        } catch (error) {
            await sock.sendMessage(sender, {
                text: `❌ Instagram download failed: ${error.message}`
            });
        }
    }

    async handleTikTokDownload(sock, sender, phoneNumber, url) {
        try {
            await sock.sendMessage(sender, {
                text: `⏳ Downloading from TikTok...`
            });
            
            const result = await this.downloadManager.downloadTikTok(url, phoneNumber);
            
            await sock.sendMessage(sender, {
                text: `✅ TikTok download complete!\n` +
                      `📁 ${result.name} (${this.formatBytes(result.size)})`
            });
            
            if (result.size < 45 * 1024 * 1024) {
                await sock.sendMessage(sender, {
                    video: { url: `file://${result.path}` }
                });
            }
            
        } catch (error) {
            await sock.sendMessage(sender, {
                text: `❌ TikTok download failed: ${error.message}`
            });
        }
    }

    async handleFacebookDownload(sock, sender, phoneNumber, url) {
        try {
            await sock.sendMessage(sender, {
                text: `⏳ Downloading from Facebook...`
            });
            
            const result = await this.downloadManager.downloadFacebook(url, phoneNumber);
            
            await sock.sendMessage(sender, {
                text: `✅ Facebook download complete!\n` +
                      `📁 ${result.name} (${this.formatBytes(result.size)})`
            });
            
        } catch (error) {
            await sock.sendMessage(sender, {
                text: `❌ Facebook download failed: ${error.message}`
            });
        }
    }

    async showMyDownloads(sock, sender, phoneNumber) {
        const downloads = this.downloadManager.getUserDownloads(phoneNumber);
        
        if (downloads.length === 0) {
            await sock.sendMessage(sender, {
                text: `📁 You haven't downloaded any files yet.\n` +
                      `Use !download [url] to start downloading!`
            });
            return;
        }
        
        let message = `📁 *YOUR DOWNLOADS* (${downloads.length} files)\n\n`;
        
        downloads.slice(-10).reverse().forEach((file, index) => {
            message += `${index + 1}. ${file.name}\n`;
            message += `   📦 ${this.formatBytes(file.size)} | 📅 ${new Date(file.date).toLocaleDateString()}\n`;
            message += `   🗑️ Delete with: !delete ${file.name}\n\n`;
        });
        
        if (downloads.length > 10) {
            message += `📋 Showing 10 most recent files. Use !storage to see all.`;
        }
        
        await sock.sendMessage(sender, { text: message });
    }

    async deleteDownload(sock, sender, phoneNumber, filename) {
        const success = this.downloadManager.deleteUserFile(phoneNumber, filename);
        
        if (success) {
            await sock.sendMessage(sender, {
                text: `✅ File "${filename}" deleted successfully.`
            });
        } else {
            await sock.sendMessage(sender, {
                text: `❌ File not found or couldn't be deleted.`
            });
        }
    }

    async showStorageUsage(sock, sender, phoneNumber) {
        const downloads = this.downloadManager.getUserDownloads(phoneNumber);
        const totalSize = this.downloadManager.getStorageUsage(phoneNumber);
        const isPremium = this.subscriptionManager.isUserSubscribed(phoneNumber);
        
        let message = `💾 *STORAGE USAGE*\n\n`;
        message += `📊 Total files: ${downloads.length}\n`;
        message += `📦 Total size: ${this.formatBytes(totalSize)}\n`;
        message += `🎯 Account type: ${isPremium ? 'Premium 🎉' : 'Free'}\n`;
        message += `📥 Daily downloads: ${this.getRemainingDownloads(phoneNumber)}/5 remaining\n\n`;
        
        if (!isPremium) {
            message += `💎 Upgrade to premium for:\n`;
            message += `• Unlimited daily downloads\n`;
            message += `• No storage limits\n`;
            message += `• Priority processing\n`;
            message += `• Higher quality downloads\n`;
            message += `Use !subscription to upgrade!`;
        }
        
        await sock.sendMessage(sender, { text: message });
    }

    async clearDownloads(sock, sender, phoneNumber) {
        const userDir = this.downloadManager.getUserDirectory(phoneNumber);
        
        if (fs.existsSync(userDir)) {
            const files = fs.readdirSync(userDir);
            let deletedCount = 0;
            
            files.forEach(file => {
                try {
                    fs.unlinkSync(path.join(userDir, file));
                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting file ${file}:`, error);
                }
            });
            
            await sock.sendMessage(sender, {
                text: `✅ Cleared ${deletedCount} downloaded files.`
            });
        } else {
            await sock.sendMessage(sender, {
                text: `📁 No downloads to clear.`
            });
        }
    }

    async handleSearch(sock, sender, phoneNumber, query) {
        try {
            await sock.sendMessage(sender, {
                text: `🔍 Searching for "${query}"...`
            });
            
            const results = await this.searchGoogleImages(query);
            
            if (results.length === 0) {
                await sock.sendMessage(sender, {
                    text: `❌ No results found for "${query}"`
                });
                return;
            }
            
            // Store search results for this user
            this.userSearches.set(phoneNumber, results);
            
            let message = `🔍 *SEARCH RESULTS* for "${query}"\n\n`;
            
            results.forEach((result, index) => {
                message += `${index + 1}. ${result.title}\n`;
                message += `   📁 Type: ${result.type} | 🌐 Source: ${result.source}\n`;
                message += `   📥 Download with: !download ${result.url}\n\n`;
            });
            
            message += `💡 Use !download [number] to download a specific result.`;
            
            await sock.sendMessage(sender, { text: message });
            
        } catch (error) {
            await sock.sendMessage(sender, {
                text: `❌ Search failed: ${error.message}`
            });
        }
    }

    async handleVideoSearch(sock, sender, phoneNumber, query) {
        await sock.sendMessage(sender, {
            text: `🎥 Searching videos for "${query}"...`
        });
        
        // This would use a video search API
        const results = await this.searchVideos(query);
        
        if (results.length > 0) {
            let message = `🎥 *VIDEO RESULTS* for "${query}"\n\n`;
            
            results.slice(0, 5).forEach((result, index) => {
                message += `${index + 1}. ${result.title}\n`;
                message += `   ⏱️ ${result.duration} | 👁️ ${result.views} views\n`;
                message += `   📥 Download with: !download ${result.url}\n\n`;
            });
            
            await sock.sendMessage(sender, { text: message });
        } else {
            await sock.sendMessage(sender, {
                text: `❌ No video results found for "${query}"`
            });
        }
    }

    async handleImageSearch(sock, sender, phoneNumber, query) {
        await this.handleSearch(sock, sender, phoneNumber, query);
    }

    async handleGameSearch(sock, sender, phoneNumber, query) {
        await sock.sendMessage(sender, {
            text: `🎮 Searching games for "${query}"...`
        });
        
        // This would use a game search API
        const results = await this.searchGames(query);
        
        if (results.length > 0) {
            let message = `🎮 *GAME RESULTS* for "${query}"\n\n`;
            
            results.slice(0, 5).forEach((result, index) => {
                message += `${index + 1}. ${result.title}\n`;
                message += `   🎯 Genre: ${result.genre} | 📅 ${result.year}\n`;
                message += `   📥 Download with: !download ${result.url}\n\n`;
            });
            
            await sock.sendMessage(sender, { text: message });
        } else {
            await sock.sendMessage(sender, {
                text: `❌ No game results found for "${query}"`
            });
        }
    }

    async searchGoogleImages(query) {
        try {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });
            
            const $ = cheerio.load(response.data);
            const results = [];
            
            // Extract image results from Google search
            $('img').each((i, element) => {
                if (results.length >= 6) return false;
                
                const src = $(element).attr('src');
                const alt = $(element).attr('alt') || 'Image';
                
                if (src && src.startsWith('http') && !src.includes('gstatic.com')) {
                    results.push({
                        title: alt.substring(0, 50) + (alt.length > 50 ? '...' : ''),
                        type: 'image',
                        source: 'Google Images',
                        url: src
                    });
                }
            });
            
            return results.slice(0, 6);
        } catch (error) {
            console.error('Google search error:', error.message);
            return [];
        }
    }

    async searchYouTube(query) {
        // This would use the YouTube API
        // For now, return mock data
        return [
            {
                title: `${query} - Official Video`,
                url: `https://youtube.com/watch?v=abcdef12345`,
                duration: '3:45',
                views: '1.2M views'
            }
        ];
    }

    async searchVideos(query) {
        // Video search implementation
        return [];
    }

    async searchGames(query) {
        // Game search implementation
        return [];
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

    getMimeType(filename) {
        const extension = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.mp4': 'video/mp4',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.mp3': 'audio/mpeg',
            '.pdf': 'application/pdf'
        };
        return mimeTypes[extension] || 'application/octet-stream';
    }

    getRemainingDownloads(phoneNumber) {
        if (this.subscriptionManager.isUserSubscribed(phoneNumber)) {
            return '∞'; // Infinity symbol for premium users
        }
        
        const today = new Date().toDateString();
        const userDownloads = this.userDownloadLimits.get(phoneNumber) || { date: today, count: 0 };
        
        if (userDownloads.date !== today) {
            return 5;
        }
        
        return Math.max(0, 5 - userDownloads.count);
    }
}

module.exports = GeneralCommands;
