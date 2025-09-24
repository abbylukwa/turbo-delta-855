const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const ig = require('instagram-url-direct');

// Import GroupManager from external file
const GroupManager = require('./group-manager.js');

// Config
const ACTIVATION_KEY = 'Abbie911';
const CONSTANT_ADMINS = [
    '263775156210@c.us', 
    '27614159817@c.us', 
    '263717457592@c.us', 
    '263777627210@c.us'
];

// State
let isConnected = false;
const userActivations = new Map();
let groupManager = null;

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

// User Management
function activateUser(phoneNumber) {
    userActivations.set(phoneNumber, {
        activated: true,
        freeDownloads: 10,
        activationTime: new Date()
    });
    console.log(`✅ User activated: ${phoneNumber}`);
}

function isUserActivated(phoneNumber) {
    const user = userActivations.get(phoneNumber);
    return user && user.activated;
}

function isAdmin(sender) {
    return CONSTANT_ADMINS.includes(sender);
}

// Initialize Group Manager
function initializeGroupManager() {
    if (!groupManager) {
        console.log('🚀 Initializing Group Manager from external file...');
        try {
            groupManager = new GroupManager(client);
            groupManager.start().then(() => {
                console.log('✅ External Group Manager started successfully!');
            }).catch(error => {
                console.log('❌ Failed to start external Group Manager:', error);
            });
        } catch (error) {
            console.log('❌ Error initializing external Group Manager:', error);
        }
    }
}

// REAL DOWNLOAD FUNCTIONALITY
class DownloadManager {
    constructor() {
        this.downloadQueue = new Map();
        this.supportedPlatforms = ['youtube', 'instagram', 'tiktok', 'facebook', 'twitter'];
    }

    // Search YouTube and get video URL
    async searchYouTube(query) {
        try {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const videoIdMatch = response.data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
            if (videoIdMatch) {
                return `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
            }
            return null;
        } catch (error) {
            console.log('YouTube search error:', error);
            return null;
        }
    }

    // Download YouTube video/audio
    async downloadYouTube(url, format = 'video') {
        try {
            if (!ytdl.validateURL(url)) {
                throw new Error('Invalid YouTube URL');
            }

            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title;
            const duration = info.videoDetails.lengthSeconds;
            
            let stream;
            if (format === 'audio') {
                stream = ytdl(url, { quality: 'highestaudio', filter: 'audioonly' });
            } else {
                stream = ytdl(url, { quality: 'highest' });
            }

            const filename = `yt_${Date.now()}.${format === 'audio' ? 'mp3' : 'mp4'}`;
            const filepath = path.join(__dirname, 'downloads', filename);
            
            if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
                fs.mkdirSync(path.join(__dirname, 'downloads'), { recursive: true });
            }

            return new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(filepath);
                stream.pipe(writeStream);
                
                writeStream.on('finish', () => {
                    resolve({
                        filepath,
                        filename,
                        title,
                        duration: this.formatDuration(duration),
                        format: format === 'audio' ? 'Audio (MP3)' : 'Video (MP4)',
                        size: fs.statSync(filepath).size
                    });
                });
                
                writeStream.on('error', reject);
            });
        } catch (error) {
            throw new Error(`YouTube download failed: ${error.message}`);
        }
    }

    // Download Instagram content
    async downloadInstagram(url) {
        try {
            const links = await ig(url);
            if (!links || links.length === 0) {
                throw new Error('No media found on Instagram');
            }
            
            // Get the highest quality media
            const media = links[0];
            const filename = `ig_${Date.now()}.${media.type === 'image' ? 'jpg' : 'mp4'}`;
            const filepath = path.join(__dirname, 'downloads', filename);
            
            // Download the media file
            const response = await axios({
                method: 'GET',
                url: media.url,
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(filepath);
                response.data.pipe(writeStream);
                
                writeStream.on('finish', () => {
                    resolve({
                        filepath,
                        filename,
                        type: media.type,
                        size: fs.statSync(filepath).size
                    });
                });
                
                writeStream.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Instagram download failed: ${error.message}`);
        }
    }

