// ADD THESE TWO LINES AT THE VERY TOP
globalThis.File = class File {};
globalThis.crypto = require('crypto').webcrypto;

// Your existing imports
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

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

// QR code management - INCREASED TO 70 SECONDS
let lastQRGenerationTime = 0;
const QR_GENERATION_COOLDOWN = 70000; // 70 seconds cooldown between QR codes
let qrCooldownTimeout = null;
let currentQR = null;

// Command number
const COMMAND_NUMBER = '263717457592@s.whatsapp.net';

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
            console.log('❌ No auth files found. Need to scan QR code');
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
        console.log('❌ Auth directory not found. Will create new one with QR scan');
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

// Function to handle QR code generation with cooldown
function handleQRCodeGeneration(qr) {
    const now = Date.now();
    const timeSinceLastQR = now - lastQRGenerationTime;
    
    // Store current QR code
    currentQR = qr;
    
    // If we recently generated a QR code, wait before showing a new one
    if (timeSinceLastQR < QR_GENERATION_COOLDOWN) {
        const remainingTime = Math.ceil((QR_GENERATION_COOLDOWN - timeSinceLastQR) / 1000);
        console.log(`\n⏳ Please scan the previous QR code. Waiting ${remainingTime}s before generating a new one...`);
        
        // Clear any existing timeout
        if (qrCooldownTimeout) {
            clearTimeout(qrCooldownTimeout);
        }
        
        // Set timeout to show QR code after cooldown
        qrCooldownTimeout = setTimeout(() => {
            showQRCode(qr);
        }, QR_GENERATION_COOLDOWN - timeSinceLastQR);
        
        return;
    }
    
    // Show QR code immediately if cooldown has passed
    showQRCode(qr);
}

// Function to display QR code
function showQRCode(qr) {
    console.log('\n📱 QR Code generated successfully!');
    console.log('👉 Scan with WhatsApp -> Linked Devices');
    console.log('──────────────────────────────────────────\n');
    qrcode.generate(qr, { small: true });
    lastQRGenerationTime = Date.now();
}

// Function to manually retry QR generation
function retryQRGeneration() {
    if (currentQR) {
        console.log('\n🔄 Retrying QR code display...');
        showQRCode(currentQR);
    } else {
        console.log('\n❌ No QR code available to retry');
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

async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        
        // Ensure directories exist
        await ensureDirectories();

        // Check if we have existing auth files
        const hasAuthFiles = await checkAuthFiles();

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        // Get latest version for better compatibility
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📦 Using Baileys version: ${version.join('.')}, Latest: ${isLatest}`);

        // Create a simple logger that has the child method
        const logger = createSimpleLogger();

        sock = makeWASocket({
            printQRInTerminal: true, // Enable terminal QR as backup
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            version: version,
            markOnlineOnConnect: false,
            connectTimeoutMs: 120000, // Increased timeout to 2 minutes
            keepAliveIntervalMs: 20000, // Increased keepalive
            defaultQueryTimeoutMs: 60000,
            maxRetries: 10, // Increased retries
            syncFullHistory: false,
            transactionOpts: {
                maxCommitRetries: 10, // Increased retries
                delayBetweenTriesMs: 5000 // Increased delay
            },
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
            // Additional options to prevent QR timeout - INCREASED TO 3 MINUTES
            qrTimeout: 180000, // 3 minutes for QR timeout
            authTimeout: 180000, // 3 minutes for auth timeout
            // Use our custom logger
            logger: logger
        });

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
        const downloadManager = = new DownloadManager();
        
        echo('Initializing GeneralCommands...');
        const generalCommands = new GeneralCommands(userManager, downloadManager, subscriptionManager);
        
        echo('Initializing PaymentHandler...');
        const paymentHandler = new PaymentHandler(subscriptionManager, userManager);
        
        echo('Initializing DatingManager...');
        const datingManager = new DatingManager(userManager, subscriptionManager);
        
        echo('Initializing AdminCommands...');
        const adminCommands = new AdminCommands(userManager, groupManager);

        // Setup auth state backup
        setupAuthStateBackup(sock.authState);

        // Connection event handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect, isNewLogin } = update;
            console.log('Connection update:', connection, lastDisconnect?.error?.message || '');

            if (qr) {
                console.log('📱 QR code received');
                // Use our cooldown-controlled QR code handler
                handleQRCodeGeneration(qr);
            }

            if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is now ready to receive messages');
                
                // Clear any pending QR cooldown
                if (qrCooldownTimeout) {
                    clearTimeout(qrCooldownTimeout);
                    qrCooldownTimeout = null;
                }
                
                // Send welcome message to command number
                try {
                    await sock.sendMessage(COMMAND_NUMBER, {
                        text: '🤖 Bot is now online and ready!'
                    });
                } catch (error) {
                    console.log('Could not send online notification to command number');
                }
            } else if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown reason';
                
                console.log(`🔌 Connection closed: ${errorMessage}`);
                
                // Handle specific error types
                if (errorMessage.includes('PreKeyError') || errorMessage.includes('SenderKeyRecord')) {
                    console.log('🔑 Encryption error detected, will attempt recovery on reconnect');
                }
                
                if (errorMessage.includes('QR refs attempts ended')) {
                    console.log('🔄 QR generation failed, clearing auth and retrying...');
                    await clearAuthFiles();
                }
                
                // Don't clear auth for normal connection issues
                if (statusCode === DisconnectReason.loggedOut || errorMessage.includes('replaced')) {
                    console.log('🔄 Logged out from server, clearing auth files...');
                    await clearAuthFiles();
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
            if (error.message.includes('QR')) {
                console.log('🔄 QR error detected, will retry...');
                retryQRGeneration();
            }
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

                // Get user data and activation codes
                const user = await userManager.getUser(phoneNumber);
                const activationCodes = activationManager.getActivationCodes();
                const isActivationCode = Object.values(activationCodes).includes(text.trim());
                
                // Handle activation codes
                if (isActivationCode) {
                    console.log(`🔑 Activation attempt with code: ${text.trim()}`);
                    
                    const activationResult = await activationManager.handleActivation(
                        sock, sender, phoneNumber, username, text.trim()
                    );
                    
                    if (activationResult.success && activationResult.message) {
                        console.log(`✅ User ${phoneNumber} activated successfully`);
                        await sock.sendMessage(sender, { text: activationResult.message });
                        
                        // If this is a general user activation, send welcome message with dating info
                        if (activationResult.role === 'general') {
                            await sock.sendMessage(sender, {
                                text: `🎉 Welcome to our community!\n\n` +
                                      `As a general user, you can:\n` +
                                      `• Download media with !download\n` +
                                      `• Search for content with !search\n` +
                                      `• Check your downloads with !mydownloads\n\n` +
                                      `💝 Subscribe to unlock dating features:\n` +
                                      `• Create a dating profile\n` +
                                      `• Find matches in your area\n` +
                                      `• Connect with other users\n\n` +
                                      `Use !subscription to learn more!`
                            });
                        }
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
                if (datingManager.isDatingModeEnabled(phoneNumber)) {
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
                        datingManager.activateDatingMode(targetPhone);
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

// Start the bot
connectionManager.connect();

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

module.exports = { startBot, connectionManager };
