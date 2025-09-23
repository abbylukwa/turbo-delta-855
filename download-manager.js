const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

// Crypto polyfill for Render
if (typeof crypto === 'undefined') {
    global.crypto = require('crypto');
}

const { useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');

// Import our modules
const GeneralCommands = require('./generalCommands');
const DownloadManager = require('./downloadManager');

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

// Initialize managers
const downloadManager = new DownloadManager();
const generalCommands = new GeneralCommands(downloadManager);

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

// QR Code Display - KEPT CLEAN AS REQUESTED
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
}

function isUserActivated(phoneNumber) {
    const user = userActivations.get(phoneNumber);
    return user && user.activated;
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

    if (!text.startsWith('.')) return;

    // Handle commands via GeneralCommands
    const handled = await generalCommands.handleCommand(sock, sender, phoneNumber, text);
    
    if (!handled) {
        // Fallback to basic commands
        await handleBasicCommand(sock, sender, phoneNumber, text);
    }
}

// Basic command handler (fallback)
async function handleBasicCommand(sock, sender, phoneNumber, text) {
    const args = text.slice(1).split(' ');
    const command = args[0].toLowerCase();

    if (command === 'activate') {
        if (args[1] === ACTIVATION_KEY) {
            activateUser(phoneNumber);
            await sock.sendMessage(sender, {
                text: '✅ Account activated! You have 10 free downloads.\nUse .help to see all commands'
            });
        } else {
            await sock.sendMessage(sender, { text: '❌ Invalid activation key' });
        }
        return;
    }

    if (command === 'help') {
        await sock.sendMessage(sender, {
            text: `📋 BASIC COMMANDS:
.activate [key] - Activate your account
.download [url] - Download from any website
.search [query] - Search and download
.status - Check bot status
.help - Show this message

🎯 ADVANCED COMMANDS (after activation):
.download mp4 [url] - Download as MP4
.download mp3 [url] - Download as MP3
.yt [query/url] - YouTube specific download
.ig [url] - Instagram download
.tt [url] - TikTok download`
        });
        return;
    }

    if (command === 'status') {
        await sock.sendMessage(sender, {
            text: `🤖 BOT STATUS:
• Connected: ${isConnected ? '✅' : '❌'}
• Active Users: ${userActivations.size}
• Your Status: ${isUserActivated(phoneNumber) ? '✅ Activated' : '❌ Not activated'}`
        });
        return;
    }

    await sock.sendMessage(sender, { text: '❌ Unknown command. Use .help' });
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

            const { default: makeWASocket } = await import('@whiskeysockets/baileys');
            
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
                    this.handleDisconnection();
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
    }

    handleDisconnection() {
        isConnected = false;
        this.isConnecting = false;

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(10000 * reconnectAttempts, 60000);
            console.log(`🔄 Reconnecting in ${delay/1000}s... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.log('❌ Max reconnection attempts reached');
        }
    }

    handleConnectionError(error) {
        console.log('❌ Connection setup error:', error.message);
        this.isConnecting = false;
        this.handleDisconnection();
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
        users: userActivations.size,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'WhatsApp Download Bot',
        version: '2.0.0',
        status: 'running'
    });
});

// Start function
async function start() {
    try {
        console.log('🚀 Starting Enhanced WhatsApp Download Bot...');
        console.log('🔑 Activation Key:', ACTIVATION_KEY);
        console.log('🌐 Environment:', process.env.NODE_ENV || 'development');

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
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM...');
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