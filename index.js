globalThis.crypto = require('crypto').webcrypto;
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
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
        const files = await fs.readdir(authDir);
        
        for (const file of files) {
            await fs.unlink(path.join(authDir, file));
        }
        console.log('✅ Cleared invalid auth files');
    } catch (error) {
        console.log('No auth files to clear or error clearing:', error.message);
    }
}

// Force reauthentication
async function forceReauthentication() {
    try {
        const authDir = path.join(__dirname, 'auth_info_baileys');
        await fs.rm(authDir, { recursive: true, force: true });
        console.log('🗑️  Cleared old authentication data');
        console.log('🔄 Restarting bot for fresh QR code...');
        setTimeout(startBot, 2000);
    } catch (error) {
        console.error('Error clearing auth data:', error);
        setTimeout(startBot, 5000);
    }
}

async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        
        // Ensure directories exist
        await ensureDirectories();

        // Check if we have existing auth files
        const hasAuthFiles = await checkAuthFiles();

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        sock = makeWASocket({
            printQRInTerminal: true,
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            defaultQueryTimeoutMs: 60000,
            maxRetries: 3, // Reduced retries to fail faster
            syncFullHistory: false,
            transactionOpts: {
                maxCommitRetries: 5,
                delayBetweenTriesMs: 3000
            },
            // Add these options to prevent registration attempts
            registration: {
                phoneCall: false,
                codeMethod: 'none'
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
            const { connection, qr, lastDisconnect } = update;

            if (qr) {
                console.log('\n📱 QR Code generated successfully!');
                console.log('👉 Scan with WhatsApp -> Linked Devices');
                console.log('──────────────────────────────────────────\n');
            }

            if (connection === 'open') {
                isConnected = true;
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
                
                // Handle registration failures specifically
                if (lastDisconnect?.error?.output?.statusCode === 515) {
                    console.log('❌ Registration attempt blocked by WhatsApp');
                    console.log('🔄 Clearing invalid auth files and restarting...');
                    await forceReauthentication();
                    return;
                }
                
                // Handle other connection failures
                const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log(`🔌 Connection closed: ${lastDisconnect.error?.message || 'Unknown reason'}`);
                
                if (shouldReconnect) {
                    console.log('🔄 Attempting to reconnect...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('❌ Cannot reconnect, logged out from server');
                }
            } else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Handle connection errors
        sock.ev.on('connection.general-error', (error) => {
            console.error('❌ General connection error:', error);
            
            // If it's a registration error, clear auth files
            if (error.message?.includes('registration') || error.message?.includes('515')) {
                console.log('🔄 Detected registration error, clearing auth files...');
                setTimeout(forceReauthentication, 2000);
            }
        });

        // Main message handler with strict activation
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
        setTimeout(startBot, 10000);
    }
}

// Start the bot
startBot();

// Process handlers
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (sock) {
        sock.end();
    }
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { startBot };
