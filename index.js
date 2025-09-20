const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const ytdl = require('ytdl-core');
const cheerio = require('cheerio');
const { Instagram } = require('instagram-web-api'); // You'll need to install this

class GroupManager {
    constructor() {
        this.groupsFile = path.join(__dirname, 'data', 'groups.json');
        this.schedulesFile = path.join(__dirname, 'data', 'schedules.json');
        this.groupLinksFile = path.join(__dirname, 'data', 'group_links.json');
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.autoJoinEnabled = true;
        this.adminNumber = '263717457592@s.whatsapp.net';
    }

    // Add command handlers for group management
    async handleGroupCommand(sock, message, command, args, sender) {
        // Only allow admin to use group commands
        if (sender !== this.adminNumber) {
            await sock.sendMessage(message.key.remoteJid, { 
                text: "❌ Only the admin can use group management commands." 
            });
            return;
        }

        switch (command) {
            case 'creategroup':
                await this.createGroup(sock, message, args);
                break;
            case 'addtogroup':
                await this.addToGroup(sock, message, args);
                break;
            case 'removefromgroup':
                await this.removeFromGroup(sock, message, args);
                break;
            case 'grouplink':
                await this.getGroupLink(sock, message, args);
                break;
            case 'listgroups':
                await this.listGroups(sock, message);
                break;
            case 'autojointoggle':
                await this.toggleAutoJoin(sock, message);
                break;
            default:
                await sock.sendMessage(message.key.remoteJid, { 
                    text: "❌ Unknown group command. Available commands: creategroup, addtogroup, removefromgroup, grouplink, listgroups, autojointoggle" 
                });
        }
    }

    async createGroup(sock, message, args) {
        // Implementation for creating a group
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Group creation feature will be implemented here." 
        });
    }

    async addToGroup(sock, message, args) {
        // Implementation for adding to group
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Add to group feature will be implemented here." 
        });
    }

    async removeFromGroup(sock, message, args) {
        // Implementation for removing from group
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Remove from group feature will be implemented here." 
        });
    }

    async getGroupLink(sock, message, args) {
        // Implementation for getting group link
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Get group link feature will be implemented here." 
        });
    }

    async listGroups(sock, message) {
        // Implementation for listing groups
        await sock.sendMessage(message.key.remoteJid, { 
            text: "List groups feature will be implemented here." 
        });
    }

    async toggleAutoJoin(sock, message) {
        this.autoJoinEnabled = !this.autoJoinEnabled;
        await sock.sendMessage(message.key.remoteJid, { 
            text: `Auto-join feature ${this.autoJoinEnabled ? 'enabled' : 'disabled'}.` 
        });
    }
}

module.exports = GroupManager;

// Global definitions
globalThis.File = class File {};
globalThis.crypto = require('crypto').webcrypto;

// Your existing imports
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { exec } = require('child_process');
const os = require('os');
const express = require('express'); // Added for Render

// Import database models - FIXED IMPORT
const { initializeDatabase, models } = require('./models');

// Import managers
const UserManager = require('./user-manager');
const ActivationManager = require('./activation-manager');
const GroupManager = require('./group-manager');
const AdminCommands = require('./admin-commands');
const GeneralCommands = require('./general-commands');
const DownloadManager = require('./download-manager');
const SubscriptionManager = require('./subscription-manager');
const PaymentHandler = require('./payment-handler');
const DatingManager = require('./dating-manager');
const { Boom } = require('@hapi/boom');

// Store for connection
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 50000; // Increased to 50 seconds

// Phone number for pairing - MADE MORE VISIBLE
const PHONE_NUMBER = '07775156210';

// Command number
const COMMAND_NUMBER = '263717457592@s.whatsapp.net';

// Activation codes
const ACTIVATION_CODES = {
    ADMIN: 'Pretty911',      // For admin commands (admin-commands.js)
    GROUP_MANAGER: 'Abner911', // For group management (group-manager.js)
    GENERAL: 'Abby123'       // For general commands (general-commands.js)
};

