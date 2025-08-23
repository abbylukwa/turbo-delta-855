// ADD THESE TWO LINES AT THE VERY TOP
globalThis.File = class File {};
globalThis.crypto = require('crypto').webcrypto;

// Your existing imports (remove the duplicate crypto line)
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
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
const RECONNECT_INTERVAL = 5000; // 5 seconds

// Command number
const COMMAND_NUMBER = '263717457592@s.whatsapp.net';

// Helper function for debugging
function echo(message) {
    console.log(`[DEBUG] ${message}`);
}

// Ensure data directories exist
async function ensureDirectories() {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
        await fs.mkdir(path.join(__dirname, 'auth_info_baileys'), { recursive: true });
        console.log('✅ Data directories created successfully');
    } catch (error) {
        console.error('❌ Error creating directories:', error);
    }
}

// Check if auth files exist
async function checkAuthFiles() {
    try {
        const authDir = path.join(__dirname, 'auth_info_baileys');
        const files = await fs.readdir(authDir);
        console.log('📁 Auth files found:', files);
        
        if (files.length === 0) {
            console.log('❌ No auth files found. Need to scan QR code');
            return false;
        }
        
        // Check if files have content
        for (const file of files) {
            const content = await fs.readFile(path.join(authDir, file), 'utf8');
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
        await fs.rm(authDir, { recursive: true, force: true });
        console.log('✅ Cleared invalid auth files');
        await fs.mkdir(authDir, { recursive: true });
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
        
        const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts), 30000);
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

        sock = makeWASocket({
            printQRInTerminal: true,
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            version: version,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000, // Increased timeout
            keepAliveIntervalMs: 15000, // More frequent keep-alive
            defaultQueryTimeoutMs: 60000,
            maxRetries: 5, // Increased retries
            syncFullHistory: false,
            transactionOpts: {
                maxCommitRetries: 5,
                delayBetweenTriesMs: 3000
            },
            // Allow registration but prevent new registrations
            registration: {
                phoneCall: false,
                codeMethod: 'none'
            },
            // Additional connection options
            generateHighQualityLinkPreview: true,
            linkPreviewImageThumbnailWidth: 192,
            getMessage: async (key) => {
                return {
                    conversation: "hello"
                }
            }
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
        const downloadManager = new DownloadManager();
        
        echo('Initializing GeneralCommands...');
        const generalCommands = new GeneralCommands(userManager, downloadManager, subscriptionManager);
        
        echo('Initializing PaymentHandler...');
        const paymentHandler = new PaymentHandler(subscriptionManager, userManager);
        
        echo('Initializing DatingManager...');
        const datingManager = new DatingManager(userManager, subscriptionManager);
        
        echo('Initializing AdminCommands...');
        const adminCommands = new AdminCommands(userManager, groupManager);

        // Connection event handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect, isNewLogin } = update;
            console.log('Connection update:', connection, lastDisconnect?.error?.message || '');

            if (qr) {
                console.log('\n📱 QR Code generated successfully!');
                console.log('👉 Scan with WhatsApp -> Linked Devices');
                console.log('──────────────────────────────────────────\n');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is now ready to receive messages');
                
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
                
                console.log(`🔌 Connection closed: ${lastDisconnect.error?.message || 'Unknown reason'}`);
                
                // Don't clear auth for normal connection issues
                if (statusCode === DisconnectReason.loggedOut || 
                    lastDisconnect?.error?.message?.includes('replaced')) {
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
            console.error('❌ General connection error:', error);
            connectionManager.handleConnectionFailure();
        });

        // Handle authentication failures
        sock.ev.on('connection.require_update', (update) => {
            console.log('🔄 Connection requires update:', update);
        });

        // Main message handler
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
                    }
                    return;
                }

                // STRICT ACTIVATION ENFORCEMENT
                if (!user) {
                    console.log(`❌ Unregistered user ${phoneNumber} tried to send message`);
                    await sock.sendMessage(sender, { 
                        text: `❌ You are not registered. Please use one of the following activation codes:\n\n` +
                              `👑 Admin: ${activationCodes.admin}\n` +
                              `🛡️ Group Manager: ${activationCodes.groupManager}\n` +
                              `👤 User: ${activationCodes.general}\n\n` +
                              `Reply with the appropriate code to activate your account.`
                    });
                    return;
                }

                if (!user.isActivated) {
                    console.log(`❌ Unactivated user ${phoneNumber} tried to send message`);
                    await sock.sendMessage(sender, { 
                        text: `❌ Your account is not activated yet. Please wait for activation or contact support.\n\n` +
                              `Your current status: Registered as ${user.role} but not activated.`
                    });
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

                // Handle dating commands
                const handledDating = await datingManager.handleDatingCommand(sock, sender, phoneNumber, username, text, message);
                if (handledDating) return;

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

                // Admin subscription activation
                if (text.startsWith('!activatesub ') && isAdmin) {
                    const targetPhone = text.substring('!activatesub '.length).trim();
                    await paymentHandler.activateSubscription(sock, sender, targetPhone);
                    return;
                }

                // Default response for activated users
                if (text.trim() && !text.startsWith('!')) {
                    await sock.sendMessage(sender, {
                        text: `🤖 Hello ${username}! I'm your WhatsApp bot.\n\n` +
                              `Your role: ${user.role}\n` +
                              `Use !help to see available commands for your role.`
                    });
                }

            } catch (error) {
                console.error('Error in message handler:', error);
                try {
                    await sock.sendMessage(sender, {
                        text: '❌ An error occurred while processing your message. Please try again.'
                    });
                } catch (sendError) {
                    console.error('Failed to send error message:', sendError);
                }
            }
        });

        // Group event handler
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