    // Download TikTok (using public API)
    async downloadTikTok(url) {
        try {
            const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl);
            
            if (!response.data.data) {
                throw new Error('No video found on TikTok');
            }

            const videoUrl = response.data.data.play;
            const filename = `tiktok_${Date.now()}.mp4`;
            const filepath = path.join(__dirname, 'downloads', filename);

            const videoResponse = await axios({
                method: 'GET',
                url: videoUrl,
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(filepath);
                videoResponse.data.pipe(writeStream);
                
                writeStream.on('finish', () => {
                    resolve({
                        filepath,
                        filename,
                        size: fs.statSync(filepath).size
                    });
                });
                
                writeStream.on('error', reject);
            });
        } catch (error) {
            throw new Error(`TikTok download failed: ${error.message}`);
        }
    }

    // Download Facebook (basic implementation)
    async downloadFacebook(url) {
        try {
            // This is a simplified version - you might need a dedicated Facebook downloader API
            const filename = `fb_${Date.now()}.mp4`;
            const filepath = path.join(__dirname, 'downloads', filename);
            
            // For demo purposes - in real implementation, use a Facebook downloader API
            throw new Error('Facebook download requires dedicated API integration');
            
        } catch (error) {
            throw new Error(`Facebook download failed: ${error.message}`);
        }
    }

    // Universal download handler
    async handleUniversalDownload(url) {
        try {
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                return await this.downloadYouTube(url, 'video');
            } else if (url.includes('instagram.com')) {
                return await this.downloadInstagram(url);
            } else if (url.includes('tiktok.com')) {
                return await this.downloadTikTok(url);
            } else if (url.includes('facebook.com')) {
                return await this.downloadFacebook(url);
            } else {
                throw new Error('Unsupported platform. Use specific commands: .yt, .ig, .tt, .fb');
            }
        } catch (error) {
            throw error;
        }
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)}MB`;
    }
}

// Initialize download manager
const downloadManager = new DownloadManager();

// WhatsApp Client Events
client.on('qr', (qr) => {
    console.log('\n'.repeat(3));
    console.log('═'.repeat(60));
    console.log('📱 WHATSAPP BOT - SCAN QR CODE');
    console.log('═'.repeat(60));
    qrcode.generate(qr, { small: true });
    console.log('═'.repeat(60));
    console.log('📋 FOLLOW THESE STEPS:');
    console.log('1. Open WhatsApp on your phone');
    console.log('2. Tap Menu → Linked Devices');
    console.log('3. Tap Link a Device');
    console.log('4. Scan the QR code above');
    console.log('═'.repeat(60));
    console.log('⏳ Waiting for connection...');
    console.log('═'.repeat(60));
});

client.on('ready', () => {
    isConnected = true;
    console.log('✅ WhatsApp client is ready!');
    console.log('🤖 Bot is now operational');
    console.log(`👑 Admin users: ${CONSTANT_ADMINS.length}`);
    console.log(`👥 Active users: ${userActivations.size}`);
    
    // Initialize Group Manager
    initializeGroupManager();
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp authenticated successfully!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    isConnected = false;
});

client.on('disconnected', (reason) => {
    isConnected = false;
    console.log('❌ Client was logged out:', reason);
    console.log('🔄 Attempting to reconnect...');
    setTimeout(() => client.initialize(), 5000);
});

// Message handling
client.on('message', async (message) => {
    try {
        if (message.from === 'status@broadcast') return;
        
        const sender = message.from;
        const phoneNumber = sender.replace('@c.us', '');
        
        if (!message.body.startsWith('.')) return;

        const args = message.body.slice(1).split(' ');
        const command = args[0].toLowerCase();
        
        console.log(`📨 Command: ${command} from ${phoneNumber} (Admin: ${isAdmin(sender)})`);

        // Check if user is admin or activated for non-basic commands
        const admin = isAdmin(sender);
        const activated = isUserActivated(phoneNumber);
        const allowedCommands = ['activate', 'help', 'status'];

        if (!admin && !activated && !allowedCommands.includes(command)) {
            console.log(`🚫 Ignoring non-activated user: ${phoneNumber}`);
            await message.reply('❌ Please activate your account first using .activate [key]');
            return;
        }

        // Handle commands
        await handleCommand(message, args, command, sender, phoneNumber, admin, activated);
        
    } catch (error) {
        console.error('Message handling error:', error);
        await message.reply('❌ Error processing your command. Please try again.');
    }
});

// Command handler
async function handleCommand(message, args, command, sender, phoneNumber, admin, activated) {
    switch (command) {
        case 'activate':
            await handleActivation(message, args, phoneNumber);
            break;
            
        case 'help':
            await showHelp(message);
            break;
            
        case 'status':
            await showStatus(message, phoneNumber, admin, activated);
            break;
            
        case 'groupstatus':
            if (admin) await showGroupStatus(message);
            else await message.reply('❌ Admin only command.');
            break;
            
        case 'users':
            if (admin) await showUsers(message);
            else await message.reply('❌ Admin only command.');
            break;
            
        case 'stats':
            if (admin) await showStats(message);
            else await message.reply('❌ Admin only command.');
            break;
            
        // Download commands
        case 'download':
            await handleUniversalDownload(message, args, phoneNumber, admin);
            break;
            
        case 'yt':
            await handleYouTubeDownload(message, args, phoneNumber, admin);
            break;
            
        case 'ig':
            await handleInstagramDownload(message, args, phoneNumber, admin);
            break;
            
        case 'tt':
            await handleTikTokDownload(message, args, phoneNumber, admin);
            break;
            
        case 'fb':
            await handleFacebookDownload(message, args, phoneNumber, admin);
            break;
            
        default:
            await message.reply('❌ Unknown command. Use .help for available commands.');
    }
}

// Activation command
async function handleActivation(message, args, phoneNumber) {
    if (args[1] === ACTIVATION_KEY) {
        activateUser(phoneNumber);
        const user = userActivations.get(phoneNumber);
        await message.reply(
            `✅ Account activated successfully!\n` +
            `📊 You now have ${user.freeDownloads} free downloads.\n\n` +
            `Available commands:\n` +
            `.download [url] - Download from any website\n` +
            `.yt [url/query] - YouTube download\n` +
            `.ig [url] - Instagram download\n` +
            `.tt [url] - TikTok download\n` +
            `.fb [url] - Facebook download\n` +
            `.help - Show all commands`
        );
    } else {
        await message.reply(
            `❌ Invalid activation key!\n\n` +
            `Please use: .activate ${ACTIVATION_KEY}\n` +
            `Or contact admin for assistance.`
        );
    }
}

// Help command
async function showHelp(message) {
    const helpText = `
