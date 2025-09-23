const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { ReadableStream } = require('web-streams-polyfill');
global.ReadableStream = ReadableStream;

const { delay } = require('@whiskeysockets/baileys');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const { Pool } = require('pg');

// Group Manager Integration
const { spawn } = require('child_process');

// Message storage
const yourMessages = {
    received: [],
    sent: [],
    groups: new Map(),
    contacts: new Map()
};

class GroupManager {
    constructor() {
        this.nodeProcess = null;
        this.isRunning = false;
    }

    start() {
        try {
            console.log('🚀 Starting Group Manager...');
            this.nodeProcess = spawn('node', ['group-manager.js'], {
                cwd: __dirname,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' }
            });

            this.nodeProcess.stdout.on('data', (data) => {
                console.log(`📱 Group Manager: ${data.toString().trim()}`);
            });

            this.nodeProcess.stderr.on('data', (data) => {
                console.error(`📱 Group Manager Error: ${data.toString().trim()}`);
            });

            this.nodeProcess.on('close', (code) => {
                console.log(`📱 Group Manager process exited with code ${code}`);
                this.isRunning = false;
                if (code !== 0) {
                    console.log('🔄 Restarting Group Manager in 5 seconds...');
                    setTimeout(() => this.start(), 5000);
                }
            });

            this.nodeProcess.on('error', (error) => {
                console.error('📱 Failed to start Group Manager:', error);
                this.isRunning = false;
            });

            this.isRunning = true;
            console.log('✅ Group Manager started successfully');
        } catch (error) {
            console.error('❌ Error starting Group Manager:', error);
        }
    }

    stop() {
        if (this.nodeProcess) {
            console.log('🛑 Stopping Group Manager...');
            this.nodeProcess.kill();
            this.isRunning = false;
        }
    }

    restart() {
        this.stop();
        setTimeout(() => this.start(), 2000);
    }
}

// Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://database_3lb1_user:SG82maildcd1UeiIs0Gdndp8tMPRjOcI@dpg-d37c830gjchc73c5l15g-a/database_3lb1',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Config
const YOUR_PERSONAL_NUMBER = '0775156210';
const YOUR_PERSONAL_JID = `${YOUR_PERSONAL_NUMBER}@s.whatsapp.net`;
const CONSTANT_ADMINS = [
    YOUR_PERSONAL_JID, 
    '27614159817@s.whatsapp.net', 
    '263717457592@s.whatsapp.net', 
    '263777627210@s.whatsapp.net'
];

// Activation System
const ACTIVATION_KEY = 'Abbie911';
const userActivations = new Map();

// State
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 50000;

// Initialize Group Manager
const groupManager = new GroupManager();

// FIXED: Simple logger that works with Baileys
const createLogger = () => {
    return {
        trace: (msg) => {
            if (typeof msg === 'object') {
                console.log('🔍 TRACE:', JSON.stringify(msg, null, 2));
            } else {
                console.log('🔍 TRACE:', msg);
            }
        },
        debug: (msg) => {
            if (typeof msg === 'object') {
                console.log('🐛 DEBUG:', JSON.stringify(msg, null, 2));
            } else {
                console.log('🐛 DEBUG:', msg);
            }
        },
        info: (msg) => {
            if (typeof msg === 'object') {
                console.log('ℹ️ INFO:', JSON.stringify(msg, null, 2));
            } else {
                console.log('ℹ️ INFO:', msg);
            }
        },
        warn: (msg) => {
            if (typeof msg === 'object') {
                console.warn('⚠️ WARN:', JSON.stringify(msg, null, 2));
            } else {
                console.warn('⚠️ WARN:', msg);
            }
        },
        error: (msg) => {
            if (typeof msg === 'object') {
                console.error('❌ ERROR:', JSON.stringify(msg, null, 2));
            } else {
                console.error('❌ ERROR:', msg);
            }
        },
        fatal: (msg) => {
            if (typeof msg === 'object') {
                console.error('💀 FATAL:', JSON.stringify(msg, null, 2));
            } else {
                console.error('💀 FATAL:', msg);
            }
        },
        child: () => createLogger()
    };
};

