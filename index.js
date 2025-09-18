// ADD THESE TWO LINES AT THE VERY TOP
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
const PHONE_NUMBER = '0775156210';

// Command number
const COMMAND_NUMBER = '263717457592@s.whatsapp.net';

// Activation codes
const ACTIVATION_CODES = {
    ADMIN: 'Pretty911',      // For admin commands (admin-commands.js)
    GROUP_MANAGER: 'Abner911', // For group management (group-manager.js)  
    GENERAL: 'Abby123'       // For general commands (general-commands.js)
};

// ==================== SESSION PERSISTENCE FOR DOCKER ====================
// Automatic session backup to temporary storage (survives container restarts)
function setupSessionBackup() {
    setInterval(() => {
        try {
            const authDir = path.join(__dirname, 'auth_info_baileys');
            const backupDir = '/tmp/auth_backup';

            if (fs.existsSync(authDir)) {
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }

                // Copy auth files to temporary storage
                const files = fs.readdirSync(authDir);
                files.forEach(file => {
                    const source = path.join(authDir, file);
                    const dest = path.join(backupDir, file);
                    try {
                        fs.copyFileSync(source, dest);
                    } catch (copyError) {
                        console.log('⚠️ Could not backup file:', file, copyError.message);
                    }
                });

                console.log('✅ Auth files backed up to temporary storage');
            }
        } catch (error) {
            console.log('⚠️ Could not backup auth files:', error.message);
        }
    }, 30000); // Backup every 30 seconds
}

