globalThis.File = class File {};
globalThis.crypto = require('crypto').webcrypto;

// Your existing imports
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
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

// ==================== SESSION PERSISTENCE FOR DOCKER ====================
// Automatic session backup to temporary storage (survives container restarts)
function setupSessionBackup() {
    setInterval(() => {
        try {
            const authDir = path.join(__dirname, 'auth_info_baileys');
            const backupDir = '/tmp/auth_backup';
            
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            if (fs.existsSync(authDir)) {
                // Copy auth files to backup directory
                const files = fs.readdirSync(authDir);
                files.forEach(file => {
                    const sourcePath = path.join(authDir, file);
                    const destPath = path.join(backupDir, file);
                    fs.copyFileSync(sourcePath, destPath);
                });
                console.log('✅ Session backed up to temporary storage');
            }
        } catch (error) {
            console.error('❌ Error backing up session:', error);
        }
    }, 300000); // Backup every 5 minutes
}

// Restore session if available from temporary storage
function restoreSessionIfAvailable() {
    try {
        const authDir = path.join(__dirname, 'auth_info_baileys');
        const backupDir = '/tmp/auth_backup';
        
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }
        
        if (fs.existsSync(backupDir)) {
            // Copy backup files to auth directory
            const files = fs.readdirSync(backupDir);
            files.forEach(file => {
                const sourcePath = path.join(backupDir, file);
                const destPath = path.join(authDir, file);
                fs.copyFileSync(sourcePath, destPath);
            });
            console.log('✅ Session restored from backup');
            return true;
        }
    } catch (error) {
        console.error('❌ Error restoring session:', error);
    }
    return false;
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
        console.error('❌ Error validating auth state:', error);
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
        
        const files = fs.readdirSync(authDir);
        return files.length > 0;
    } catch (error) {
        console.error('❌ Error checking auth files:', error);
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
    
    async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;
        
        try {
            await startBot();
        } catch (error) {
            console.error('❌ Connection error:', error);
            this.scheduleReconnect();
        } finally {
            this.isConnecting = false;
        }
    }
    
    scheduleReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log('❌ Max reconnection attempts reached');
            return;
        }
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        
        reconnectAttempts++;
        const delay = RECONNECT_INTERVAL * Math.min(reconnectAttempts, 5);
        console.log(`⏳ Scheduling reconnect attempt ${reconnectAttempts} in ${delay/1000} seconds`);
        
        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, delay);
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
        
        if (remoteJid && sock.authState.creds.sessions.get(remoteJid)) {
            sock.authState.creds.sessions.delete(remoteJid);
            console.log(`Cleared session for ${remoteJid}`);
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
    
    if (qr) {
        console.log('\n📲 Scan this QR code with WhatsApp:');
        qrcode.generate(qr, { small: true });
    }
    
    if (pairingCode) {
        console.log(`\n🔢 Or use pairing code: ${pairingCode}`);
    }
    
    console.log(`\n📞 Phone number: ${PHONE_NUMBER}`);
    console.log('═'.repeat(60));
    console.log('💡 Tip: Open WhatsApp > Linked Devices > Link a Device');
    console.log('═'.repeat(60));
}

