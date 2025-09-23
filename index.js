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
                // Attempt to restart if it wasn't a clean shutdown
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

// State
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 50000;
const MAX_PAIRING_ATTEMPTS = 3;
let pairingAttemptCount = 0;
let pairingMode = true;
let currentWhatsAppPairingCode = null;
let pairingCodeTimestamp = null;
const activePairingCodes = new Map();
const PAIRING_CODE_EXPIRY = 10 * 60 * 1000;

// Message storage
const yourMessages = {
    received: [],
    sent: [],
    groups: new Map(),
    contacts: new Map()
};

// Initialize Group Manager
const groupManager = new GroupManager();

// Logger
const createSimpleLogger = () => ({
    trace: console.log,
    debug: console.log,
    info: console.log,
    warn: console.warn,
    error: console.error,
    fatal: console.error,
    child: () => createSimpleLogger()
});

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

function cleanupExpiredPairingCodes() {
    const now = Date.now();
    for (const [code, data] of activePairingCodes.entries()) {
        if (now - data.timestamp > PAIRING_CODE_EXPIRY) {
            activePairingCodes.delete(code);
        }
    }
    if (currentWhatsAppPairingCode && now - pairingCodeTimestamp > PAIRING_CODE_EXPIRY) {
        currentWhatsAppPairingCode = null;
        pairingCodeTimestamp = null;
    }
}

function displayWhatsAppPairingCode(code, attempt) {
    currentWhatsAppPairingCode = code;
    pairingCodeTimestamp = Date.now();
    activePairingCodes.set(code, {
        phone: 'whatsapp_generated',
        timestamp: pairingCodeTimestamp,
        isRealWhatsAppCode: true,
        attempt
    });

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                   WHATSAPP PAIRING CODE                  ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║ 🔐 Attempt: ${attempt}/${MAX_PAIRING_ATTEMPTS} | Code: ${code}                ║`);
    console.log(`║ 📱 Your Number: ${YOUR_PERSONAL_NUMBER}                   ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');
}

