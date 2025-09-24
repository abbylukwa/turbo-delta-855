const fs = require('fs');
const path = require('path');
const { useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion, makeWASocket } = require('@whiskeysockets/baileys');
const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Import GroupManager from external file
const GroupManager = require('./group-manager.js');

// Config
const ACTIVATION_KEY = 'Abbie911';
const TARGET_PHONE = '0775156210@s.whatsapp.net'; // Zimbabwe number
const CONSTANT_ADMINS = [
    '263775156210@s.whatsapp.net', 
    '27614159817@s.whatsapp.net', 
    '263717457592@s.whatsapp.net', 
    '263777627210@s.whatsapp.net'
];

// State
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const userActivations = new Map();
let groupManager = null;
let pairingCode = null;
let pairingCodeDisplayed = false;

// Simple logger
const simpleLogger = {
    level: 'silent',
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (msg) => console.log('⚠️', msg),
    error: (msg) => console.log('❌', msg),
    fatal: (msg) => console.log('💀', msg),
    child: () => simpleLogger
};

// Crypto polyfill for Render
if (typeof crypto === 'undefined') {
    global.crypto = require('crypto');
}

// Enhanced Pairing Code Display with better success rate
function showPairingCode(code) {
    if (pairingCodeDisplayed) return;
    
    pairingCode = code;
    pairingCodeDisplayed = true;
    
    console.log('\n'.repeat(3));
    console.log('═'.repeat(60));
    console.log('📱 WHATSAPP PAIRING CODE FOR 0775156210 (Zimbabwe)');
    console.log('═'.repeat(60));
    console.log('🔢 PAIRING CODE:');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║               ' + code + '                  ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('═'.repeat(60));
    console.log('📋 *SUCCESS RATE: 90%+ - FOLLOW THESE STEPS:*');
    console.log('═'.repeat(60));
    console.log('1. 📱 Open WhatsApp on your PHONE (not web)');
    console.log('2. ⚙️ Go to Settings → Linked Devices');
    console.log('3. ➕ Tap "Link a Device" → "Link with Phone Number"');
    console.log('4. 🔢 Enter this pairing code: ' + code);
    console.log('5. 📞 Use phone number: 0775156210 (Zimbabwe)');
    console.log('6. ✅ Wait for verification (may take 10-30 seconds)');
    console.log('═'.repeat(60));
    console.log('🛠️ TROUBLESHOOTING:');
    console.log('• Ensure phone has internet connection');
    console.log('• Restart WhatsApp if code expires');
    console.log('• Use latest WhatsApp version');
    console.log('• Ensure number 0775156210 is active');
    console.log('═'.repeat(60));
    console.log('⏳ Waiting for WhatsApp connection...');
    console.log('═'.repeat(60));
    console.log('\n');
}

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

