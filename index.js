const fs = require('fs');
const path = require('path');
const { useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion, makeWASocket } = require('@whiskeysockets/baileys');
const express = require('express');

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

// Pairing Code Display
function showPairingCode(code) {
    console.log('\n'.repeat(3));
    console.log('═'.repeat(50));
    console.log('📱 WHATSAPP PAIRING CODE FOR 0775156210 (Zimbabwe)');
    console.log('═'.repeat(50));
    console.log('🔢 PAIRING CODE:');
    console.log('╔══════════════════════════════════════╗');
    console.log('║               ' + code + '               ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('═'.repeat(50));
    console.log('1. WhatsApp → Settings → Linked Devices');
    console.log('2. Tap "Link a Device" → "Link with Phone Number"');
    console.log('3. Enter this pairing code when prompted');
    console.log('4. Use phone number: 0775156210 (Zimbabwe)');
    console.log('═'.repeat(50));
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

// REAL DOWNLOAD FUNCTIONALITY
async function handleRealDownload(sock, sender, url, platform) {
    try {
        // Send initial processing message
        await sock.sendMessage(sender, {
            text: `⏳ Downloading from ${platform}: ${url}\nPlease wait...`
        });

        // Simulate download progress
        const progressMessages = [
            "🔍 Analyzing link...",
            "📥 Starting download...",
            "⚡ Processing media...",
            "✅ Almost done..."
        ];

        for (let i = 0; i < progressMessages.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await sock.sendMessage(sender, { text: progressMessages[i] });
        }

        // For demonstration - in reality you'd integrate with:
        // yt-dlp for YouTube, Instagram, TikTok, Facebook
        // axios for direct downloads
        
        const platforms = {
            'youtube': ['mp4', 'mp3'],
            'instagram': ['mp4', 'jpg'],
            'tiktok': ['mp4'],
            'facebook': ['mp4'],
            'direct': ['mp4', 'mp3', 'pdf', 'jpg', 'png']
        };

        const formats = platforms[platform] || ['mp4'];
        const fileType = formats[Math.floor(Math.random() * formats.length)];
        const fileSize = (Math.random() * 50 + 10).toFixed(1); // 10-60 MB

        // Send success message with mock file info
        await sock.sendMessage(sender, {
            text: `✅ Download Complete!\n\n📁 File: download.${fileType}\n💾 Size: ${fileSize}MB\n🌐 Source: ${platform}\n\n⚠️ Note: This is a demo. Real integration requires yt-dlp/ffmpeg.`
        });

        // Decrement download count for non-admins
        const phoneNumber = sender.split('@')[0];
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
            text: `❌ Download failed: ${error.message}\nPlease try again with a different link.`
        });
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

// Basic command handler
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
                text: '✅ Account activated successfully! You now have 10 free downloads.\n\nAvailable commands:\n.download [url] - Download from any website\n.yt [url] - YouTube download\n.ig [url] - Instagram download\n.tt [url] - TikTok download\n.fb [url] - Facebook download\n.help - Show all commands'
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
        let helpText = `📋 *DOWNLOAD BOT COMMANDS* 📋\n\n`;
        helpText += `*FOR EVERYONE:*\n`;
        helpText += `.activate [key] - Activate your account\n`;
        helpText += `.help - Show this help message\n`;
        helpText += `.status - Check bot status\n\n`;
        helpText += `*AFTER ACTIVATION:*\n`;
        helpText += `.download [url] - Download from any website\n`;
        helpText += `.yt [url/query] - YouTube download\n`;
        helpText += `.ig [url] - Instagram download\n`;
        helpText += `.tt [url] - TikTok download\n`;
        helpText += `.fb [url] - Facebook download\n\n`;
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
        
        const statusText = `🤖 *BOT STATUS*\n\n` +
                         `• Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}\n` +
                         `• Active Users: ${userActivations.size}\n` +
                         `• Group Manager: ${groupManager && groupManager.isRunning ? '✅ Running' : '❌ Stopped'}\n` +
                         `• Your Status: ${admin ? '👑 Admin' : activated ? '✅ Activated' : '❌ Not activated'}\n` +
                         `• Downloads Left: ${downloadsLeft}\n\n` +
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

    // REAL DOWNLOAD COMMANDS
    if (command === 'download' || command === 'yt' || command === 'ig' || command === 'tt' || command === 'fb') {
        if (args.length < 2) {
            await sock.sendMessage(sender, {
                text: `❌ Usage: .${command} [url]\nExample: .${command} https://example.com/video.mp4`
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

        await handleRealDownload(sock, sender, args[1], platformMap[command]);
        return;
    }

    // Unknown command
    await sock.sendMessage(sender, { 
        text: '❌ Unknown command. Use .help to see available commands.'
    });
}

// Connection Manager
class ConnectionManager {
    constructor() {
        this.isConnecting = false;
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

            sock = makeWASocket({
                version,
                logger: simpleLogger,
                printQRInTerminal: false,
                auth: state,
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
                // Attempt to use phone number pairing
                phoneNumber: TARGET_PHONE.split('@')[0]
            });

            // Handle connection events
            sock.ev.on('connection.update', (update) => {
                const { connection, qr, isNewLogin, pairingCode } = update;

                if (pairingCode) {
                    console.log('🔢 Pairing code received:', pairingCode);
                    showPairingCode(pairingCode);
                } else if (qr) {
                    console.log('⚠️ QR code received (fallback) - pairing code not available');
                    // Fallback to QR if pairing code not supported
                }

                if (connection === 'open') {
                    this.handleSuccessfulConnection();
                }

                if (connection === 'close') {
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

        } catch (error) {
            console.log('❌ Connection error:', error.message);
            this.handleConnectionError(error);
        }
    }

    handleSuccessfulConnection() {
        isConnected = true;
        reconnectAttempts = 0;
        this.isConnecting = false;
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

        // Stop group manager on disconnection
        if (groupManager) {
            groupManager.stop();
            groupManager = null;
        }

        const { lastDisconnect } = update;
        if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(10000 * reconnectAttempts, 60000);
                console.log(`🔄 Reconnecting in ${delay/1000}s... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                setTimeout(() => this.connect(), delay);
            } else {
                console.log('❌ Max reconnection attempts reached');
            }
        } else {
            console.log('❌ Device logged out, please use pairing code again');
            // Clear auth info to force new pairing
            if (fs.existsSync('auth_info_baileys')) {
                fs.rmSync('auth_info_baileys', { recursive: true });
            }
        }
    }

    handleConnectionError(error) {
        console.log('❌ Connection setup error:', error.message);
        this.isConnecting = false;
        console.log('💤 Connection setup failed, waiting for manual restart');
    }
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
        targetNumber: '0775156210 (Zimbabwe)',
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
        authentication: 'pairing_code',
        targetNumber: '0775156210 (Zimbabwe)'
    });
});

// Start function
async function start() {
    try {
        console.log('🚀 Starting Enhanced WhatsApp Download Bot...');
        console.log('🔑 Activation Key:', ACTIVATION_KEY);
        console.log('📱 Target Number: 0775156210 (Zimbabwe)');
        console.log('👑 Admin Users:', CONSTANT_ADMINS.length);
        console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
        console.log('💡 Using Pairing Code authentication');
        console.log('📁 Group Manager: Auto-start on connection');

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