// Actual parishes data
const PARISHES = [
    "St. Mary's Cathedral",
    "St. Theresa's Parish",
    "St. Peter's Parish",
    "Holy Family Parish",
    "Sacred Heart Parish",
    "Our Lady of Lourdes",
    "St. Joseph's Parish",
    "Christ the King Parish",
    "St. Francis of Assisi",
    "St. Anthony's Parish",
    "Immaculate Conception",
    "St. Michael's Parish",
    "St. John the Baptist",
    "St. Paul's Parish",
    "St. Mark's Parish",
    "St. Luke's Parish",
    "Our Lady of Fatima",
    "St. Anne's Parish",
    "St. Patrick's Parish",
    "Divine Mercy Parish"
];

// Initialize managers
const userManager = new UserManager();
const activationManager = new ActivationManager();
const groupManager = new GroupManager();
const adminCommands = new AdminCommands();
const generalCommands = new GeneralCommands();
const downloadManager = new DownloadManager();
const subscriptionManager = new SubscriptionManager();
const paymentHandler = new PaymentHandler();
const datingManager = new DatingManager();

// ==================== SESSION PERSISTENCE FOR DOCKER ====================
// Automatic session backup to temporary storage (survives container restarts)
function setupSessionBackup() {
    setInterval(() => {
        try {
            const authDir = path.join(__dirname, 'auth_info_baileys');
            const backupDir = '/tmp/auth_backup';
            // Implementation would go here
        } catch (error) {
            console.error('Error in session backup:', error);
        }
    }, 60000); // Backup every minute
}

// Restore session if available from temporary storage
function restoreSessionIfAvailable() {
    try {
        const authDir = path.join(__dirname, 'auth_info_baileys');
        const backupDir = '/tmp/auth_backup';
        // Implementation would go here
        return false;
    } catch (error) {
        console.error('Error restoring session:', error);
        return false;
    }
}

// ==================== END SESSION PERSISTENCE ====================