// Restore session if available from temporary storage
function restoreSessionIfAvailable() {
    try {
        const authDir = path.join(__dirname, 'auth_info_baileys');
        const backupDir = '/tmp/auth_backup';

        if (fs.existsSync(backupDir) && !fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });

            const files = fs.readdirSync(backupDir);
            files.forEach(file => {
                const source = path.join(backupDir, file);
                const dest = path.join(authDir, file);
                try {
                    fs.copyFileSync(source, dest);
                    console.log('✅ Restored auth file:', file);
                } catch (copyError) {
                    console.log('⚠️ Could not restore file:', file, copyError.message);
                }
            });

            console.log('✅ Auth files restored from backup');
            return true;
        }
    } catch (error) {
        console.log('⚠️ Could not restore auth files:', error.message);
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

        // Check if registration exists
        if (!state.creds.registered) {
            console.log('🔄 Not registered, will need phone pairing...');
            return false;
        }

        console.log('✅ Auth state appears valid');
        return true;
    } catch (error) {
        console.log('❌ Error validating auth state:', error.message);
        await clearAuthFiles();
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
        console.log('📁 Auth files found:', files);

        if (files.length === 0) {
            console.log('❌ No auth files found. Need to pair with phone');
            return false;
        }

        // Check if files have content
        for (const file of files) {
            const content = fs.readFileSync(path.join(authDir, file), 'utf8');
            if (!content || content.trim() === '') {
                console.log(`❌ Empty auth file: ${file}`);
                return false;
            }
        }

        return true;
    } catch (error) {
        console.log('❌ Auth directory not found. Will create new one with phone pairing');
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
        if (this.isConnecting) {
            console.log('🔄 Connection already in progress');
            return;
        }

        this.isConnecting = true;

        try {
            await startBot();
            reconnectAttempts = 0; // Reset on successful connection
        } catch (error) {
            console.error('❌ Connection failed:', error.message);
            this.handleConnectionFailure();
        } finally {
            this.isConnecting = false;
        }
    }

    handleConnectionFailure() {
        reconnectAttempts++;

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log(`❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
            console.log('🔄 Clearing auth and restarting...');
            reconnectAttempts = 0;

            clearAuthFiles().then(() => {
                setTimeout(() => this.connect(), RECONNECT_INTERVAL);
            });
            return;
        }

        const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts), 60000); // Max 60 seconds
        console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

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
        this.isConnecting = false;
    }

    async handlePairingSuccess() {
        console.log('🔄 Handling successful pairing scenario...');
        this.disconnect();

        // Wait a bit before reconnecting
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Clear auth state to force fresh connection
        try {
            await clearAuthFiles();
            console.log('✅ Cleared auth files for fresh connection');
        } catch (error) {
            console.log('⚠️ Could not clear auth files:', error.message);
        }

        // Reconnect with fresh state
        await this.connect();
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

        // Request new prekeys if it's a specific participant
        if (participant && !participant.includes('@g.us')) {
            try {
                await sock.requestNewPreKeys(participant);
                console.log(`Requested new prekeys for ${participant}`);
            } catch (preKeyError) {
                console.error('Failed to request prekeys:', preKeyError);
            }
        }
    } catch (recoveryError) {
        console.error('Failed to recover session:', recoveryError);
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

    // Restore if available
    if (fs.existsSync('./auth-backup.json')) {
        try {
            const backup = fs.readFileSync('./auth-backup.json', 'utf8');
            const creds = JSON.parse(backup);
            Object.assign(authState.creds, creds);
            console.log('Auth state restored from backup');
        } catch (e) {
            console.error('Failed to restore auth state:', e);
        }
    }
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
    
    // Display QR code if available
    if (qr) {
        console.log('\n📱 SCAN THIS QR CODE WITH YOUR PHONE:');
        console.log('─'.repeat(40));
        qrcode.generate(qr, { small: true });
        console.log('─'.repeat(40));
    }
    
    // Display pairing code with highlighting
    console.log('\n🔢 OR ENTER THIS PAIRING CODE IN WHATSAPP:');
    console.log('─'.repeat(40));
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║                                              ║');
    console.log('║           📞 ' + PHONE_NUMBER + '           ║');
    console.log('║                                              ║');
    console.log('║           🔢 ' + pairingCode + '           ║');
    console.log('║                                              ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('─'.repeat(40));
    console.log('1. Open WhatsApp on your phone');
    console.log('2. Go to Settings → Linked Devices → Link a Device');
    console.log('3. Choose "Link with phone number instead"');
    console.log('4. Enter the phone number shown above');
    console.log('5. Enter the pairing code when prompted');
    console.log('═'.repeat(60));
    console.log('\n');
}
    


// Add this function to initialize the application
async function startApp() {
    try {
        // Initialize database first
        console.log('🔄 Initializing database...');
        const dbModels = await initializeDatabase();

        // Then start the bot with the models
        console.log('🤖 Starting WhatsApp bot...');
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

    switch (code) {
        case ACTIVATION_CODES.ADMIN:
            role = 'admin';
            message = `✅ You are now an ADMIN!\n\n` +
                     `You have access to all admin commands:\n` +
                     `• Manage users\n` +
                     `• Control subscriptions\n` +
                     `• System administration\n\n` +
                     `Use !help to see available commands.`;
            break;

        case ACTIVATION_CODES.GROUP_MANAGER:
            role = 'groupManager';
            message = `✅ You are now a GROUP MANAGER!\n\n` +
                     `You can manage groups and users:\n` +
                     `• Add/remove users from groups\n` +
                     `• Manage group settings\n` +
                     `• Moderate group content\n\n` +
                     `Use !help to see available commands.`;
            break;

        case ACTIVATION_CODES.GENERAL:
            role = 'general';
            message = `✅ Account activated successfully!\n\n` +
                     `You now have access to:\n` +
                     `• Media downloads\n` +
                     `• Content search\n` +
                     `• Basic bot features\n\n` +
                     `Use !help to see available commands.`;
            break;

        default:
            return { success: false, message: '❌ Invalid activation code' };
    }

    // Save user with the assigned role
    const userManager = new UserManager();
    await userManager.saveUser(phoneNumber, username, role, true);

    return { success: true, message, role };
}

async function startBot(dbModels) {
    try {
        console.log('🚀 Starting WhatsApp Bot...');

        // Check if we can restore session from temporary storage first
        const hasRestoredSession = restoreSessionIfAvailable();
        if (hasRestoredSession) {
            console.log('✅ Session restored from backup, should not need pairing');
        }

        // Ensure directories exist
        await ensureDirectories();

        // Check if we have existing auth files
        const hasAuthFiles = await checkAuthFiles();

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        // Validate auth state before proceeding
        const isValidAuth = await validateAuthState(state);
        if (!isValidAuth) {
            console.log('🔄 Auth state invalid, will require phone pairing');
            // Clear any potentially corrupted state
            await clearAuthFiles();
            // Re-create auth state
            const { state: newState, saveCreds: newSaveCreds } = await useMultiFileAuthState('auth_info_baileys');
            Object.assign(state, newState);
            Object.assign(saveCreds, newSaveCreds);
        }

        // Get latest version for better compatibility
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📦 Using Baileys version: ${version.join('.')}, Latest: ${isLatest}`);

        // Create a simple logger that has the child method
        const logger = createSimpleLogger();

        sock = makeWASocket({
            // Enable QR code display
            printQRInTerminal: false, // We'll handle QR display ourselves
            // Also include phone number pairing as backup
            phoneNumber: PHONE_NUMBER,
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            version: version,
            markOnlineOnConnect: false,
            connectTimeoutMs: 180000, // Increased to 3 minutes
            keepAliveIntervalMs: 30000, // Increased to 30 seconds
            defaultQueryTimeoutMs: 90000, // Increased to 90 seconds
            maxRetries: 15, // Increased retries
            syncFullHistory: false,
            transactionOpts: {
                maxCommitRetries: 15, // Increased retries
                delayBetweenTriesMs: 3000 // Reduced delay
            },
            // Add these new options for better connection stability
            retryRequestDelayMs: 3000,
            maxCachedMessages: 50,
            shouldIgnoreJid: (jid) => jid?.endsWith('@g.us'), // Ignore group messages during reconnect
            fireInitQueries: true,
            registration: {
                phoneCall: false,
                codeMethod: 'none'
            },
            generateHighQualityLinkPreview: true,
            linkPreviewImageThumbnailWidth: 192,
            getMessage: async (key) => {
                return {
                    conversation: "hello"
                }
            },
            // Additional options to prevent timeout
            authTimeout: 180000, // 3 minutes for auth timeout,
            // Use our custom logger
            logger: logger
        });

        // Start session backup system
        setupSessionBackup();

        // Initialize managers
        echo('Initializing UserManager...');
        const userManager = new UserManager();

        echo('Initializing SubscriptionManager...');
        const subscriptionManager = new SubscriptionManager();

        echo('Initializing ActivationManager...');
        const activationManager = new ActivationManager(userManager);

        echo('Initializing GroupManager...');
        const groupManager = new GroupManager();

        echo('Initializing DownloadManager...');
        const downloadManager = new DownloadManager();

        echo('Initializing GeneralCommands...');
        const generalCommands = new GeneralCommands(userManager, downloadManager, subscriptionManager);

        echo('Initializing PaymentHandler...');
        const paymentHandler = new PaymentHandler(subscriptionManager, userManager);

        // Use the models from database initialization
        echo('Initializing DatingManager...');
        const datingManager = new DatingManager(userManager, subscriptionManager, dbModels || models);

        echo('Initializing AdminCommands...');
        const adminCommands = new AdminCommands(userManager, groupManager);

        // Setup auth state backup
        setupAuthStateBackup(sock.authState);

        // Connection event handler
        sock.ev.on('connection.update', async (update) => {
            // Debug output
            debugConnectionState(update);

            const { connection, qr, lastDisconnect, isNewLogin } = update;

            // Display pairing information when QR code is available
            if (qr) {
                displayPairingInfo(qr, PHONE_NUMBER);
            }

            // Specific handling for pairing success case
            if (connection === 'close' && 
                (lastDisconnect?.error?.message?.includes('pairing configured successfully') ||
                 lastDisconnect?.error?.message?.includes('expect to restart'))) {
                console.log('🔄 Detected pairing success scenario, handling restart...');
                await connectionManager.handlePairingSuccess();
                return;
            }

            if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is now ready to receive messages');

                // Send welcome message to command number
                try {
                    await sock.sendMessage(COMMAND_NUMBER, {
                        text: '🤖 Bot is now online and ready!\n\n' +
                              'Activation Codes:\n' +
                              `• Admin: ${ACTIVATION_CODES.ADMIN}\n` +
                              `• Group Manager: ${ACTIVATION_CODES.GROUP_MANAGER}\n` +
                              `• General User: ${ACTIVATION_CODES.GENERAL}`
                    });
                } catch (error) {
                    console.log('Could not send online notification to command number');
                }
            } else if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown reason';

                console.log(`🔌 Connection closed: ${errorMessage}`);
                console.log('🔍 Status code:', statusCode);

                // Log full error details for debugging
                if (lastDisconnect?.error) {
                    console.log('🔍 Full error details:', JSON.stringify(lastDisconnect.error, null, 2));
                }

                // Handle specific error types
                if (errorMessage.includes('PreKeyError') || errorMessage.includes('SenderKeyRecord')) {
                    console.log('🔑 Encryption error detected, will attempt recovery on reconnect');
                }

                // Don't clear auth for normal connection issues
                if (statusCode === DisconnectReason.loggedOut || errorMessage.includes('replaced')) {
                    console.log('🔄 Logged out from server, clearing auth files...');
                    await clearAuthFiles();
                }

                // Special handling for unexpected connection issues
                if (errorMessage.includes('unexpected') || errorMessage.includes('canceled')) {
                    console.log('🔄 Unexpected connection issue detected, waiting 10 seconds before reconnect...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }

                // Always attempt to reconnect
                connectionManager.handleConnectionFailure();
            } else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Handle connection errors
        sock.ev.on('connection.general-error', (error) => {
            console.error('❌ General connection error:', error.message);
            connectionManager.handleConnectionFailure();
        });

        // Handle authentication failures
        sock.ev.on('connection.require_update', (update) => {
            console.log('🔄 Connection requires update:', update);
        });

        // Enhanced message handler with encryption error recovery
        sock.ev.on("messages.upsert", async (m) => {
            try {
                if (!isConnected) return;

                const message = m.messages[0];
                if (!message.message || message.key.fromMe) return;

                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text ||
                            message.message.buttonsResponseMessage?.selectedDisplayText || "";

                const sender = message.key.remoteJid;
                if (!sender.endsWith('@s.whatsapp.net')) return;

                const phoneNumber = sender.split('@')[0];

                let username = "User";
                try {
                    const contact = await sock.onWhatsApp(sender);
                    username = contact[0]?.exists ? contact[0].pushname || 'User' : 'User';
                } catch (error) {
                    console.error('Error getting username:', error);
                }

                console.log(`📨 Received message from ${username} (${phoneNumber}): ${text}`);

                // Get user data
                const user = await userManager.getUser(phoneNumber);

                // Handle activation codes
                const trimmedText = text.trim();
                if ([ACTIVATION_CODES.ADMIN, ACTIVATION_CODES.GROUP_MANAGER, ACTIVATION_CODES.GENERAL].includes(trimmedText)) {
                    console.log(`🔑 Activation attempt with code: ${trimmedText}`);

                    const activationResult = await handleActivationCode(sock, sender, phoneNumber, username, trimmedText);

                    if (activationResult.success) {
                        console.log(`✅ User ${phoneNumber} activated as ${activationResult.role}`);
                        await sock.sendMessage(sender, { text: activationResult.message });
                    } else {
                        await sock.sendMessage(sender, { text: activationResult.message });
                    }
                    return;
                }

                // STRICT ACTIVATION ENFORCEMENT - ONLY RESPOND TO ACTIVATED USERS
                if (!user || !user.isActivated) {
                    console.log(`❌ Unregistered or unactivated user ${phoneNumber} tried to send message - IGNORING`);
                    // DO NOT SEND ANY RESPONSE - COMPLETELY IGNORE
                    return;
                }

                // USER IS ACTIVATED - PROCESS COMMANDS
                const isAdmin = user.role === 'admin';
                const isGroupManager = user.role === 'groupManager';

                // Handle admin commands
                if (isAdmin && text.startsWith('!')) {
                    const handledAdmin = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    if (handledAdmin) return;
                }

                // Handle group manager commands
                if ((isAdmin || isGroupManager) && text.startsWith('!')) {
                    const handledGroup = await groupManager.handleGroupCommand(sock, sender, phoneNumber, username, text, message);
                    if (handledGroup) return;
                }

                // Handle general commands
                const handledGeneral = await generalCommands.handleGeneralCommand(sock, sender, phoneNumber, username, text, message);
                if (handledGeneral) return;

                // Handle payment messages
                const handledPayment = await paymentHandler.handlePaymentMessage(sock, sender, phoneNumber, username, message);
                if (handledPayment) return;

                // Handle dating commands - check if dating mode is enabled
                if (await datingManager.isDatingModeEnabled(phoneNumber)) {
                    const handledDating = await datingManager.handleDatingCommand(sock, sender, phoneNumber, username, text, message);
                    if (handledDating) return;
                } else if (text.toLowerCase().includes('dating') || text.toLowerCase().includes('date')) {
                    // Inform user about dating features
                    await sock.sendMessage(sender, {
                        text: `💝 Dating Features\n\n` +
                              `Dating mode is not enabled for your account yet.\n\n` +
                              `To access dating features:\n` +
                              `1. Subscribe to premium with !subscription\n` +
                              `2. After payment, dating mode will be activated\n` +
                              `3. Create your profile and start matching!`
                    });
                    return;
                }

                // Handle group links
                const hasGroupLink = text.includes('chat.whatsapp.com');
                if (hasGroupLink) {
                    console.log(`🔗 Detected group link from ${username}, attempting to join...`);
                    await groupManager.handleGroupLink(sock, text, phoneNumber, username);
                    return;
                }

                // Handle commands from command number
                if (sender === COMMAND_NUMBER && text.startsWith('!')) {
                    await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    return;
                }

                // Admin subscription activation with dating mode
                if (text.startsWith('!activatesub ') && isAdmin) {
                    const targetPhone = text.substring('!activatesub '.length).trim();
                    const success = await paymentHandler.activateSubscription(sock, sender, targetPhone);

                    if (success) {
                        // Activate dating mode for this user
                        await datingManager.activateDatingMode(targetPhone);
                        await sock.sendMessage(sender, {
                            text: `✅ Subscription activated for ${targetPhone}\n` +
                                  `💝 Dating mode has been enabled for this user.`
                        });
                    }
                    return;
                }

                // Default response for activated users - only respond to commands
                if (text.trim() && text.startsWith('!')) {
                    await sock.sendMessage(sender, {
                        text: `🤖 Hello ${username}! I'm your WhatsApp bot.\n\n` +
                              `Your role: ${user.role}\n` +
                              `Use !help to see available commands for your role.`
                    });
                }
                // IGNORE all non-command messages from activated users

            } catch (error) {
                console.error('Error in message handler:', error);

                // Handle encryption errors specifically
                if (error.message.includes('PreKeyError') || error.message.includes('SenderKeyRecord')) {
                    console.log('🔑 Encryption error detected in message processing');
                    await handleEncryptionError(m.messages[0].key.remoteJid, m.messages[0].key.participant);
                }

                // DO NOT SEND ERROR MESSAGES TO UNACTIVATED USERS
                try {
                    const sender = m.messages[0].key.remoteJid;
                    const phoneNumber = sender.split('@')[0];
                    const user = await userManager.getUser(phoneNumber);

                    // Only send error messages to activated users
                    if (user && user.isActivated) {
                        await sock.sendMessage(sender, {
                            text: '❌ An error occurred while processing your message. Please try again.'
                        });
                    }
                } catch (sendError) {
                    console.error('Failed to send error message:', sendError);
                }
            }
        });

        // Group event handler - only handle events from activated users
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const participantJid = update.participants[0];
                if (participantJid) {
                    const phoneNumber = participantJid.split('@')[0];
                    const user = await userManager.getUser(phoneNumber);

                    if (user && user.isActivated) {
                        await groupManager.handleGroupUpdate(sock, update);
                    }
                }
            } catch (error) {
                console.error('Error handling group update:', error);
            }
        });

        // Start inactivity checker for dating features
        datingManager.startInactivityChecker(sock, 30);

    } catch (error) {
        console.error('Error starting bot:', error);
        connectionManager.handleConnectionFailure();
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