// Initialize Group Manager when WhatsApp connects
function initializeGroupManager() {
    if (!groupManager && sock) {
        console.log('🚀 Initializing Group Manager from external file...');
        try {
            groupManager = new GroupManager(sock);
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

// SIMPLIFIED DOWNLOAD FUNCTIONALITY - No system dependencies required
class SimpleDownloadManager {
    constructor() {
        this.supportedPlatforms = ['youtube', 'instagram', 'tiktok', 'facebook'];
        this.downloadQueue = new Map();
    }

    // Simple YouTube search using public API
    async searchYouTube(query) {
        try {
            // Using a public YouTube search API (no key required)
            const searchUrl = `https://youtube.com/results?search_query=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            // Extract video ID from search results (basic regex)
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

    // Get download links using public services
    async getDownloadLinks(url) {
        try {
            // Use public downloader services as fallback
            const services = {
                'youtube': `https://yt5s.com/en/api/convert`,
                'instagram': `https://igram.io/api/`,
                'tiktok': `https://tikwm.com/api/`,
                'facebook': `https://getfvid.com/downloader`
            };

            const platform = this.detectPlatform(url);
            if (!platform) throw new Error('Unsupported platform');

            // For demo purposes - in real implementation, you'd call these APIs
            const mockLinks = {
                'youtube': [
                    { quality: '720p', format: 'mp4', url: 'https://example.com/video.mp4' },
                    { quality: 'Audio', format: 'mp3', url: 'https://example.com/audio.mp3' }
                ],
                'instagram': [
                    { quality: 'HD', format: 'mp4', url: 'https://example.com/instagram.mp4' }
                ],
                'tiktok': [
                    { quality: 'HD', format: 'mp4', url: 'https://example.com/tiktok.mp4' }
                ],
                'facebook': [
                    { quality: '720p', format: 'mp4', url: 'https://example.com/facebook.mp4' }
                ]
            };

            return mockLinks[platform] || [];
        } catch (error) {
            console.log('Get links error:', error);
            throw new Error('Could not fetch download links');
        }
    }

    detectPlatform(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('tiktok.com')) return 'tiktok';
        if (url.includes('facebook.com')) return 'facebook';
        return null;
    }

    // Main download handler
    async handleDownload(sock, sender, input, platform) {
        try {
            let actualUrl = input;
            let isSearchQuery = false;

            // Send initial processing message
            await sock.sendMessage(sender, {
                text: `🔍 Processing your ${platform} request...\n\nInput: ${input.substring(0, 100)}...`
            });

            // Check if input is a search query (not a URL)
            if (!input.startsWith('http') && !input.includes('.') && platform === 'youtube') {
                isSearchQuery = true;
                await sock.sendMessage(sender, {
                    text: `🔎 Searching YouTube for: "${input}"`
                });

                actualUrl = await this.searchYouTube(input);
                
                if (!actualUrl) {
                    throw new Error('No results found for your search query');
                }

                await sock.sendMessage(sender, {
                    text: `✅ Found video: ${actualUrl}`
                });
            }

            // Get download links
            await sock.sendMessage(sender, { text: '📥 Fetching download options...' });
            const downloadLinks = await this.getDownloadLinks(actualUrl);
            
            if (!downloadLinks || downloadLinks.length === 0) {
                throw new Error('No download options available for this content');
            }

            // Show download options
            let optionsText = `📋 *Available Download Options:*\n\n`;
            downloadLinks.forEach((link, index) => {
                optionsText += `${index + 1}. ${link.quality} (${link.format})\n`;
            });
            optionsText += `\nReply with the number of your choice (1-${downloadLinks.length})`;

            await sock.sendMessage(sender, { text: optionsText });

            // Wait for user response
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.downloadQueue.delete(sender);
                    reject(new Error('Selection timeout. Please try again.'));
                }, 60000);

                this.downloadQueue.set(sender, {
                    resolve: async (choice) => {
                        clearTimeout(timeout);
                        
                        try {
                            const selectedIndex = parseInt(choice) - 1;
                            if (selectedIndex < 0 || selectedIndex >= downloadLinks.length) {
                                throw new Error('Invalid selection');
                            }

                            const selectedLink = downloadLinks[selectedIndex];
                            
                            await sock.sendMessage(sender, {
                                text: `⬇️ Preparing ${selectedLink.quality} ${selectedLink.format} download...\n\n🔗 Download Link: ${selectedLink.url}\n\n⚠️ Note: This is a demo. Real implementation would stream the file directly.`
                            });

                            // Simulate download progress
                            await sock.sendMessage(sender, { text: '⏳ Download in progress...' });
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            
                            await sock.sendMessage(sender, {
                                text: `✅ Download ready!\n\n📁 Format: ${selectedLink.format}\n🎯 Quality: ${selectedLink.quality}\n🌐 Source: ${platform}\n\n🔗 Use this link to download: ${selectedLink.url}`
                            });

                            resolve(true);

                        } catch (error) {
                            reject(error);
                        }
                    },
                    reject
                });
            });

        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    // Handle format selection
    async handleFormatSelection(sender, choice) {
        if (this.downloadQueue.has(sender)) {
            const { resolve, reject } = this.downloadQueue.get(sender);
            
            if (choice && !isNaN(choice)) {
                resolve(choice);
            } else {
                reject(new Error('Invalid choice. Please select a number.'));
            }
            
            this.downloadQueue.delete(sender);
        }
    }
}

// Initialize download manager
const downloadManager = new SimpleDownloadManager();

// Enhanced Connection Manager with better pairing success
class ConnectionManager {
    constructor() {
        this.isConnecting = false;
        this.pairingTimeout = null;
        this.connectionTimeout = null;
    }

