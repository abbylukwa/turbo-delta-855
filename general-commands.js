const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const mime = require('mime-types');
const cheerio = require('cheerio'); // Added for HTML parsing

class GeneralCommands {
    constructor(userManager, downloadManager, subscriptionManager) {
        this.userManager = userManager;
        this.downloadManager = downloadManager;
        this.subscriptionManager = subscriptionManager;
        this.activationCode = "Abbie0121";
        this.downloadsDir = path.join(__dirname, 'downloads');
        
        // Ensure downloads directory exists
        if (!fs.existsSync(this.downloadsDir)) {
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }
    }

    async handleActivation(sock, sender, phoneNumber, username, text) {
        if (text.trim() === this.activationCode) {
            // Activate user with general privileges
            await this.userManager.activateUser(phoneNumber);
            
            await sock.sendMessage(sender, { 
                text: `✅ Activation successful!\n\nWelcome ${username}! Your bot has been activated with general user privileges.\n\nYou can now use media download commands:\n• !search <query> - Search for media\n• !download <url> - Download media\n\nYou have 4 free downloads remaining. After that, you'll need to subscribe to continue.`
            });
            
            console.log(`✅ Activated general user ${username} (${phoneNumber})`);
            return true;
        }
        return false;
    }

    async handleGeneralCommand(sock, sender, phoneNumber, username, text, message) {
        const user = await this.userManager.getUser(phoneNumber);
        if (!user || !user.isActivated) return false;

        // Check if user has active subscription or free downloads remaining
        const canDownload = this.subscriptionManager.canUserDownload(phoneNumber);
        
        if (text.startsWith('!search ')) {
            const query = text.substring('!search '.length).trim();
            if (!query) {
                await sock.sendMessage(sender, { text: "Usage: !search <query>" });
                return true;
            }

            await this.handleSearchCommand(sock, sender, query, phoneNumber);
            return true;
        }

        if (text.startsWith('!download ')) {
            if (!canDownload) {
                await this.sendSubscriptionMessage(sock, sender, phoneNumber);
                return true;
            }

            const url = text.substring('!download '.length).trim();
            if (!url) {
                await sock.sendMessage(sender, { text: "Usage: !download <url>" });
                return true;
            }

            await this.handleDownloadCommand(sock, sender, url, phoneNumber);
            return true;
        }

        if (text === '!mydownloads') {
            await this.handleMyDownloadsCommand(sock, sender, phoneNumber);
            return true;
        }

        if (text === '!subscription') {
            await this.sendSubscriptionMessage(sock, sender, phoneNumber);
            return true;
        }

        if (text === '!help') {
            await this.handleHelpCommand(sock, sender);
            return true;
        }

        return false;
    }

    async handleSearchCommand(sock, sender, query, phoneNumber) {
        try {
            await sock.sendMessage(sender, { text: `🔍 Searching for "${query}"...` });

            // Search across multiple platforms
            const results = await this.searchMultiplePlatforms(query);
            
            if (results.length === 0) {
                await sock.sendMessage(sender, { text: "No results found for your search." });
                return;
            }

            let response = `📋 Search Results for "${query}":\n\n`;
            results.forEach((result, index) => {
                response += `${index + 1}. ${result.title}\n`;
                response += `   📁 Type: ${result.type}\n`;
                response += `   🔗 Source: ${result.source}\n`;
                response += `   ⬇️ Download: !download ${result.url}\n\n`;
            });

            response += `💡 Use !download <url> to download any of these files.`;

            await sock.sendMessage(sender, { text: response });
            
        } catch (error) {
            console.error('Search error:', error);
            await sock.sendMessage(sender, { text: "❌ Search failed. Please try again later." });
        }
    }