// Function to validate and clean auth state
async function validateAuthState(state) {
    try {
        // Check if credentials exist and are valid
        if (!state.creds || !state.creds.noiseKey || !state.creds.signedIdentityKey) {
            console.log('🔄 Invalid auth state detected, clearing...');
            await clearAuthFiles();
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error validating auth state:', error);
        return false;
    }
}

// Helper function for debugging
function echo(message) {
    console.log(`[DEBUG] ${message}`);
}

// Ensure data directories exist
async function ensureDirectories() {
    try {
        if (!fs.existsSync(path.join(__dirname, 'data'))) {
            fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
        }
        if (!fs.existsSync(path.join(__dirname, 'auth_info_baileys'))) {
            fs.mkdirSync(path.join(__dirname, 'auth_info_baileys'), { recursive: true });
        }
        console.log('✅ Data directories created successfully');
    } catch (error) {
        console.error('❌ Error creating directories:', error);
    }
}

// Check if auth files exist
async function checkAuthFiles() {
    try {
        const authDir = path.join(__dirname, 'auth_info_baileys');
        if (!fs.existsSync(authDir)) {
            console.log('❌ Auth directory not found');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking auth files:', error);
        return false;
    }
}

// Clear invalid auth files
async function clearAuthFiles() {
    try {
        const authDir = path.join(__dirname, 'auth_info_baileys');
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log('✅ Cleared invalid auth files');
        }
        fs.mkdirSync(authDir, { recursive: true });
        return true;
    } catch (error) {
        console.log('No auth files to clear or error clearing:', error.message);
        return false;
    }
}

// Connection manager to handle reconnections
class ConnectionManager {
    constructor() {
        this.isConnecting = false;
        this.reconnectTimeout = null;
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (sock) {
            sock.end();
            sock = null;
        }
        isConnected = false;
    }
}

const connectionManager = new ConnectionManager();

// Encryption error handler
async function handleEncryptionError(remoteJid, participant) {
    try {
        if (participant && sock.authState.creds.sessions.get(participant)) {
            sock.authState.creds.sessions.delete(participant);
            console.log(`Cleared session for ${participant}`);
        }
    } catch (error) {
        console.error('Error handling encryption error:', error);
    }
}

// Auth state backup function
function setupAuthStateBackup(authState) {
    // Backup every hour
    setInterval(() => {
        try {
            const backup = JSON.stringify(authState.creds);
            fs.writeFileSync('./auth-backup.json', backup);
            console.log('Auth state backed up');
        } catch (backupError) {
            console.error('Failed to backup auth state:', backupError);
        }
    }, 60 * 60 * 1000);
}

// Simple logger implementation that Baileys expects
const createSimpleLogger = () => {
    return {
        trace: (message, ...args) => console.log(`[TRACE] ${message}`, ...args),
        debug: (message, ...args) => console.log(`[DEBUG] ${message}`, ...args),
        info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
        warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
        error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
        fatal: (message, ...args) => console.error(`[FATAL] ${message}`, ...args),
        // Add child method that returns the same logger
        child: () => createSimpleLogger()
    };
};

// Function to display pairing information with highlighting
function displayPairingInfo(qr, pairingCode) {
    console.log('\n'.repeat(5)); // Add some space
    console.log('═'.repeat(60));
    console.log('🤖 WHATSAPP BOT PAIRING INFORMATION');
    console.log('═'.repeat(60));
    // Implementation would go here
}

// Add this function to initialize the application
async function startApp() {
    try {
        // Initialize database first
        console.log('🔄 Initializing database...');
        const dbModels = await initializeDatabase();
        await startBot(dbModels);
    } catch (error) {
        console.error('❌ Failed to start application:', error);
        process.exit(1);
    }
}

// Function to handle activation codes
async function handleActivationCode(sock, sender, phoneNumber, username, code) {
    let role = '';
    let message = '';
    // Implementation would go here
    return { role, message };
}

// Function to check if user is activated
async function checkUserActivation(phoneNumber) {
    try {
        const user = await models.User.findOne({ where: { phoneNumber } });
        return user && user.isActive;
    } catch (error) {
        console.error('❌ Error checking user activation:', error);
        return false;
    }
}

// Function to get user role
async function getUserRole(phoneNumber) {
    try {
        const user = await models.User.findOne({ where: { phoneNumber } });
        return user ? user.role : null;
    } catch (error) {
        console.error('❌ Error getting user role:', error);
        return null;
    }
}

// Function to process incoming messages
async function processMessage(sock, message) {
    try {
        if (!message.message) return;
        
        const sender = message.key.remoteJid;
        const messageType = Object.keys(message.message)[0];
        let text = '';
        
        if (messageType === 'conversation') {
            text = message.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            text = message.message.extendedTextMessage.text;
        }
        
        // Ignore messages from broadcast lists and status
        if (sender.endsWith('@broadcast') || sender === 'status@broadcast') {
            return;
        }
        
        // Only process messages from admin
        if (sender !== COMMAND_NUMBER) {
            console.log(`Ignoring message from ${sender}: ${text}`);
            return;
        }
        
        console.log(`Processing command from admin: ${text}`);
        
        // Parse command
        const commandMatch = text.match(/^\.(\w+)(?:\s+(.*))?$/);
        if (!commandMatch) return;
        
        const command = commandMatch[1].toLowerCase();
        const args = commandMatch[2] ? commandMatch[2].split(' ') : [];
        
        // Route to appropriate command handler
        switch (command) {
            case 'activate':
                await activationManager.handleActivation(sock, message, args, sender);
                break;
            case 'userinfo':
                await userManager.getUserInfo(sock, message, args);
                break;
            case 'ban':
                await userManager.banUser(sock, message, args);
                break;
            case 'unban':
                await userManager.unbanUser(sock, message, args);
                break;
            case 'creategroup':
            case 'addtogroup':
            case 'removefromgroup':
            case 'grouplink':
            case 'listgroups':
            case 'autojointoggle':
                await groupManager.handleGroupCommand(sock, message, command, args, sender);
                break;
            case 'broadcast':
                await adminCommands.broadcastMessage(sock, message, args);
                break;
            case 'stats':
                await adminCommands.getStats(sock, message);
                break;
            case 'restart':
                await adminCommands.restartBot(sock, message);
                break;
            case 'download':
                await downloadManager.handleDownload(sock, message, args);
                break;
            case 'subscribe':
                await subscriptionManager.handleSubscription(sock, message, args);
                break;
            case 'payment':
                await paymentHandler.handlePayment(sock, message, args);
                break;
            case 'dating':
                await datingManager.handleDatingCommand(sock, message, args);
                break;
            case 'help':
                await generalCommands.showHelp(sock, message);
                break;
            default:
                await sock.sendMessage(sender, { 
                    text: "❌ Unknown command. Type .help for available commands." 
                });
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
}

async function startBot(dbModels) {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        await ensureDirectories();
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        // Validate auth state
        const isValidAuth = await validateAuthState(state);
        if (!isValidAuth) {
            console.log('🔄 Setting up new authentication...');
        }
        
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            logger: createSimpleLogger(),
            printQRInTerminal: true,
            auth: state,
            browser: Browsers.ubuntu('Chrome'),
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 0,
        });
        
        // Setup event handlers
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin, pairingCode } = update;
            
            if (qr) {
                displayPairingInfo(qr, pairingCode);
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log(`Connection closed due to ${lastDisconnect.error} | reconnecting ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        reconnectAttempts++;
                        console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
                        setTimeout(() => startBot(dbModels), RECONNECT_INTERVAL);
                    } else {
                        console.log('Max reconnection attempts reached. Please restart the bot.');
                    }
                } else {
                    console.log('Connection closed permanently. Please re-pair the device.');
                    await clearAuthFiles();
                }
                isConnected = false;
            } else if (connection === 'open') {
                console.log('✅ Connected to WhatsApp');
                isConnected = true;
                reconnectAttempts = 0;
                
                // Send connection success message to admin
                if (sock && COMMAND_NUMBER) {
                    await sock.sendMessage(COMMAND_NUMBER, { 
                        text: '🤖 Bot is now connected and ready to receive commands!' 
                    });
                }
            }
        });
        
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                for (const message of m.messages) {
                    await processMessage(sock, message);
                }
            }
        });
        
        // Setup auth state backup
        setupAuthStateBackup(state);
        
    } catch (error) {
        console.error('❌ Error starting bot:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Restarting bot... Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(() => startBot(dbModels), RECONNECT_INTERVAL);
        } else {
            console.log('Max restart attempts reached. Please check your configuration.');
        }
    }
}

// ==================== RENDER WEB SERVER SETUP ====================
// This is required for Render to health-check your application
const app = express();
const port = process.env.PORT || 4000;

// Basic health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'WhatsApp Bot is running', 
        connected: isConnected, 
        timestamp: new Date().toISOString() 
    });
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    if (isConnected) {
        res.json({ status: 'OK', connected: true });
    } else {
        res.status(503).json({ status: 'OFFLINE', connected: false });
    }
});

// Bot status endpoint
app.get('/status', (req, res) => {
    res.json({ 
        status: isConnected ? 'CONNECTED' : 'DISCONNECTED', 
        reconnectAttempts: reconnectAttempts, 
        uptime: process.uptime(), 
        memory: { 
            usage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + 'MB', 
            total: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2) + 'MB' 
        } 
    });
});

// Start the HTTP server
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 HTTP server listening on port ${port}`);
    console.log(`🌐 Health check available at http://0.0.0.0:${port}/health`);
    // Start the bot after the server is running
    startApp();
});

// Process handlers
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    connectionManager.disconnect();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { startBot, connectionManager, app };