// Core functions
async function ensureDirectories() {
    const dirs = ['auth_info_baileys', 'data', 'downloads', 'downloads/music', 'downloads/videos', 'downloads/reels'];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

function cleanupTempFiles() {
    ['temp', 'downloads/temp'].forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
}

function storePersonalMessage(message) {
    try {
        const messageData = {
            timestamp: new Date().toISOString(),
            from: message.key.remoteJid,
            message: message.message,
            type: Object.keys(message.message)[0],
            id: message.key.id,
            participant: message.key.participant
        };
        yourMessages.received.push(messageData);
    } catch (error) {
        console.error('Error storing message:', error);
    }
}

// User Activation Management
function activateUser(phoneNumber) {
    userActivations.set(phoneNumber, {
        activated: true,
        freeDownloads: 4,
        activationTime: new Date(),
        lastDownload: null
    });
}

function isUserActivated(phoneNumber) {
    const user = userActivations.get(phoneNumber);
    return user && user.activated;
}

function useFreeDownload(phoneNumber) {
    const user = userActivations.get(phoneNumber);
    if (user && user.freeDownloads > 0) {
        user.freeDownloads--;
        user.lastDownload = new Date();
        return true;
    }
    return false;
}

function getUserStatus(phoneNumber) {
    const user = userActivations.get(phoneNumber);
    if (!user) return { activated: false, freeDownloads: 0 };
    return user;
}

// FIXED: QR Code Display Function
function displayQRCode(qr, count) {
    console.log('\n' + '='.repeat(60));
    console.log('📱 WHATSAPP QR CODE - SCAN WITH YOUR PHONE');
    console.log('='.repeat(60));
    console.log(`Scan Count: ${count}`);
    console.log('='.repeat(60));
    console.log('');
    
    // Generate QR code directly to terminal
    qrcode.generate(qr, { small: true });
    
    console.log('');
    console.log('💡 Instructions:');
    console.log('1. Open WhatsApp on your phone');
    console.log('2. Go to Settings → Linked Devices → Link a Device');
    console.log('3. Scan the QR code above');
    console.log('='.repeat(60));
    console.log('');
}

// Simple Download Manager
class SimpleDownloadManager {
    constructor() {
        this.downloadsDir = path.join(__dirname, 'downloads');
        this.ensureDirectoriesExist();
    }

    ensureDirectoriesExist() {
        if (!fs.existsSync(this.downloadsDir)) {
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getStorageUsage(phoneNumber) {
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (!fs.existsSync(userDir)) return 0;
        
        let totalSize = 0;
        try {
            const files = fs.readdirSync(userDir);
            files.forEach(file => {
                const filePath = path.join(userDir, file);
                try {
                    totalSize += fs.statSync(filePath).size;
                } catch (error) {
                    console.error(`Error getting stats for ${filePath}:`, error);
                }
            });
        } catch (error) {
            console.error(`Error reading user directory ${userDir}:`, error);
        }
        return totalSize;
    }

    getUserDownloads(phoneNumber) {
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (!fs.existsSync(userDir)) return [];
        
        return fs.readdirSync(userDir).map(file => {
            const filePath = path.join(userDir, file);
            try {
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    date: stats.mtime,
                    path: filePath
                };
            } catch (error) {
                console.error(`Error reading file ${filePath}:`, error);
                return null;
            }
        }).filter(Boolean);
    }

    isUrlSupported(url) {
        const supportedSites = ['youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'facebook.com', 'twitter.com'];
        return supportedSites.some(site => url.includes(site));
    }

    async downloadContent(url, phoneNumber) {
        // Simulate download process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        const filename = `download_${Date.now()}.mp4`;
        const filePath = path.join(userDir, filename);
        
        // Create a dummy file for simulation
        fs.writeFileSync(filePath, 'Simulated download content');
        const stats = fs.statSync(filePath);
        
        return {
            path: filePath,
            name: filename,
            size: stats.size,
            type: 'video'
        };
    }

    async downloadFromSearch(query, phoneNumber) {
        // Simulate search and download
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const userDir = path.join(this.downloadsDir, phoneNumber);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        const filename = `search_${query.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp4`;
        const filePath = path.join(userDir, filename);
        
        fs.writeFileSync(filePath, `Search result for: ${query}`);
        const stats = fs.statSync(filePath);
        
        return {
            path: filePath,
            name: filename,
            size: stats.size,
            type: 'video'
        };
    }
}

// Initialize Download Manager
const downloadManager = new SimpleDownloadManager();

// Enhanced Message Processing
async function processMessage(sock, message) {
    if (!message.message) return;
    storePersonalMessage(message);

    const sender = message.key.remoteJid;
    const phoneNumber = sender.split('@')[0];
    const messageType = Object.keys(message.message)[0];
    let text = '';

    if (messageType === 'conversation') {
        text = message.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
        text = message.message.extendedTextMessage.text;
    }

    if (sender.endsWith('@broadcast') || sender === 'status@broadcast') {
        return;
    }

    const commandMatch = text.match(/^\.(\w+)(?:\s+(.*))?$/);
    if (!commandMatch) {
        if (isUserActivated(phoneNumber) || CONSTANT_ADMINS.includes(sender)) {
            await handleDownloadRequest(sock, message, text, phoneNumber);
        }
        return;
    }

    const command = commandMatch[1].toLowerCase();
    const args = commandMatch[2] ? commandMatch[2].split(' ') : [];

    if (command === 'activate') {
        if (args[0] === ACTIVATION_KEY) {
            activateUser(phoneNumber);
            await sock.sendMessage(sender, {
                text: `✅ Activation successful! You now have 4 free downloads.\n\nCommands: .download [url], .search [query], .mystatus, .help`
            });
        } else {
            await sock.sendMessage(sender, {
                text: '❌ Invalid activation key.'
            });
        }
        return;
    }

    switch (command) {
        case 'status':
            await sock.sendMessage(sender, {
                text: `🤖 Bot Status:\n• Connected: ${isConnected ? '✅' : '❌'}\n• Group Manager: ${groupManager.isRunning ? '✅ Running' : '❌ Stopped'}`
            });
            break;

        case 'help':
            await sock.sendMessage(sender, {
                text: `📋 Commands:\n• .activate [key] - Activate account\n• .download [url] - Download from URL\n• .search [query] - Search & download\n• .mydownloads - View downloads\n• .mystatus - Check your status\n• .help - This message`
            });
            break;

        case 'mystatus':
            const userStatus = getUserStatus(phoneNumber);
            if (userStatus.activated) {
                await sock.sendMessage(sender, {
                    text: `📊 Your Status:\n• Activated: ✅\n• Free Downloads: ${userStatus.freeDownloads}/4\n• Storage: ${downloadManager.formatFileSize(downloadManager.getStorageUsage(phoneNumber))}`
                });
            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Account not activated. Use .activate [key]'
                });
            }
            break;

        case 'download':
            if (!isUserActivated(phoneNumber) && !CONSTANT_ADMINS.includes(sender)) {
                await sock.sendMessage(sender, { text: '❌ Please activate first: .activate [key]' });
                return;
            }
            if (!args[0]) {
                await sock.sendMessage(sender, { text: '❌ Usage: .download [url]' });
                return;
            }
            await handleDownload(sock, sender, phoneNumber, args[0]);
            break;

        case 'search':
            if (!isUserActivated(phoneNumber) && !CONSTANT_ADMINS.includes(sender)) {
                await sock.sendMessage(sender, { text: '❌ Please activate first: .activate [key]' });
                return;
            }
            if (!args[0]) {
                await sock.sendMessage(sender, { text: '❌ Usage: .search [query]' });
                return;
            }
            await handleSearchDownload(sock, sender, phoneNumber, args.join(' '));
            break;

        case 'mydownloads':
            if (!isUserActivated(phoneNumber) && !CONSTANT_ADMINS.includes(sender)) {
                await sock.sendMessage(sender, { text: '❌ Please activate first: .activate [key]' });
                return;
            }
            await showUserDownloads(sock, sender, phoneNumber);
            break;

        // Admin commands
        case 'gmrestart':
            if (!CONSTANT_ADMINS.includes(sender)) {
                await sock.sendMessage(sender, { text: '❌ Admin only' });
                return;
            }
            await sock.sendMessage(sender, { text: '🔄 Restarting Group Manager...' });
            groupManager.restart();
            break;

        case 'gmstatus':
            if (!CONSTANT_ADMINS.includes(sender)) {
                await sock.sendMessage(sender, { text: '❌ Admin only' });
                return;
            }
            await sock.sendMessage(sender, {
                text: `📱 Group Manager: ${groupManager.isRunning ? '✅ Running' : '❌ Stopped'}`
            });
            break;

        case 'startgm':
            if (!CONSTANT_ADMINS.includes(sender)) {
                await sock.sendMessage(sender, { text: '❌ Admin only' });
                return;
            }
            if (!groupManager.isRunning) {
                groupManager.start();
                await sock.sendMessage(sender, { text: '🚀 Starting...' });
            } else {
                await sock.sendMessage(sender, { text: '⚠️ Already running' });
            }
            break;

        case 'stopgm':
            if (!CONSTANT_ADMINS.includes(sender)) {
                await sock.sendMessage(sender, { text: '❌ Admin only' });
                return;
            }
            if (groupManager.isRunning) {
                groupManager.stop();
                await sock.sendMessage(sender, { text: '🛑 Stopping...' });
            } else {
                await sock.sendMessage(sender, { text: '⚠️ Already stopped' });
            }
            break;

        default:
            await sock.sendMessage(sender, { text: "❌ Unknown command. Use .help" });
    }
}

// Download Handling Functions
async function handleDownload(sock, sender, phoneNumber, url) {
    try {
        const isAdmin = CONSTANT_ADMINS.includes(sender);
        if (!isAdmin && !useFreeDownload(phoneNumber)) {
            await sock.sendMessage(sender, { text: '❌ No free downloads left.' });
            return;
        }

        await sock.sendMessage(sender, { text: '⏬ Downloading...' });
        const result = await downloadManager.downloadContent(url, phoneNumber);
        
        await sock.sendMessage(sender, {
            text: `✅ Done! ${result.name} (${downloadManager.formatFileSize(result.size)})`
        });

        const fileBuffer = fs.readFileSync(result.path);
        await sock.sendMessage(sender, {
            document: fileBuffer,
            fileName: result.name
        });

    } catch (error) {
        await sock.sendMessage(sender, { text: `❌ Download failed: ${error.message}` });
    }
}

async function handleSearchDownload(sock, sender, phoneNumber, query) {
    try {
        const isAdmin = CONSTANT_ADMINS.includes(sender);
        if (!isAdmin && !useFreeDownload(phoneNumber)) {
            await sock.sendMessage(sender, { text: '❌ No free downloads left.' });
            return;
        }

        await sock.sendMessage(sender, { text: `🔍 Searching: ${query}...` });
        const result = await downloadManager.downloadFromSearch(query, phoneNumber);
        
        await sock.sendMessage(sender, {
            text: `✅ Done! ${result.name} (${downloadManager.formatFileSize(result.size)})`
        });

        const fileBuffer = fs.readFileSync(result.path);
        await sock.sendMessage(sender, {
            document: fileBuffer,
            fileName: result.name
        });

    } catch (error) {
        await sock.sendMessage(sender, { text: `❌ Search failed: ${error.message}` });
    }
}

async function showUserDownloads(sock, sender, phoneNumber) {
    try {
        const downloads = downloadManager.getUserDownloads(phoneNumber);
        if (downloads.length === 0) {
            await sock.sendMessage(sender, { text: '📭 No downloads found.' });
            return;
        }

        let message = `📂 Your Downloads (${downloads.length}):\n\n`;
        downloads.slice(-10).forEach((download, index) => {
            message += `${index + 1}. ${download.name}\n   Size: ${downloadManager.formatFileSize(download.size)}\n   Date: ${download.date.toLocaleDateString()}\n\n`;
        });

        await sock.sendMessage(sender, { text: message });
    } catch (error) {
        await sock.sendMessage(sender, { text: `❌ Error: ${error.message}` });
    }
}

async function handleDownloadRequest(sock, message, text, phoneNumber) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    
    if (urls && urls.length > 0) {
        const url = urls[0];
        if (downloadManager.isUrlSupported(url)) {
            await sock.sendMessage(message.key.remoteJid, {
                text: `🌐 URL detected! Use: .download ${url}`
            });
        }
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
            await ensureDirectories();
            const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`✅ Using WA v${version.join('.')}, isLatest: ${isLatest}`);

            // Use a very simple logger to avoid object display issues
            sock = makeWASocket({
                version,
                logger: {
                    level: 'silent', // Minimal logging
                    trace: () => {},
                    debug: () => {},
                    info: () => {},
                    warn: () => {},
                    error: (msg) => console.error('❌', msg),
                    child: () => ({ 
                        trace: () => {}, debug: () => {}, info: () => {}, 
                        warn: () => {}, error: (msg) => console.error('❌', msg) 
                    })
                },
                printQRInTerminal: false,
                auth: state,
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
            });

            sock.ev.on('creds.update', saveCreds);
            sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
            sock.ev.on('messages.upsert', async (m) => {
                if (m.type === 'notify') {
                    for (const msg of m.messages) {
                        await processMessage(sock, msg);
                    }
                }
            });

        } catch (error) {
            console.error('❌ Connection setup error:', error);
            this.handleConnectionError(error);
        }
    }

    handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        // FIXED: QR code display - this will now show properly
        if (qr) {
            this.qrDisplayCount++;
            console.log('\n'.repeat(5)); // Add space before QR
            displayQRCode(qr, this.qrDisplayCount);
        }

        if (connection === 'open') {
            this.handleSuccessfulConnection();
        } else if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                this.handleReconnection();
            } else {
                console.log('❌ Connection closed. You are logged out.');
                this.clearAuthAndRestart();
            }
        }
    }

    handleSuccessfulConnection() {
        isConnected = true;
        reconnectAttempts = 0;
        console.log('✅ WhatsApp connected successfully!');
        
        setTimeout(() => {
            if (!groupManager.isRunning) {
                groupManager.start();
            }
        }, 3000);
    }

    handleReconnection() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log('❌ Max reconnection attempts reached');
            this.clearAuthAndRestart();
            return;
        }
        reconnectAttempts++;
        console.log(`🔄 Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(() => this.connect(), RECONNECT_INTERVAL);
    }

    handleConnectionError(error) {
        console.error('❌ Connection error:', error);
        isConnected = false;
        this.isConnecting = false;
        this.handleReconnection();
    }

    clearAuthAndRestart() {
        console.log('🔄 Clearing auth and restarting...');
        if (fs.existsSync('auth_info_baileys')) {
            fs.rmSync('auth_info_baileys', { recursive: true, force: true });
        }
        setTimeout(() => {
            this.isConnecting = false;
            this.connect();
        }, 5000);
    }
}

// Initialize
const connectionManager = new ConnectionManager();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connected: isConnected,
        group_manager: groupManager.isRunning ? 'running' : 'stopped',
        active_users: userActivations.size,
        timestamp: new Date().toISOString()
    });
});

// Group manager endpoints
app.post('/gm/restart', (req, res) => {
    groupManager.restart();
    res.json({ status: 'restarting' });
});

app.get('/gm/status', (req, res) => {
    res.json({ status: groupManager.isRunning ? 'running' : 'stopped' });
});

// FIXED: Bind to 0.0.0.0 instead of localhost for Render
async function start() {
    try {
        await ensureDirectories();
        cleanupTempFiles();

        console.log('🤖 Starting WhatsApp Bot...');
        console.log('🔑 Activation Key:', ACTIVATION_KEY);
        console.log('📱 Waiting for QR code...');

        // Start connection first
        await connectionManager.connect();

        // Then start server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 Server running on port ${PORT} (0.0.0.0)`);
            console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
        });

        setInterval(cleanupTempFiles, 3600000);

    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Start bot
start();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    groupManager.stop();
    if (sock) await sock.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM...');
    groupManager.stop();
    if (sock) await sock.end();
    process.exit(0);
});

// Auto-restart group manager
setInterval(() => {
    if (isConnected && !groupManager.isRunning) {
        console.log('🔄 Auto-restarting Group Manager...');
        groupManager.start();
    }
}, 30000);