    async searchMultiplePlatforms(query) {
        const platforms = [
            {
                name: "Goojara",
                search: async (q) => {
                    try {
                        const searchUrl = `https://www.goojara.ch/?s=${encodeURIComponent(q)}`;
                        const response = await axios.get(searchUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            },
                            timeout: 10000
                        });
                        
                        const $ = cheerio.load(response.data);
                        const results = [];
                        
                        // Try different possible selectors for Goojara
                        $('.movie-item, .item, .post').each((i, element) => {
                            const titleElement = $(element).find('.title, h2, h3, a[title]');
                            const title = titleElement.text().trim() || $(element).attr('title') || '';
                            const urlElement = $(element).find('a');
                            const url = urlElement.attr('href');
                            const yearElement = $(element).find('.year, .date');
                            const year = yearElement.text().trim();
                            
                            if (title && url && title.length > 2) {
                                results.push({
                                    title: `${title} ${year ? `(${year})` : ''}`,
                                    type: 'Movie/Series',
                                    source: 'Goojara',
                                    url: url.startsWith('http') ? url : `https://www.goojara.ch${url}`
                                });
                            }
                        });
                        
                        return results.slice(0, 5);
                    } catch (error) {
                        console.error('Goojara search error:', error.message);
                        return [];
                    }
                }
            },
            {
                name: "YouTube",
                search: async (q) => {
                    try {
                        // Simulated YouTube search (would need API key for real search)
                        return [
                            {
                                title: `${q} - Official Video`,
                                type: 'Video',
                                source: 'YouTube',
                                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
                            },
                            {
                                title: `${q} - Music Video`,
                                type: 'Video',
                                source: 'YouTube',
                                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " music")}`
                            }
                        ];
                    } catch (error) {
                        console.error('YouTube search error:', error.message);
                        return [];
                    }
                }
            },
            {
                name: "Internet Archive",
                search: async (q) => {
                    try {
                        const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&output=json&rows=5`;
                        const response = await axios.get(searchUrl, { timeout: 10000 });
                        const data = response.data;
                        
                        if (data.response && data.response.docs) {
                            return data.response.docs.map(item => ({
                                title: item.title || 'Unknown Title',
                                type: item.mediatype || 'Archive',
                                source: 'Internet Archive',
                                url: `https://archive.org/details/${item.identifier}`,
                                year: item.year
                            }));
                        }
                        return [];
                    } catch (error) {
                        console.error('Archive search error:', error.message);
                        return [];
                    }
                }
            },
            {
                name: "Beeg",
                search: async (q) => {
                    try {
                        // Simulated SoundCloud search
                        return [
                            {
                                title: `${q} - Official Audio`,
                                type: 'Video',
                                source: 'Beeg',
                                url: `https://beeg.com/search?q=${encodeURIComponent(q)}`
                            }
                        ];
                    } catch (error) {
                        console.error('SoundCloud search error:', error.message);
                        return [];
                    }
                }
            },
            {
                name: "Eporner",
                search: async (q) => {
                    try {
                        // Simulated Vimeo search
                        return [
                            {
                                title: `${q} - HD Video`,
                                type: 'Video',
                                source: 'Eporner',
                                url: `https://www.eporner.com/search?q=${encodeURIComponent(q)}`
                            }
                        ];
                    } catch (error) {
                        console.error('Vimeo search error:', error.message);
                        return [];
                    }
                }
            }
        ];

        let allResults = [];
        
        // Search each platform with timeout protection
        const searchPromises = platforms.map(async (platform) => {
            try {
                const results = await Promise.race([
                    platform.search(query),
                    new Promise(resolve => setTimeout(() => resolve([]), 8000)) // 8 second timeout
                ]);
                return results;
            } catch (error) {
                console.error(`Error searching ${platform.name}:`, error.message);
                return [];
            }
        });
        
        const resultsArrays = await Promise.allSettled(searchPromises);
        
        resultsArrays.forEach(result => {
            if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
                allResults = allResults.concat(result.value);
            }
        });
        
        // Remove duplicates and limit to 10 results
        const uniqueResults = allResults.filter((result, index, self) =>
            index === self.findIndex(r => r.url === result.url)
        );
        
        return uniqueResults.slice(0, 10);
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

    async downloadActualFile(url, phoneNumber) {
        try {
            // Create user-specific download directory
            const userDir = path.join(this.downloadsDir, phoneNumber);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }
            
            // Generate unique filename
            const timestamp = Date.now();
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            // Get file information from headers
            const contentType = response.headers['content-type'] || 'application/octet-stream';
            const contentLength = parseInt(response.headers['content-length']) || 0;
            const contentDisposition = response.headers['content-disposition'] || '';
            let filename = `download_${timestamp}`;
            
            // Extract filename from content-disposition header if available
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }
            
            // Get proper extension
            const extension = mime.extension(contentType) || 
                             (filename.includes('.') ? filename.split('.').pop() : 'bin');
            
            const finalFilename = `${filename.split('.')[0]}_${timestamp}.${extension}`;
            const filepath = path.join(userDir, finalFilename);
            
            // Download the file
            const writer = fs.createWriteStream(filepath);
            await pipeline(response.data, writer);
            
            return {
                path: filepath,
                name: finalFilename,
                type: contentType,
                size: contentLength || fs.statSync(filepath).size
            };
            
        } catch (error) {
            console.error('File download error:', error.message);
            return null;
        }
    }

    async handleMyDownloadsCommand(sock, sender, phoneNumber) {
        const user = await this.userManager.getUser(phoneNumber);
        const downloadCount = this.subscriptionManager.getDownloadCount(phoneNumber);
        const downloadsLeft = this.subscriptionManager.getDownloadsLeft(phoneNumber);
        const hasSubscription = this.subscriptionManager.hasActiveSubscription(phoneNumber);
        
        let response = `📊 Your Download Statistics:\n\n`;
        response += `📥 Total Downloads: ${downloadCount}\n`;
        response += `⬇️ Downloads Left: ${downloadsLeft}\n`;
        response += `📅 Subscription: ${hasSubscription ? 'Active' : 'Not Active'}\n\n`;
        
        if (!hasSubscription && downloadsLeft <= 2) {
            response += `⚠️ You have limited downloads left. Please subscribe to continue.\n`;
            response += `💳 Use !subscription for payment details.`;
        }
        
        await sock.sendMessage(sender, { text: response });
    }

    async sendSubscriptionMessage(sock, sender, phoneNumber) {
        const downloadCount = this.subscriptionManager.getDownloadCount(phoneNumber);
        
        let response = `💳 Subscription Information\n\n`;
        response += `📊 Your downloads: ${downloadCount}/4 (free)\n\n`;
        response += `To continue downloading after 4 free downloads, please subscribe:\n\n`;
        response += `💰 Price: 75c per 2 weeks\n`;
        response += `🇿🇼 Zimbabwe: 0777627210 (EcoCash)\n`;
        response += `🇿🇦 South Africa: +27614159817\n\n`;
        response += `After payment, send proof to this bot for verification.`;
        
        await sock.sendMessage(sender, { text: response });
    }

    async handleHelpCommand(sock, sender) {
        const helpText = `🤖 General Commands:\n\n` +
            `🔍 !search <query> - Search for media files across multiple websites\n` +
            `⬇️ !download <url> - Download a file from any supported website\n` +
            `📊 !mydownloads - View your download statistics\n` +
            `💳 !subscription - View subscription information\n` +
            `❓ !help - Show this help message\n\n` +
            `🌐 Supported Websites: Goojara, YouTube, Internet Archive, SoundCloud, Vimeo`;

        await sock.sendMessage(sender, { text: helpText });
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }
}

module.exports = GeneralCommands;