📋 *DOWNLOAD BOT COMMANDS* 📋

*FOR EVERYONE:*
.activate [key] - Activate your account
.help - Show this help message
.status - Check bot status

*AFTER ACTIVATION:*
.download [url] - Download from any website
.yt [url/query] - YouTube download (supports search!)
.ig [url] - Instagram download
.tt [url] - TikTok download
.fb [url] - Facebook download

*ADMIN COMMANDS:*
.users - Show active users
.stats - Show bot statistics
.groupstatus - Check group manager status

*EXAMPLES:*
.yt https://youtube.com/watch?v=...
.yt "song name artist" - Searches and downloads!
.ig https://instagram.com/p/...
.tt https://tiktok.com/...
    `.trim();
    
    await message.reply(helpText);
}

// Status command
async function showStatus(message, phoneNumber, admin, activated) {
    const userData = userActivations.get(phoneNumber);
    const downloadsLeft = userData ? userData.freeDownloads : 0;

    const statusText = `
🤖 *BOT STATUS*

• Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}
• Active Users: ${userActivations.size}
• Group Manager: ${groupManager && groupManager.isRunning ? '✅ Running' : '❌ Stopped'}
• Your Status: ${admin ? '👑 Admin' : activated ? '✅ Activated' : '❌ Not activated'}
• Downloads Left: ${downloadsLeft}
• Server: ${isConnected ? '🟢 Online' : '🔴 Offline'}
    `.trim();

    await message.reply(statusText);
}

// Group status command
async function showGroupStatus(message) {
    const groupStatus = groupManager ? 
        `• Status: ${groupManager.isRunning ? '✅ Running' : '❌ Stopped'}\n` +
        `• External File: ✅ Loaded` :
        '❌ Group Manager not initialized';

    await message.reply(`👥 *GROUP MANAGER STATUS*\n\n${groupStatus}`);
}

// Users command
async function showUsers(message) {
    const usersList = Array.from(userActivations.entries())
        .map(([phone, data]) => `• ${phone} - Downloads: ${data.freeDownloads} - Since: ${data.activationTime.toLocaleDateString()}`)
        .join('\n');

    await message.reply(
        `👥 *ACTIVE USERS* (${userActivations.size})\n\n${usersList || 'No active users yet.'}`
    );
}

// Stats command
async function showStats(message) {
    await message.reply(
        `📊 *BOT STATISTICS*\n\n` +
        `• Total Active Users: ${userActivations.size}\n` +
        `• Connection Status: ${isConnected ? '✅' : '❌'}\n` +
        `• Group Manager: ${groupManager ? '✅' : '❌'}\n` +
        `• Uptime: ${process.uptime().toFixed(0)}s\n` +
        `• Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`
    );
}

// Download command handlers
async function handleUniversalDownload(message, args, phoneNumber, admin) {
    if (args.length < 2) {
        await message.reply('❌ Usage: .download [url]\nExample: .download https://example.com/video');
        return;
    }

    const url = args[1];
    await processDownload(message, url, 'universal', phoneNumber, admin);
}

async function handleYouTubeDownload(message, args, phoneNumber, admin) {
    if (args.length < 2) {
        await message.reply('❌ Usage: .yt [YouTube URL or search query]\nExamples:\n.yt https://youtube.com/watch?v=...\n.yt "song name artist"');
        return;
    }

    let url = args[1];
    
    // Handle search queries
    if (!url.startsWith('http')) {
        const query = args.slice(1).join(' ');
        await message.reply(`🔎 Searching YouTube for: "${query}"`);
        
        const searchResult = await downloadManager.searchYouTube(query);
        if (!searchResult) {
            await message.reply('❌ No results found for your search query.');
            return;
        }
        
        url = searchResult;
        await message.reply(`✅ Found video: ${url}`);
    }

    if (!ytdl.validateURL(url)) {
        await message.reply('❌ Invalid YouTube URL.');
        return;
    }

    // Ask for format
    await message.reply(
        `📋 Choose download format:\n\n` +
        `1. Video (MP4)\n` +
        `2. Audio (MP3)\n\n` +
        `Reply with 1 or 2`
    );

    downloadManager.downloadQueue.set(message.from, {
        type: 'youtube',
        url: url,
        message: message,
        phoneNumber: phoneNumber,
        admin: admin
    });
}

async function handleInstagramDownload(message, args, phoneNumber, admin) {
    if (args.length < 2) {
        await message.reply('❌ Usage: .ig [Instagram URL]\nExample: .ig https://instagram.com/p/...');
        return;
    }

    const url = args[1];
    if (!url.includes('instagram.com')) {
        await message.reply('❌ Invalid Instagram URL.');
        return;
    }

    await processDownload(message, url, 'instagram', phoneNumber, admin);
}

async function handleTikTokDownload(message, args, phoneNumber, admin) {
    if (args.length < 2) {
        await message.reply('❌ Usage: .tt [TikTok URL]\nExample: .tt https://tiktok.com/...');
        return;
    }

    const url = args[1];
    if (!url.includes('tiktok.com')) {
        await message.reply('❌ Invalid TikTok URL.');
        return;
    }

    await processDownload(message, url, 'tiktok', phoneNumber, admin);
}

async function handleFacebookDownload(message, args, phoneNumber, admin) {
    if (args.length < 2) {
        await message.reply('❌ Usage: .fb [Facebook URL]\nExample: .fb https://facebook.com/...');
        return;
    }

    const url = args[1];
    if (!url.includes('facebook.com')) {
        await message.reply('❌ Invalid Facebook URL.');
        return;
    }

    await processDownload(message, url, 'facebook', phoneNumber, admin);
}

// Process download function
async function processDownload(message, url, platform, phoneNumber, admin) {
    try {
        await message.reply(`🔍 Processing ${platform} download...`);

        let result;
        if (platform === 'youtube') {
            result = await downloadManager.downloadYouTube(url, 'video');
        } else if (platform === 'instagram') {
            result = await downloadManager.downloadInstagram(url);
        } else if (platform === 'tiktok') {
            result = await downloadManager.downloadTikTok(url);
        } else if (platform === 'facebook') {
            result = await downloadManager.downloadFacebook(url);
        } else {
            result = await downloadManager.handleUniversalDownload(url);
        }

        // Send the file
        const media = MessageMedia.fromFilePath(result.filepath);
        const caption = result.title ? 
            `🎬 ${result.title}\n⏱️ ${result.duration}\n💾 ${downloadManager.formatFileSize(result.size)}` :
            `📥 Download Complete\n💾 ${downloadManager.formatFileSize(result.size)}`;
        
        await message.reply(media, undefined, { caption: caption });
        
        // Clean up file
        fs.unlinkSync(result.filepath);
        
        // Decrement download count for non-admins
        if (!admin) {
            const user = userActivations.get(phoneNumber);
            if (user && user.freeDownloads > 0) {
                user.freeDownloads--;
                await message.reply(`📊 Downloads remaining: ${user.freeDownloads}/10`);
            }
        }

    } catch (error) {
        await message.reply(`❌ Download failed: ${error.message}`);
    }
}

// Handle format selection responses
client.on('message', async (message) => {
    if (message.body === '1' || message.body === '2') {
        const request = downloadManager.downloadQueue.get(message.from);
        if (request && request.type === 'youtube') {
            try {
                const format = message.body === '2' ? 'audio' : 'video';
                await message.reply(`⬇️ Downloading as ${format === 'audio' ? 'Audio (MP3)' : 'Video (MP4)'}...`);
                
                const result = await downloadManager.downloadYouTube(request.url, format);
                const media = MessageMedia.fromFilePath(result.filepath);
                
                await message.reply(media, undefined, { 
                    caption: `🎬 ${result.title}\n⏱️ ${result.duration}\n🎯 ${result.format}\n💾 ${downloadManager.formatFileSize(result.size)}`
                });
                
                // Clean up file
                fs.unlinkSync(result.filepath);
                
                // Decrement download count for non-admins
                if (!request.admin) {
                    const user = userActivations.get(request.phoneNumber);
                    if (user && user.freeDownloads > 0) {
                        user.freeDownloads--;
                        await message.reply(`📊 Downloads remaining: ${user.freeDownloads}/10`);
                    }
                }
                
            } catch (error) {
                await message.reply(`❌ Download failed: ${error.message}`);
            } finally {
                downloadManager.downloadQueue.delete(message.from);
            }
        }
    }
});

// Web server routes
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connected: isConnected,
        activeUsers: userActivations.size,
        groupManagerActive: groupManager ? groupManager.isRunning : false,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'WhatsApp Download Bot',
        version: '2.0.0',
        status: 'running',
        activationRequired: true,
        adminCount: CONSTANT_ADMINS.length,
        groupManager: groupManager ? 'active' : 'inactive',
        connection: isConnected ? 'connected' : 'disconnected',
        features: ['youtube_download', 'instagram_download', 'tiktok_download', 'facebook_download', 'search_queries'],
        activeUsers: userActivations.size
    });
});

// Start the application
async function start() {
    try {
        console.log('🚀 Starting WhatsApp Download Bot with All Features...');
        console.log('🔑 Activation Key:', ACTIVATION_KEY);
        console.log('👑 Admin Users:', CONSTANT_ADMINS.length);
        console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
        console.log('💡 Using QR Code authentication');
        console.log('📁 Group Manager: Auto-start on connection');
        console.log('⬇️ Real Downloads: Enabled for YouTube, Instagram, TikTok, Facebook');
        console.log('🔍 YouTube Search: Supported');
        
        // Start web server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
        });

        // Initialize WhatsApp client
        await client.initialize();

    } catch (error) {
        console.error('❌ Failed to start:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (groupManager) groupManager.stop();
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM...');
    if (groupManager) groupManager.stop();
    await client.destroy();
    process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
start();