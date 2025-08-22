const axios = require('axios');
const fs = require('fs');
const path = require('path');

class GeneralCommands {
    constructor(userManager, downloadManager, subscriptionManager) {
        this.userManager = userManager;
        this.downloadManager = downloadManager;
        this.subscriptionManager = subscriptionManager;
        this.activationCode = "Abbie0121";
    }

    async handleActivation(sock, sender, phoneNumber, username, text) {
        if (text.trim() === this.activationCode) {
            // Activate user with general privileges
            this.userManager.activateUser(phoneNumber, username, 'general');
            
            await sock.sendMessage(sender, { 
                text: `✅ Activation successful!\n\nWelcome ${username}! Your bot has been activated with general user privileges.\n\nYou can now use media download commands:\n• !search <query> - Search for media\n• !download <url> - Download media\n\nYou have 4 free downloads remaining. After that, you'll need to subscribe to continue.`
            });
            
            console.log(`✅ Activated general user ${username} (${phoneNumber})`);
            return true;
        }
        return false;
    }

    async handleGeneralCommand(sock, sender, phoneNumber, username, text, message) {
        const user = this.userManager.getUser(phoneNumber);
        if (!user || user.role !== 'general') return false;

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

        return false;
    }

    async handleSearchCommand(sock, sender, query, phoneNumber) {
        try {
            await sock.sendMessage(sender, { text: `🔍 Searching for "${query}"...` });

            // Simulate search across different websites
            const results = await this.searchWebsites(query);
            
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

    async searchWebsites(query) {
        // Simulate searching across different websites
        const websites = [
            { name: "123.com", baseUrl: "https://123.com/search?q=" },
            { name: "256.com", baseUrl: "https://256.com/search?q=" },
            { name: "youtube.com", baseUrl: "https://youtube.com/results?q=" }
        ];

        const results = [];
        const types = ['Video', 'Image', 'Audio', 'Document'];
        
        // Generate mock results
        for (let i = 0; i < 5; i++) {
            const website = websites[Math.floor(Math.random() * websites.length)];
            const type = types[Math.floor(Math.random() * types.length)];
            
            results.push({
                title: `${query} ${type} ${i + 1}`,
                type: type,
                source: website.name,
                url: `${website.baseUrl}${encodeURIComponent(query)}&result=${i + 1}`
            });
        }
        
        return results;
    }

    async handleDownloadCommand(sock, sender, url, phoneNumber) {
        try {
            await sock.sendMessage(sender, { text: "⬇️ Downloading file..." });
            
            // Check if user can download
            if (!this.subscriptionManager.canUserDownload(phoneNumber)) {
                await this.sendSubscriptionMessage(sock, sender, phoneNumber);
                return;
            }

            // Download the file
            const fileInfo = await this.downloadManager.downloadFile(url, phoneNumber);
            
            // Record the download
            this.subscriptionManager.recordDownload(phoneNumber);
            
            // Send the file
            if (fileInfo.type === 'image') {
                await sock.sendMessage(sender, {
                    image: { url: fileInfo.path },
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            } else if (fileInfo.type === 'video') {
                await sock.sendMessage(sender, {
                    video: { url: fileInfo.path },
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            } else {
                await sock.sendMessage(sender, {
                    document: { url: fileInfo.path },
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            }
            
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

    async handleMyDownloadsCommand(sock, sender, phoneNumber) {
        const user = this.userManager.getUser(phoneNumber);
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
        response += `🇿🇦 South Africa: +27 61 415 9817\n\n`;
        response += `After payment, send proof to this bot for verification.`;
        
        await sock.sendMessage(sender, { text: response });
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }
}

module.exports = GeneralCommands;
        if (text === '!subscription') {
            await this.sendSubscriptionMessage(sock, sender, phoneNumber);
            return true;
        }

        return false;
    }

    async handleSearchCommand(sock, sender, query, phoneNumber) {
        try {
            await sock.sendMessage(sender, { text: `🔍 Searching for "${query}"...` });

            // Simulate search across different websites
            const results = await this.searchWebsites(query);
            
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

    async searchWebsites(query) {
        // Simulate searching across different websites
        const websites = [
            { name: "123.com", baseUrl: "https://123.com/search?q=" },
            { name: "256.com", baseUrl: "https://256.com/search?q=" },
            { name: "youtube.com", baseUrl: "https://youtube.com/results?q=" }
        ];

        const results = [];
        const types = ['Video', 'Image', 'Audio', 'Document'];
        
        // Generate mock results
        for (let i = 0; i < 5; i++) {
            const website = websites[Math.floor(Math.random() * websites.length)];
            const type = types[Math.floor(Math.random() * types.length)];
            
            results.push({
                title: `${query} ${type} ${i + 1}`,
                type: type,
                source: website.name,
                url: `${website.baseUrl}${encodeURIComponent(query)}&result=${i + 1}`
            });
        }
        
        return results;
    }

    async handleDownloadCommand(sock, sender, url, phoneNumber) {
        try {
            await sock.sendMessage(sender, { text: "⬇️ Downloading file..." });
            
            // Check if user can download
            if (!this.subscriptionManager.canUserDownload(phoneNumber)) {
                await this.sendSubscriptionMessage(sock, sender, phoneNumber);
                return;
            }

            // Download the file
            const fileInfo = await this.downloadManager.downloadFile(url, phoneNumber);
            
            // Record the download
            this.subscriptionManager.recordDownload(phoneNumber);
            
            // Send the file
            if (fileInfo.type === 'image') {
                await sock.sendMessage(sender, {
                    image: { url: fileInfo.path },
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            } else if (fileInfo.type === 'video') {
                await sock.sendMessage(sender, {
                    video: { url: fileInfo.path },
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            } else {
                await sock.sendMessage(sender, {
                    document: { url: fileInfo.path },
                    caption: `✅ Download complete!\n📁 ${fileInfo.name}\n📊 ${this.formatFileSize(fileInfo.size)}`
                });
            }
            
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

    async handleMyDownloadsCommand(sock, sender, phoneNumber) {
        const user = this.userManager.getUser(phoneNumber);
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
        response += `🇿🇦 South Africa: +27 61 415 9817\n\n`;
        response += `After payment, send proof to this bot for verification.`;
        
        await sock.sendMessage(sender, { text: response });
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }
}

module.exports = GeneralCommands;}' > package.json

# Create directory structure
RUN mkdir -p downloads media temp data auth_info

# Create basic index.js (will be replaced with enhanced version)
RUN echo 'const makeWASocket=require("@whiskeysockets/baileys").default;const {useMultiFileAuthState}=require("@whiskeysockets/baileys");const qrcode=require("qrcode-terminal");async function startBot(){const{state,saveCreds}=await useMultiFileAuthState("auth_info");const sock=makeWASocket({auth:state});sock.ev.on("connection.update",(update)=>{const{connection,lastDisconnect,qr}=update;if(qr){console.log("Scan QR code to connect:");qrcode.generate(qr,{small:true})}if(connection==="close"){console.log("Connection closed, reconnecting...");startBot()}else if(connection==="open"){console.log("Bot connected successfully!")}});sock.ev.on("creds.update",saveCreds);sock.ev.on("messages.upsert",async(m)=>{const message=m.messages[0];if(!message.message)return;const text=message.message.conversation||message.message.extendedTextMessage?.text||message.message.imageMessage?.caption||"";const sender=message.key.remoteJid;if(text===process.env.ACTIVATION_KEY){console.log("Received activation code, responding...");await sock.sendMessage(sender,{text:"Hello from Abby Bot! Your device is paired and ready."})}})}startBot().catch(console.error)' > index.js

# Copy all enhanced bot scripts (will overwrite the basic index.js)
COPY *.js ./

# Install dependencies
RUN npm install

CMD ["node", "index.js"]