function displayQRCode(qr, count) {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                   WHATSAPP QR CODE                       ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║ 📱 Scan this QR code with WhatsApp -> Linked Devices     ║`);
    console.log(`║ 🔄 Scan Count: ${count}                                    ║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    
    // Generate proper WhatsApp-compatible QR code
    qrcode.generate(qr, { 
        small: true,
        scale: 2
    });
    
    console.log('║                                                          ║');
    console.log('║ 💡 Tip: Open WhatsApp > Settings > Linked Devices > Link ║');
    console.log('║      a Device > Scan QR Code                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
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

// Message processing
async function processMessage(sock, message) {
    if (!message.message) return;
    storePersonalMessage(message);

    const sender = message.key.remoteJid;
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
    if (!commandMatch) return;

    const command = commandMatch[1].toLowerCase();
    const args = commandMatch[2] ? commandMatch[2].split(' ') : [];

    switch (command) {
        case 'status':
            await sock.sendMessage(sender, {
                text: `🤖 Bot Status:\n• Connected: ${isConnected ? '✅' : '❌'}\n• Mode: ${pairingMode ? 'Pairing' : 'QR'}\n• Attempts: ${pairingAttemptCount}/${MAX_PAIRING_ATTEMPTS}\n• Group Manager: ${groupManager.isRunning ? '✅ Running' : '❌ Stopped'}`
            });
            break;
            
        case 'mystats':
            if (sender === YOUR_PERSONAL_JID) {
                await sock.sendMessage(sender, {
                    text: `📊 Your Stats:\n📥 Received: ${yourMessages.received.length}\n📤 Sent: ${yourMessages.sent.length}\n👥 Contacts: ${yourMessages.contacts.size}\n📱 GM Status: ${groupManager.isRunning ? 'Running' : 'Stopped'}`
                });
            }
            break;
            
        case 'gmrestart':
            if (CONSTANT_ADMINS.includes(sender)) {
                await sock.sendMessage(sender, { text: '🔄 Restarting Group Manager...' });
                groupManager.restart();
            }
            break;
            
        case 'gmstatus':
            if (CONSTANT_ADMINS.includes(sender)) {
                await sock.sendMessage(sender, {
                    text: `📱 Group Manager Status: ${groupManager.isRunning ? '✅ Running' : '❌ Stopped'}`
                });
            }
            break;
            
        case 'startgm':
            if (CONSTANT_ADMINS.includes(sender)) {
                if (!groupManager.isRunning) {
                    groupManager.start();
                    await sock.sendMessage(sender, { text: '🚀 Starting Group Manager...' });
                } else {
                    await sock.sendMessage(sender, { text: '⚠️ Group Manager is already running' });
                }
            }
            break;
            
        case 'stopgm':
            if (CONSTANT_ADMINS.includes(sender)) {
                if (groupManager.isRunning) {
                    groupManager.stop();
                    await sock.sendMessage(sender, { text: '🛑 Stopping Group Manager...' });
                } else {
                    await sock.sendMessage(sender, { text: '⚠️ Group Manager is already stopped' });
                }
            }
            break;
            
        default:
            await sock.sendMessage(sender, { text: "❌ Unknown command" });
    }
}

// Connection Manager class
class ConnectionManager {
    constructor() {
        this.isConnecting = false;
        this.pairingCodeDisplayed = false;
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

            sock = makeWASocket({
                version,
                logger: createSimpleLogger(),
                printQRInTerminal: false, // We'll handle QR display ourselves
                auth: state,
                browser: Browsers.ubuntu('Chrome'),
                generateHighQualityLinkPreview: true,
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
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        if (qr) {
            this.qrDisplayCount++;
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
        
        // Start Group Manager after successful connection
        console.log('🚀 Starting Group Manager after successful WhatsApp connection...');
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
        console.log(`🔄 Attempting reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(() => this.connect(), RECONNECT_INTERVAL);
    }

    handleConnectionError(error) {
        console.error('❌ Connection error:', error);
        isConnected = false;
        this.handleReconnection();
    }

    clearAuthAndRestart() {
        if (fs.existsSync('auth_info_baileys')) {
            fs.rmSync('auth_info_baileys', { recursive: true, force: true });
        }
        setTimeout(() => this.connect(), 5000);
    }
}

// Initialize
const connectionManager = new ConnectionManager();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health endpoint with group manager status
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connected: isConnected,
        group_manager: groupManager.isRunning ? 'running' : 'stopped',
        whatsapp_status: isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Group manager control endpoints
app.post('/gm/restart', (req, res) => {
    groupManager.restart();
    res.json({ status: 'restarting', message: 'Group manager restart initiated' });
});

app.post('/gm/start', (req, res) => {
    if (!groupManager.isRunning) {
        groupManager.start();
        res.json({ status: 'starting', message: 'Group manager starting' });
    } else {
        res.json({ status: 'already_running', message: 'Group manager is already running' });
    }
});

app.post('/gm/stop', (req, res) => {
    if (groupManager.isRunning) {
        groupManager.stop();
        res.json({ status: 'stopping', message: 'Group manager stopping' });
    } else {
        res.json({ status: 'already_stopped', message: 'Group manager is already stopped' });
    }
});

app.get('/gm/status', (req, res) => {
    res.json({ 
        status: groupManager.isRunning ? 'running' : 'stopped',
        timestamp: new Date().toISOString()
    });
});

async function start() {
    try {
        await ensureDirectories();
        cleanupTempFiles();
        
        console.log('🤖 Starting WhatsApp Bot and Group Manager...');
        
        // Start the connection manager
        await connectionManager.connect();
        
        // Start Express server
        app.listen(PORT, () => {
            console.log(`🌐 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`📱 Group Manager API: http://localhost:${PORT}/gm/status`);
        });

        // Setup cleanup intervals
        setInterval(cleanupExpiredPairingCodes, 60000);
        setInterval(cleanupTempFiles, 3600000);
        
        console.log('✅ Bot initialization complete. Waiting for WhatsApp connection...');
        
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
    
    if (sock) {
        await sock.end();
    }
    
    setTimeout(() => {
        console.log('✅ Shutdown complete');
        process.exit(0);
    }, 2000);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down...');
    groupManager.stop();
    
    if (sock) {
        await sock.end();
    }
    
    process.exit(0);
});

// Auto-restart group manager if it crashes (only when WhatsApp is connected)
setInterval(() => {
    if (isConnected && !groupManager.isRunning) {
        console.log('🔄 Auto-restarting Group Manager...');
        groupManager.start();
    }
}, 30000);