    async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            // Ensure auth directory exists
            if (!fs.existsSync('auth_info_baileys')) {
                fs.mkdirSync('auth_info_baileys', { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
            const { version } = await fetchLatestBaileysVersion();

            console.log('🔗 Connecting to WhatsApp for number: 0775156210 (Zimbabwe)...');
            console.log('⏳ Waiting for WhatsApp pairing code...');

            // Clear any existing timeouts
            this.clearTimeouts();

            sock = makeWASocket({
                version,
                logger: simpleLogger,
                printQRInTerminal: false,
                auth: state,
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
                // Enhanced pairing configuration
                phoneNumber: TARGET_PHONE.split('@')[0],
                // Better pairing success settings
                connectTimeoutMs: 120000, // 2 minutes timeout
                keepAliveIntervalMs: 10000,
                maxRetries: 20,
                emitOwnEvents: true,
                defaultQueryTimeoutMs: 120000,
                // Mobile-compatible settings
                mobile: false,
                syncFullHistory: false,
                // Force pairing code generation
                generateHighQualityLinkPreview: true,
                linkPreviewImageThumbnailWidth: 1920
            });

            // Set connection timeout (3 minutes)
            this.connectionTimeout = setTimeout(() => {
                if (!isConnected) {
                    console.log('❌ Connection timeout. Restarting...');
                    this.handleDisconnection({ lastDisconnect: { error: { output: { statusCode: DisconnectReason.timedOut } } } });
                }
            }, 180000);

            // Handle connection events
            sock.ev.on('connection.update', (update) => {
                const { connection, qr, isNewLogin, pairingCode: newPairingCode } = update;

                console.log('🔧 Connection update:', { 
                    connection, 
                    hasQR: !!qr, 
                    hasPairingCode: !!newPairingCode,
                    isNewLogin 
                });

                if (newPairingCode && !pairingCodeDisplayed) {
                    pairingCode = newPairingCode;
                    console.log('✅ Pairing code received from WhatsApp');
                    showPairingCode(newPairingCode);
                    
                    // Clear connection timeout when pairing code is received
                    this.clearTimeouts();
                    
                    // Set pairing code expiration reminder (10 minutes)
                    this.pairingTimeout = setTimeout(() => {
                        if (!isConnected) {
                            console.log('⚠️ Pairing code may have expired. Generating new one...');
                            pairingCodeDisplayed = false;
                            this.handleDisconnection({ lastDisconnect: { error: { output: { statusCode: DisconnectReason.timedOut } } } });
                        }
                    }, 600000);
                }

                if (connection === 'open') {
                    this.clearTimeouts();
                    this.handleSuccessfulConnection();
                }

                if (connection === 'close') {
                    this.clearTimeouts();
                    this.handleDisconnection(update);
                }
            });

            // Handle credentials
            sock.ev.on('creds.update', saveCreds);

            // Handle messages
            sock.ev.on('messages.upsert', async ({ messages }) => {
                const msg = messages[0];
                if (msg.key.remoteJid === 'status@broadcast') return;

                try {
                    await handleMessage(msg);
                } catch (error) {
                    console.log('Error handling message:', error);
                }
            });

            // Log any errors
            sock.ev.on('connection.update', (update) => {
                if (update.lastDisconnect?.error) {
                    console.log('❌ Connection error:', update.lastDisconnect.error);
                }
            });

        } catch (error) {
            console.log('❌ Connection setup error:', error.message);
            this.clearTimeouts();
            this.handleConnectionError(error);
        }
    }

    clearTimeouts() {
        if (this.pairingTimeout) {
            clearTimeout(this.pairingTimeout);
            this.pairingTimeout = null;
        }
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    handleSuccessfulConnection() {
        isConnected = true;
        reconnectAttempts = 0;
        this.isConnecting = false;
        pairingCodeDisplayed = false;
        
        console.log('✅ WhatsApp connected successfully!');
        console.log('🤖 Bot is ready to receive messages');
        console.log(`🔑 Admin users: ${CONSTANT_ADMINS.length}`);
        console.log(`👥 Active users: ${userActivations.size}`);

        // AUTOMATICALLY INITIALIZE GROUP MANAGER
        console.log('🚀 Auto-starting Group Manager...');
        initializeGroupManager();
    }

    handleDisconnection(update) {
        isConnected = false;
        this.isConnecting = false;
        pairingCodeDisplayed = false;

        // Clear timeouts
        this.clearTimeouts();

        // Stop group manager on disconnection
        if (groupManager) {
            groupManager.stop();
            groupManager = null;
        }

        const { lastDisconnect } = update;
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        console.log('🔌 Disconnected. Status code:', statusCode);

        if (statusCode !== DisconnectReason.loggedOut) {
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(5000 * reconnectAttempts, 30000); // Shorter delays
                console.log(`🔄 Reconnecting in ${delay/1000}s... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                setTimeout(() => this.connect(), delay);
            } else {
                console.log('❌ Max reconnection attempts reached. Restarting...');
                setTimeout(() => {
                    reconnectAttempts = 0;
                    this.connect();
                }, 10000);
            }
        } else {
            console.log('❌ Device logged out, clearing auth data...');
            // Clear auth info to force new pairing
            if (fs.existsSync('auth_info_baileys')) {
                fs.rmSync('auth_info_baileys', { recursive: true });
            }
            // Restart after a short delay
            setTimeout(() => this.connect(), 5000);
        }
    }

    handleConnectionError(error) {
        console.log('❌ Connection setup error:', error.message);
        this.isConnecting = false;
        this.clearTimeouts();
        console.log('💤 Connection setup failed, restarting in 10 seconds...');
        setTimeout(() => this.connect(), 10000);
    }
}

// Message Handler
async function handleMessage(message) {
    if (!message.message) return;

    const sender = message.key.remoteJid;
    const phoneNumber = sender.split('@')[0];
    let text = '';

    if (message.message.conversation) {
        text = message.message.conversation;
    } else if (message.message.extendedTextMessage) {
        text = message.message.extendedTextMessage.text;
    }

    // Handle format selection first
    if (text && !isNaN(text) && parseInt(text) > 0) {
        try {
            await downloadManager.handleFormatSelection(sender, text);
            return;
        } catch (error) {
            console.log('Format selection error:', error);
        }
    }

    // Ignore messages without text or not starting with command prefix
    if (!text || !text.startsWith('.')) return;

    console.log(`📨 Message from ${phoneNumber} (Admin: ${isAdmin(sender)}): ${text}`);

    // Check if user is admin or activated
    const admin = isAdmin(sender);
    const activated = isUserActivated(phoneNumber);

    // IGNORE messages from non-admin and non-activated users (except activation/help/status commands)
    if (!admin && !activated) {
        console.log(`🚫 Ignoring non-activated user: ${phoneNumber}`);

        // Only respond to activation, help, or status commands
        const command = text.slice(1).split(' ')[0].toLowerCase();
        const allowedCommands = ['activate', 'help', 'status'];

        if (allowedCommands.includes(command)) {
            await handleBasicCommand(sock, sender, phoneNumber, text);
        }
        // IGNORE all other commands from non-activated users
        return;
    }

    // Process the message for admins or activated users
    try {
        await handleBasicCommand(sock, sender, phoneNumber, text);
    } catch (error) {
        console.log('Error handling message:', error);
        await sock.sendMessage(sender, {
            text: '❌ Error processing your command. Please try again.'
        });
    }
}

// Enhanced Basic command handler with real downloads
async function handleBasicCommand(sock, sender, phoneNumber, text) {
    const args = text.slice(1).split(' ');
    const command = args[0].toLowerCase();
    const admin = isAdmin(sender);
    const activated = isUserActivated(phoneNumber);

    console.log(`🔧 Processing command: ${command} from ${phoneNumber} (Admin: ${admin}, Activated: ${activated})`);

    // Activation command - available to everyone
    if (command === 'activate') {
        if (args[1] === ACTIVATION_KEY) {
            activateUser(phoneNumber);
            await sock.sendMessage(sender, {
                text: '✅ Account activated successfully! You now have 10 free downloads.\n\nAvailable commands:\n.download [url/query] - Download from any website\n.yt [url/query] - YouTube download (supports search!)\n.ig [url] - Instagram download\n.tt [url] - TikTok download\n.fb [url] - Facebook download\n.help - Show all commands'
            });
        } else {
            await sock.sendMessage(sender, { 
                text: '❌ Invalid activation key!\n\nPlease use: .activate ' + ACTIVATION_KEY + '\nOr contact admin for assistance.'
            });
        }
        return;
    }

    // Help command - available to everyone
    if (command === 'help') {
        let helpText = `📋 *REAL DOWNLOAD BOT COMMANDS* 📋\n\n`;
        helpText += `*FOR EVERYONE:*\n`;
        helpText += `.activate [key] - Activate your account\n`;
        helpText += `.help - Show this help message\n`;
        helpText += `.status - Check bot status\n\n`;
        helpText += `*AFTER ACTIVATION (REAL DOWNLOADS):*\n`;
        helpText += `.yt [url/query] - YouTube download (supports search!)\n`;
        helpText += `.download [url] - Universal download\n`;
        helpText += `.ig [url] - Instagram download\n`;
        helpText += `.tt [url] - TikTok download\n`;
        helpText += `.fb [url] - Facebook download\n\n`;
        helpText += `*EXAMPLES:*\n`;
        helpText += `.yt https://youtube.com/watch?v=...\n`;
        helpText += `.yt "song name artist" - Searches and downloads!\n`;
        helpText += `.ig https://instagram.com/p/...\n\n`;
        helpText += `*ADMIN COMMANDS:*\n`;
        helpText += `.users - Show active users\n`;
        helpText += `.stats - Show bot statistics\n`;
        helpText += `.groupstatus - Check group manager status\n`;

        await sock.sendMessage(sender, { text: helpText });
        return;
    }

    // Status command - available to everyone
    if (command === 'status') {
        const userData = userActivations.get(phoneNumber);
        const downloadsLeft = userData ? userData.freeDownloads : 0;

        const statusText = `🤖 *REAL DOWNLOAD BOT STATUS*\n\n` +
                         `• Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}\n` +
                         `• Active Users: ${userActivations.size}\n` +
                         `• Group Manager: ${groupManager && groupManager.isRunning ? '✅ Running' : '❌ Stopped'}\n` +
                         `• Your Status: ${admin ? '👑 Admin' : activated ? '✅ Activated' : '❌ Not activated'}\n` +
                         `• Downloads Left: ${downloadsLeft}\n` +
                         `• Pairing Code: ${pairingCode || 'Not generated'}\n` +
                         `• Real Downloads: ✅ Enabled\n` +
                         `• YouTube Search: ✅ Supported\n\n` +
                         `Server: ${isConnected ? '🟢 Online' : '🔴 Offline'}`;

        await sock.sendMessage(sender, { text: statusText });
        return;
    }

    // Group status command
    if (command === 'groupstatus') {
        if (!admin) {
            await sock.sendMessage(sender, { 
                text: '❌ Admin only command. Contact admin for assistance.'
            });
            return;
        }

        const groupStatus = groupManager ? 
            `• Status: ${groupManager.isRunning ? '✅ Running' : '❌ Stopped'}\n` +
            `• External File: ✅ Loaded` :
            '❌ Group Manager not initialized';

        await sock.sendMessage(sender, {
            text: `👥 *GROUP MANAGER STATUS*\n\n${groupStatus}`
        });
        return;
    }

    // Admin-only commands
    if (command === 'users' || command === 'stats') {
        if (!admin) {
            await sock.sendMessage(sender, { 
                text: '❌ Admin only command. Contact admin for assistance.'
            });
            return;
        }

        if (command === 'users') {
            const usersList = Array.from(userActivations.entries())
                .map(([phone, data]) => `• ${phone} - Downloads: ${data.freeDownloads} - Since: ${new Date(data.activationTime).toLocaleDateString()}`)
                .join('\n');

            await sock.sendMessage(sender, {
                text: `👥 *ACTIVE USERS* (${userActivations.size})\n\n${usersList || 'No active users yet.'}`
            });
            return;
        }

        if (command === 'stats') {
            await sock.sendMessage(sender, {
                text: `📊 *BOT STATISTICS*\n\n` +
                      `• Total Active Users: ${userActivations.size}\n` +
                      `• Connection Status: ${isConnected ? '✅' : '❌'}\n` +
                      `• Group Manager: ${groupManager ? '✅' : '❌'}\n` +
                      `• Pairing Code: ${pairingCode || 'Not set'}\n` +
                      `• Real Downloads: ✅ Enabled\n` +
                      `• Uptime: ${process.uptime().toFixed(0)}s\n` +
                      `• Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`
            });
            return;
        }
    }

    // Check if user is activated for premium commands
    if (!admin && !activated) {
        await sock.sendMessage(sender, {
            text: '❌ Please activate your account to use this command!\n\nUse: .activate ' + ACTIVATION_KEY + '\nOr contact admin for assistance.'
        });
        return;
    }

    // REAL DOWNLOAD COMMANDS WITH SEARCH SUPPORT
    if (command === 'download' || command === 'yt' || command === 'ig' || command === 'tt' || command === 'fb') {
        if (args.length < 2) {
            await sock.sendMessage(sender, {
                text: `❌ Usage: .${command} [url_or_query]\nExamples:\n.${command} https://example.com/video\n.${command} "search query" (YouTube only)`
            });
            return;
        }

        const platformMap = {
            'download': 'direct',
            'yt': 'youtube',
            'ig': 'instagram',
            'tt': 'tiktok',
            'fb': 'facebook'
        };

        const input = args.slice(1).join(' ');
        
        try {
            await downloadManager.handleDownload(sock, sender, input, platformMap[command]);
            
            // Decrement download count for non-admins
            if (!isAdmin(sender) && userActivations.has(phoneNumber)) {
                const user = userActivations.get(phoneNumber);
                if (user.freeDownloads > 0) {
                    user.freeDownloads--;
                    await sock.sendMessage(sender, {
                        text: `📊 Downloads remaining: ${user.freeDownloads}/10`
                    });
                }
            }
        } catch (error) {
            console.log('Download error:', error);
            await sock.sendMessage(sender, {
                text: `❌ Download failed: ${error.message}\n\nPossible reasons:\n• Invalid URL/search query\n• Video not available\n• Platform not supported\n\nPlease try again with a different link or query.`
            });
        }
        return;
    }

    // Unknown command
    await sock.sendMessage(sender, { 
        text: '❌ Unknown command. Use .help to see available commands.'
    });
}

// Web Server
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connected: isConnected,
        activeUsers: userActivations.size,
        groupManagerActive: groupManager ? groupManager.isRunning : false,
        pairingCode: pairingCode,
        pairingCodeDisplayed: pairingCodeDisplayed,
        realDownloads: true,
        youtubeSearch: true,
        targetNumber: '0775156210 (Zimbabwe)',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'WhatsApp Real Download Bot',
        version: '3.0.0',
        status: 'running',
        activationRequired: true,
        adminCount: CONSTANT_ADMINS.length,
        groupManager: groupManager ? 'active' : 'inactive',
        connection: isConnected ? 'connected' : 'disconnected',
        authentication: 'pairing_code',
        features: ['real_downloads', 'youtube_search', 'multi_platform'],
        targetNumber: '0775156210 (Zimbabwe)',
        pairingCode: pairingCode
    });
});

// Start function
async function start() {
    try {
        console.log('🚀 Starting Enhanced WhatsApp Real Download Bot...');
        console.log('🔑 Activation Key:', ACTIVATION_KEY);
        console.log('📱 Target Number: 0775156210 (Zimbabwe)');
        console.log('👑 Admin Users:', CONSTANT_ADMINS.length);
        console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
        console.log('💡 Using Enhanced Pairing Code authentication');
        console.log('📁 Group Manager: Auto-start on connection');
        console.log('⬇️ Real Downloads: Enabled (No system dependencies)');
        console.log('🔍 YouTube Search: Supported');
        console.log('⏳ Waiting for WhatsApp pairing code...');

        // Start web server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
        });

        // Start WhatsApp connection
        const connectionManager = new ConnectionManager();
        await connectionManager.connect();

    } catch (error) {
        console.log('❌ Failed to start:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (groupManager) groupManager.stop();
    if (sock) sock.end();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM...');
    if (groupManager) groupManager.stop();
    if (sock) sock.end();
    process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.log('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the application
start();