// Add this function to initialize the application
async function startApp() {
    try {
        // Initialize database first
        console.log('🔄 Initializing database...');
        const dbModels = await initializeDatabase();
        
        // Ensure directories exist
        await ensureDirectories();
        
        // Restore session if available
        restoreSessionIfAvailable();
        
        // Setup session backup
        setupSessionBackup();
        
        // Start the bot
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
    
    if (code === ACTIVATION_CODES.ADMIN) {
        role = 'admin';
        message = '🎉 Congratulations! You are now an admin. You have access to all commands.';
    } else if (code === ACTIVATION_CODES.GROUP_MANAGER) {
        role = 'group_manager';
        message = '🎉 Congratulations! You are now a group manager. You can manage groups.';
    } else if (code === ACTIVATION_CODES.GENERAL) {
        role = 'user';
        message = '🎉 Congratulations! Your account has been activated. You can now use basic commands.';
    } else {
        message = '❌ Invalid activation code. Please check and try again.';
        await sock.sendMessage(sender, { text: message });
        return;
    }
    
    // Save user to database
    try {
        // Check if user already exists
        const existingUser = await models.User.findOne({ where: { phoneNumber } });
        
        if (existingUser) {
            // Update existing user
            await models.User.update(
                { role, isActive: true, activatedAt: new Date() },
                { where: { phoneNumber } }
            );
            message += '\n📝 Your account has been updated with new permissions.';
        } else {
            // Create new user
            await models.User.create({
                phoneNumber,
                username,
                role,
                isActive: true,
                activatedAt: new Date()
            });
        }
        
        await sock.sendMessage(sender, { text: message });
        console.log(`✅ Activated user ${phoneNumber} with role ${role}`);
    } catch (error) {
        console.error('❌ Error activating user:', error);
        await sock.sendMessage(sender, { text: '❌ Error activating your account. Please try again later.' });
    }
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

async function startBot(dbModels) {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        
        // Check if auth files exist
        const hasAuthFiles = await checkAuthFiles();
        
        // Use multi-file auth state
        const { state, saveCreds } = await useMultiFileAuthState(
            path.join(__dirname, 'auth_info_baileys')
        );
        
        // Validate auth state
        const isValidAuth = await validateAuthState(state);
        if (!isValidAuth && hasAuthFiles) {
            console.log('🔄 Clearing invalid auth state...');
            await clearAuthFiles();
            return connectionManager.scheduleReconnect();
        }
        
        // Fetch the latest version of Baileys
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📦 Using WA v${version.join('.')}, isLatest: ${isLatest}`);
        
        // Create socket connection
        sock = makeWASocket({
            version,
            logger: createSimpleLogger(),
            printQRInTerminal: true,
            auth: state,
            browser: Browsers.ubuntu('Chrome'),
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            defaultQueryTimeoutMs: 60_000,
        });
        
        // Setup auth state backup
        setupAuthStateBackup(state);
        
        // Listen for credentials updates
        sock.ev.on('creds.update', saveCreds);
        
        // Listen for connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;
            
            if (qr) {
                // Display QR code for pairing
                displayPairingInfo(qr);
            }
            
            if (connection === 'close') {
                isConnected = false;
                const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
                
                console.log(`🔌 Connection closed due to ${lastDisconnect.error} | Reconnecting: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    connectionManager.scheduleReconnect();
                } else {
                    console.log('❌ Logged out, please scan the QR code again.');
                    clearAuthFiles().then(() => {
                        connectionManager.scheduleReconnect();
                    });
                }
            } else if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                console.log('✅ Connected to WhatsApp');
                
                // Send connection success message to admin
                const adminJid = `${PHONE_NUMBER}@s.whatsapp.net`;
                sock.sendMessage(adminJid, { 
                    text: '🤖 Bot is now connected and ready to receive commands!' 
                }).catch(console.error);
            }
        });
        
        // Listen for messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            
            const message = messages[0];
            if (!message.message) return;
            
            const messageType = Object.keys(message.message)[0];
            if (messageType !== 'conversation' && messageType !== 'extendedTextMessage') return;
            
            const text = messageType === 'conversation' 
                ? message.message.conversation 
                : message.message.extendedTextMessage.text;
            
            const sender = message.key.remoteJid;
            const isGroup = sender.endsWith('@g.us');
            const user = sender.split('@')[0];
            
            console.log(`📩 Received message from ${user}: ${text}`);
            
            try {
                // Handle activation codes
                if (text.startsWith('!activate')) {
                    const parts = text.split(' ');
                    if (parts.length >= 3) {
                        const code = parts[1];
                        const username = parts.slice(2).join(' ');
                        await handleActivationCode(sock, sender, user, username, code);
                    } else {
                        await sock.sendMessage(sender, { 
                            text: '❌ Invalid format. Use: !activate <code> <username>' 
                        });
                    }
                    return;
                }
                
                // Check if user is activated before processing other commands
                const isActivated = await checkUserActivation(user);
                if (!isActivated && !text.startsWith('!activate')) {
                    await sock.sendMessage(sender, { 
                        text: '❌ You need to activate your account first. Use: !activate <code> <username>' 
                    });
                    return;
                }
                
                // Handle parish requests
                if (text.toLowerCase().includes('parish') || text.toLowerCase().includes('parishes')) {
                    let response = "🏛️ Available Parishes:\n\n";
                    PARISHES.forEach((parish, index) => {
                        response += `${index + 1}. ${parish}\n`;
                    });
                    response += "\nReply with the number of your parish to select it.";
                    
                    await sock.sendMessage(sender, { text: response });
                    return;
                }
                
                // Handle parish selection by number
                if (/^\d+$/.test(text.trim())) {
                    const index = parseInt(text.trim()) - 1;
                    if (index >= 0 && index < PARISHES.length) {
                        await sock.sendMessage(sender, { 
                            text: `✅ You have selected: ${PARISHES[index]}\n\nWe will connect you with this parish shortly.` 
                        });
                    } else {
                        await sock.sendMessage(sender, { 
                            text: '❌ Invalid selection. Please choose a number from the list.' 
                        });
                    }
                    return;
                }
                
                // Handle other commands based on user role
                const userRole = await getUserRole(user);
                
                if (text.startsWith('!admin')) {
                    if (userRole === 'admin') {
                        // Handle admin commands
                        await AdminCommands.handle(sock, sender, text, user);
                    } else {
                        await sock.sendMessage(sender, { 
                            text: '❌ You do not have permission to use admin commands.' 
                        });
                    }
                    return;
                }
                
                if (text.startsWith('!group')) {
                    if (userRole === 'admin' || userRole === 'group_manager') {
                        // Handle group commands
                        await GroupManager.handle(sock, sender, text, user);
                    } else {
                        await sock.sendMessage(sender, { 
                            text: '❌ You do not have permission to use group commands.' 
                        });
                    }
                    return;
                }
                
                // Handle general commands
                if (text.startsWith('!')) {
                    await GeneralCommands.handle(sock, sender, text, user);
                    return;
                }
                
            } catch (error) {
                console.error('❌ Error processing message:', error);
                try {
                    await sock.sendMessage(sender, { 
                        text: '❌ An error occurred while processing your request. Please try again later.' 
                    });
                } catch (sendError) {
                    console.error('❌ Error sending error message:', sendError);
                }
            }
        });
        
        // Handle other events
        sock.ev.on('messages.update', (updates) => {
            // console.log('Messages updated:', updates);
        });
        
        sock.ev.on('message-receipt.update', (updates) => {
            // console.log('Message receipts updated:', updates);
        });
        
        sock.ev.on('presence.update', (updates) => {
            // console.log('Presence updated:', updates);
        });
        
        sock.ev.on('chats.update', (updates) => {
            // console.log('Chats updated:', updates);
        });
        
        sock.ev.on('contacts.update', (updates) => {
            // console.log('Contacts updated:', updates);
        });
        
        // Handle encryption errors
        sock.ev.on('connection.update', (update) => {
            if (update.receivedPendingNotifications) {
                console.log('Received pending notifications');
            }
        });
        
    } catch (error) {
        console.error('❌ Error starting bot:', error);
        connectionManager.scheduleReconnect();
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
    
    // Start the WhatsApp bot after the HTTP server is running
    console.log('🤖 Starting WhatsApp bot...');
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