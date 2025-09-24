const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion, makeWASocket } = require('@whiskeysockets/baileys');
const express = require('express');

// Import GroupManager from external file
const GroupManager = require('./GroupManager');

// Config
const ACTIVATION_KEY = 'Abbie911';
const CONSTANT_ADMINS = [
    '0775156210@s.whatsapp.net', 
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

// QR Code Display
function showQR(qr) {
    console.log('\n'.repeat(3));
    console.log('═'.repeat(50));
    console.log('📱 WHATSAPP QR CODE - SCAN WITH YOUR PHONE');
    console.log('═'.repeat(50));
    qrcode.generate(qr, { small: true });
    console.log('═'.repeat(50));
    console.log('1. WhatsApp → Settings → Linked Devices');
    console.log('2. Tap "Link a Device"');
    console.log('3. Scan the QR code above');
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
                text: '✅ Account activated successfully! You now have 10 free downloads.\n\nAvailable commands:\n.download [url] - Download from any website\n.yt [url] - YouTube download\n.ig [url] - Instagram download\n.tt [url] - TikTok download\n.help - Show all commands'
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
        const statusText = `🤖 *BOT STATUS*\n\n` +
                         `• Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}\n` +
                         `• Active Users: ${userActivations.size}\n` +
                         `• Group Manager: ${groupManager && groupManager.isRunning ? '✅ Running' : '❌ Stopped'}\n` +
                         `• Your Status: ${admin ? '👑 Admin' : activated ? '✅ Activated' : '❌ Not activated'}\n` +
                         `• Downloads Left: ${activated ? '10' : '0'}\n\n` +
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
            `• Active Tasks: ${groupManager.intervals ? groupManager.intervals.length + groupManager.timeouts.length : 'N/A'}\n` +
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
                .map(([phone, data]) => `• ${phone} - Activated: ${new Date(data.activationTime).toLocaleDateString()}`)
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

    // Premium commands for activated users and admins
    switch (command) {
        case 'download':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .download [url]\nExample: .download https://example.com/video.mp4'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `⏳ Starting download from: ${args[1]}\nThis may take a few moments...`
            });
            break;

        case 'yt':
        case 'youtube':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .yt [url or search query]\nExample: .yt https://youtube.com/watch?v=abc123'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `🎥 Processing YouTube request: ${args.slice(1).join(' ')}...`
            });
            break;

        case 'ig':
        case 'instagram':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .ig [url]\nExample: .ig https://instagram.com/p/abc123'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `📸 Processing Instagram request: ${args[1]}...`
            });
            break;

        case 'tt':
        case 'tiktok':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .tt [url]\nExample: .tt https://tiktok.com/@user/video/123'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `🎵 Processing TikTok request: ${args[1]}...`
            });
            break;

        case 'fb':
        case 'facebook':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .fb [url]\nExample: .fb https://facebook.com/video/abc123'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `👥 Processing Facebook request: ${args[1]}...`
            });
            break;

        default:
            await sock.sendMessage(sender, { 
                text: '❌ Unknown command. Use .help to see available commands.'
            });
    }
}

// Connection Manager
class ConnectionManager {
    constructor() {
        this.isConnecting = false;
        this.qrDisplayCount = 0;
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

            console.log('🔗 Connecting to WhatsApp...');

            sock = makeWASocket({
                version,
                logger: simpleLogger,
                printQRInTerminal: false,
                auth: state,
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true
            });

            // Handle connection events
            sock.ev.on('connection.update', (update) => {
                const { connection, qr } = update;

                if (qr) {
                    this.qrDisplayCount++;
                    showQR(qr);
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
        
        // Initialize Group Manager from external file after successful connection
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
            console.log('❌ Device logged out, please scan QR code again');
            // Clear auth info to force new QR scan
            if (fs.existsSync('auth_info_baileys')) {
                fs.rmSync('auth_info_baileys', { recursive: true });
            }
        }
    }

    handleConnectionError(error) {
        console.log('❌ Connection setup error:', error.message);
        this.isConnecting = false;
        // Don't attempt reconnection for setup errors
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
        externalGroupManager: true,
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
        externalGroupManager: true
    });
});

// Start function
async function start() {
    try {
        console.log('🚀 Starting Enhanced WhatsApp Download Bot...');
        console.log('🔑 Activation Key:', ACTIVATION_KEY);
        console.log('👑 Admin Users:', CONSTANT_ADMINS.length);
        console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
        console.log('💡 Bot will IGNORE messages from non-activated users except admins');
        console.log('📁 Group Manager: External file');

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