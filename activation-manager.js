globalThis.crypto = require('crypto').webcrypto;
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, getPhoneCode } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
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

async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        sock = makeWASocket({
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            defaultQueryTimeoutMs: 60000,
            maxRetries: 10,
            syncFullHistory: false,
            transactionOpts: {
                maxCommitRetries: 10,
                delayBetweenTriesMs: 3000
            },
            phoneNumber: "+263777627210",
            pairingOptions: {
                phoneMethod: true
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
            const { connection, qr, lastDisconnect, phoneCode } = update;

            if (phoneCode) {
                console.log('\n╔══════════════════════════════════════════════════╗');
                console.log('║                WHATSAPP PAIRING CODE              ║');
                console.log('╠══════════════════════════════════════════════════╣');
                console.log('║ Go to WhatsApp on your phone > Linked Devices    ║');
                console.log('║ > Link a Device and enter this code:             ║');
                console.log('║                                                  ║');
                console.log(`║                📱 ${phoneCode}                   ║`);
                console.log('║                                                  ║');
                console.log('║ Code valid for 2 minutes                         ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            }

            if (qr) {
                console.log('\n╔══════════════════════════════════════════════════╗');
                console.log('║                WHATSAPP BOT QR CODE               ║');
                console.log('╠══════════════════════════════════════════════════╣');
                console.log('║ Scan this QR code with WhatsApp -> Linked Devices║');
                console.log('║                                                  ║');
                qrcode.generate(qr, { small: true });
                console.log('║                                                  ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            }

            if (connection === 'open') {
                isConnected = true;
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is now ready to receive messages');
            } else if (connection === 'close') {
                isConnected = false;
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
        sock.ev.on('connection.phone-change', (update) => {
            console.log('📱 Phone number changed:', update);
        });

        sock.ev.on('connection.general-error', (error) => {
            console.error('❌ General connection error:', error);
        });

        // Request pairing code if not received
        setTimeout(async () => {
            if (!isConnected && sock) {
                try {
                    const phoneCode = await getPhoneCode(sock, "+263777627210");
                    if (phoneCode) {
                        console.log('\n📱 Alternative pairing code:', phoneCode);
                        console.log('Use this code if the automatic one doesn\'t appear');
                    }
                } catch (error) {
                    console.log('Pairing code not available yet:', error.message);
                }
            }
        }, 10000);

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
                const activationCodes = userManager.getActivationCodes();
                const isActivationCode = Object.values(activationCodes).includes(text.trim());
                
                // Handle activation codes
                if (isActivationCode) {
                    console.log(`🔑 Activation attempt with code: ${text.trim()}`);
                    
                    const activationResult = await activationManager.handleActivation(
                        sock, sender, phoneNumber, username, text.trim()
                    );
                    
                    if (activationResult.success) {
                        console.log(`✅ User ${phoneNumber} activated successfully`);
                        const welcomeMessage = userManager.getWelcomeMessage(activationResult.role, username);
                        await sock.sendMessage(sender, { text: welcomeMessage });
                    } else {
                        console.log(`❌ Activation failed for ${phoneNumber}`);
                        await sock.sendMessage(sender, { 
                            text: activationResult.message || '❌ Activation failed. Please try again.'
                        });
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
                const isAdmin = await userManager.isAdmin(phoneNumber);
                const isGroupManager = await userManager.isGroupManager(phoneNumber);

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
                const hasGroupLink = await groupManager.detectGroupLink(text);
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

module.exports = { startBot };                console.log('║ > Link a Device and enter this code:             ║');
                console.log('║                                                  ║');
                console.log(`║                📱 ${phoneCode}                   ║`);
                console.log('║                                                  ║');
                console.log('║ Code valid for 2 minutes                         ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            }

            if (qr) {
                console.log('\n╔══════════════════════════════════════════════════╗');
                console.log('║                WHATSAPP BOT QR CODE               ║');
                console.log('╠══════════════════════════════════════════════════╣');
                console.log('║ Scan this QR code with WhatsApp -> Linked Devices║');
                console.log('║                                                  ║');
                qrcode.generate(qr, { small: true });
                console.log('║                                                  ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            }

            if (connection === 'open') {
                isConnected = true;
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is now ready to receive messages');
            } else if (connection === 'close') {
                isConnected = false;
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
        sock.ev.on('connection.phone-change', (update) => {
            console.log('📱 Phone number changed:', update);
        });

        sock.ev.on('connection.general-error', (error) => {
            console.error('❌ General connection error:', error);
        });

        // Request pairing code if not received
        setTimeout(async () => {
            if (!isConnected && sock) {
                try {
                    const phoneCode = await getPhoneCode(sock, "+263777627210");
                    if (phoneCode) {
                        console.log('\n📱 Alternative pairing code:', phoneCode);
                        console.log('Use this code if the automatic one doesn\'t appear');
                    }
                } catch (error) {
                    console.log('Pairing code not available yet:', error.message);
                }
            }
        }, 10000);

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
                const activationCodes = userManager.getActivationCodes();
                const isActivationCode = Object.values(activationCodes).includes(text.trim());
                
                // Handle activation codes
                if (isActivationCode) {
                    console.log(`🔑 Activation attempt with code: ${text.trim()}`);
                    
                    const activationResult = await activationManager.handleActivation(
                        sock, sender, phoneNumber, username, text.trim()
                    );
                    
                    if (activationResult.success) {
                        console.log(`✅ User ${phoneNumber} activated successfully`);
                        const welcomeMessage = userManager.getWelcomeMessage(activationResult.role, username);
                        await sock.sendMessage(sender, { text: welcomeMessage });
                    } else {
                        console.log(`❌ Activation failed for ${phoneNumber}`);
                        await sock.sendMessage(sender, { 
                            text: activationResult.message || '❌ Activation failed. Please try again.'
                        });
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
                const isAdmin = await userManager.isAdmin(phoneNumber);
                const isGroupManager = await userManager.isGroupManager(phoneNumber);

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
                const hasGroupLink = await groupManager.detectGroupLink(text);
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

module.exports = { startBot };                console.log('\n╔══════════════════════════════════════════════════╗');
                console.log('║                WHATSAPP PAIRING CODE              ║');
                console.log('╠══════════════════════════════════════════════════╣');
                console.log('║ Go to WhatsApp on your phone > Linked Devices    ║');
                console.log('║ > Link a Device and enter this code:             ║');
                console.log('║                                                  ║');
                console.log(`║                📱 ${phoneCode}                   ║`);
                console.log('║                                                  ║');
                console.log('║ Code valid for 2 minutes                         ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            }

            if (qr) {
                console.log('\n╔══════════════════════════════════════════════════╗');
                console.log('║                WHATSAPP BOT QR CODE               ║');
                console.log('╠══════════════════════════════════════════════════╣');
                console.log('║ Scan this QR code with WhatsApp -> Linked Devices║');
                console.log('║                                                  ║');
                qrcode.generate(qr, { small: true });
                console.log('║                                                  ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            }

            if (connection === 'open') {
                isConnected = true;
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is now ready to receive messages');
            } 
            else if (connection === 'close') {
                isConnected = false;
                const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log(`🔌 Connection closed: ${lastDisconnect.error?.message || 'Unknown reason'}`);
                
                if (shouldReconnect) {
                    console.log('🔄 Attempting to reconnect...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('❌ Cannot reconnect, logged out from server');
                }
            }
            else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Handle connection errors
        sock.ev.on('connection.phone-change', (update) => {
            console.log('📱 Phone number changed:', update);
        });

        sock.ev.on('connection.general-error', (error) => {
            console.error('❌ General connection error:', error);
        });

        // Explicitly request pairing code if not received within 10 seconds
        setTimeout(async () => {
            if (!isConnected && sock) {
                try {
                    const phoneCode = await getPhoneCode(sock, "+263777627210");
                    if (phoneCode) {
                        console.log('\n📱 Alternative pairing code:', phoneCode);
                        console.log('Use this code if the automatic one doesn\'t appear');
                    }
                } catch (error) {
                    console.log('Pairing code not available yet:', error.message);
                }
            }
        }, 10000);

        // Message handler - STRICT ACTIVATION REQUIREMENT
        sock.ev.on("messages.upsert", async (m) => {
            try {
                // Skip if not connected
                if (!isConnected) return;

                const message = m.messages[0];
                if (!message.message || message.key.fromMe) return;

                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text ||
                            message.message.buttonsResponseMessage?.selectedDisplayText || "";
                
                const sender = message.key.remoteJid;
                if (!sender.endsWith('@s.whatsapp.net')) return; // Only handle personal chats
                
                const phoneNumber = sender.split('@')[0];
                
                // Get username
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
                
                // Handle activation codes FIRST - before any other processing
                const activationCodes = userManager.getActivationCodes();
                const isActivationCode = Object.values(activationCodes).includes(text.trim());
                
                if (isActivationCode) {
                    console.log(`🔑 Activation attempt with code: ${text.trim()}`);
                    
                    // Handle activation process
                    const activationResult = await activationManager.handleActivation(
                        sock, sender, phoneNumber, username, text.trim()
                    );
                    
                    if (activationResult.success) {
                        console.log(`✅ User ${phoneNumber} activated successfully`);
                        // Send welcome message based on role
                        const welcomeMessage = userManager.getWelcomeMessage(
                            activationResult.role, 
                            username
                        );
                        await sock.sendMessage(sender, { text: welcomeMessage });
                    } else {
                        console.log(`❌ Activation failed for ${phoneNumber}`);
                        await sock.sendMessage(sender, { 
                            text: activationResult.message || '❌ Activation failed. Please try again.'
                        });
                    }
                    return; // Stop further processing
                }

                // Check if user exists and is activated
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

                // Check if user is admin (bypass some restrictions)
                const isAdmin = await userManager.isAdmin(phoneNumber);
                const isGroupManager = await userManager.isGroupManager(phoneNumber);

                // Handle admin commands (only for admins)
                if (isAdmin && text.startsWith('!')) {
                    const handledAdmin = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    if (handledAdmin) return;
                }

                // Handle group manager commands
                if ((isAdmin || isGroupManager) && text.startsWith('!')) {
                    const handledGroup = await groupManager.handleGroupCommand(sock, sender, phoneNumber, username, text, message);
                    if (handledGroup) return;
                }

                // Handle activation command (for already activated users)
                const isGeneralActivated = await generalCommands.handleActivation(sock, sender, phoneNumber, username, text);
                if (isGeneralActivated) return;

                // Handle general commands
                const handledGeneral = await generalCommands.handleGeneralCommand(sock, sender, phoneNumber, username, text, message);
                if (handledGeneral) return;

                // Handle payment messages
                const handledPayment = await paymentHandler.handlePaymentMessage(sock, sender, phoneNumber, username, message);
                if (handledPayment) return;

                // Handle dating commands
                const handledDating = await datingManager.handleDatingCommand(sock, sender, phoneNumber, username, text, message);
                if (handledDating) return;

                // Handle profile creation steps
                const handledProfileCreation = await datingManager.handleProfileCreation(sock, sender, phoneNumber, username, text, message);
                if (handledProfileCreation) return;

                // Handle connect command
                const handledConnect = await datingManager.handleConnectCommand(sock, sender, phoneNumber, username, text);
                if (handledConnect) return;

                // Handle group links from activated users only
                const hasGroupLink = await groupManager.detectGroupLink(text);
                if (hasGroupLink) {
                    console.log(`🔗 Detected group link from ${username}, attempting to join...`);
                    await groupManager.handleGroupLink(sock, text, phoneNumber, username);
                    return;
                }

                // Handle commands from command number (admin bypass)
                if (sender === COMMAND_NUMBER && text.startsWith('!')) {
                    await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    return;
                }

                // Admin subscription activation command
                if (text.startsWith('!activatesub ') && isAdmin) {
                    const targetPhone = text.substring('!activatesub '.length).trim();
                    await paymentHandler.activateSubscription(sock, sender, targetPhone);
                    return;
                }

                // Default response for unhandled messages from activated users
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

        // Handle group messages (only for activated users)
        sock.ev.on('group-participants.update', async (update) => {
            try {
                // Check if the action was performed by an activated user
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
        setTimeout(startBot, 10000); // Wait 10 seconds before retrying
    }
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (sock) {
        sock.end();
    }
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for testing
module.exports = { startBot };                console.log('\n╔══════════════════════════════════════════════════╗');
                console.log('║                WHATSAPP PAIRING CODE              ║');
                console.log('╠══════════════════════════════════════════════════╣');
                console.log('║ Go to WhatsApp on your phone > Linked Devices    ║');
                console.log('║ > Link a Device and enter this code:             ║');
                console.log('║                                                  ║');
                console.log(`║                📱 ${phoneCode}                   ║`);
                console.log('║                                                  ║');
                console.log('║ Code valid for 2 minutes                         ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            }

            if (qr) {
                console.log('\n╔══════════════════════════════════════════════════╗');
                console.log('║                WHATSAPP BOT QR CODE               ║');
                console.log('╠══════════════════════════════════════════════════╣');
                console.log('║ Scan this QR code with WhatsApp -> Linked Devices║');
                console.log('║                                                  ║');
                qrcode.generate(qr, { small: true });
                console.log('║                                                  ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            }

            if (connection === 'open') {
                isConnected = true;
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is now ready to receive messages');
            } 
            else if (connection === 'close') {
                isConnected = false;
                const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log(`🔌 Connection closed: ${lastDisconnect.error?.message || 'Unknown reason'}`);
                
                if (shouldReconnect) {
                    console.log('🔄 Attempting to reconnect...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('❌ Cannot reconnect, logged out from server');
                }
            }
            else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Handle connection errors
        sock.ev.on('connection.phone-change', (update) => {
            console.log('📱 Phone number changed:', update);
        });

        sock.ev.on('connection.general-error', (error) => {
            console.error('❌ General connection error:', error);
        });

        // Explicitly request pairing code if not received within 10 seconds
        setTimeout(async () => {
            if (!isConnected && sock) {
                try {
                    const phoneCode = await getPhoneCode(sock, "+263777627210");
                    if (phoneCode) {
                        console.log('\n📱 Alternative pairing code:', phoneCode);
                        console.log('Use this code if the automatic one doesn\'t appear');
                    }
                } catch (error) {
                    console.log('Pairing code not available yet:', error.message);
                }
            }
        }, 10000);

        // Message handler - STRICT ACTIVATION REQUIREMENT
        sock.ev.on("messages.upsert", async (m) => {
            try {
                // Skip if not connected
                if (!isConnected) return;

                const message = m.messages[0];
                if (!message.message || message.key.fromMe) return;

                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text ||
                            message.message.buttonsResponseMessage?.selectedDisplayText || "";
                
                const sender = message.key.remoteJid;
                if (!sender.endsWith('@s.whatsapp.net')) return; // Only handle personal chats
                
                const phoneNumber = sender.split('@')[0];
                
                // Get username
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
                
                // Handle activation codes FIRST - before any other processing
                const activationCodes = userManager.getActivationCodes();
                const isActivationCode = Object.values(activationCodes).includes(text.trim());
                
                if (isActivationCode) {
                    console.log(`🔑 Activation attempt with code: ${text.trim()}`);
                    
                    // Handle activation process
                    const activationResult = await activationManager.handleActivation(
                        sock, sender, phoneNumber, username, text.trim()
                    );
                    
                    if (activationResult.success) {
                        console.log(`✅ User ${phoneNumber} activated successfully`);
                        // Send welcome message based on role
                        const welcomeMessage = userManager.getWelcomeMessage(
                            activationResult.role, 
                            username
                        );
                        await sock.sendMessage(sender, { text: welcomeMessage });
                    } else {
                        console.log(`❌ Activation failed for ${phoneNumber}`);
                        await sock.sendMessage(sender, { 
                            text: activationResult.message || '❌ Activation failed. Please try again.'
                        });
                    }
                    return; // Stop further processing
                }

                // Check if user exists and is activated
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

                // Check if user is admin (bypass some restrictions)
                const isAdmin = await userManager.isAdmin(phoneNumber);
                const isGroupManager = await userManager.isGroupManager(phoneNumber);

                // Handle admin commands (only for admins)
                if (isAdmin && text.startsWith('!')) {
                    const handledAdmin = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    if (handledAdmin) return;
                }

                // Handle group manager commands
                if ((isAdmin || isGroupManager) && text.startsWith('!')) {
                    const handledGroup = await groupManager.handleGroupCommand(sock, sender, phoneNumber, username, text, message);
                    if (handledGroup) return;
                }

                // Handle activation command (for already activated users)
                const isGeneralActivated = await generalCommands.handleActivation(sock, sender, phoneNumber, username, text);
                if (isGeneralActivated) return;

                // Handle general commands
                const handledGeneral = await generalCommands.handleGeneralCommand(sock, sender, phoneNumber, username, text, message);
                if (handledGeneral) return;

                // Handle payment messages
                const handledPayment = await paymentHandler.handlePaymentMessage(sock, sender, phoneNumber, username, message);
                if (handledPayment) return;

                // Handle dating commands
                const handledDating = await datingManager.handleDatingCommand(sock, sender, phoneNumber, username, text, message);
                if (handledDating) return;

                // Handle profile creation steps
                const handledProfileCreation = await datingManager.handleProfileCreation(sock, sender, phoneNumber, username, text, message);
                if (handledProfileCreation) return;

                // Handle connect command
                const handledConnect = await datingManager.handleConnectCommand(sock, sender, phoneNumber, username, text);
                if (handledConnect) return;

                // Handle group links from activated users only
                const hasGroupLink = await groupManager.detectGroupLink(text);
                if (hasGroupLink) {
                    console.log(`🔗 Detected group link from ${username}, attempting to join...`);
                    await groupManager.handleGroupLink(sock, text, phoneNumber, username);
                    return;
                }

                // Handle commands from command number (admin bypass)
                if (sender === COMMAND_NUMBER && text.startsWith('!')) {
                    await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    return;
                }

                // Admin subscription activation command
                if (text.startsWith('!activatesub ') && isAdmin) {
                    const targetPhone = text.substring('!activatesub '.length).trim();
                    await paymentHandler.activateSubscription(sock, sender, targetPhone);
                    return;
                }

                // Default response for unhandled messages from activated users
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

        // Handle group messages (only for activated users)
        sock.ev.on('group-participants.update', async (update) => {
            try {
                // Check if the action was performed by an activated user
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
        setTimeout(startBot, 10000); // Wait 10 seconds before retrying
    }
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (sock) {
        sock.end();
    }
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for testing
module.exports = { startBot };            
            // Create new user
            users[phoneNumber] = {
                username: username,
                phoneNumber: phoneNumber,
                role: role,
                isActivated: false,
                activationCodeUsed: activationCode,
                registrationDate: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                referredBy: referredBy,
                referrals: [],
                profile: {
                    age: null,
                    gender: null,
                    location: null,
                    interests: [],
                    bio: null,
                    profilePicture: null
                },
                subscription: {
                    isActive: false,
                    type: null,
                    startDate: null,
                    endDate: null
                },
                datingProfile: {
                    isActive: false,
                    preferences: {
                        minAge: 18,
                        maxAge: 99,
                        gender: 'any',
                        location: null
                    },
                    matches: [],
                    likes: [],
                    dislikes: []
                },
                stats: {
                    messagesSent: 0,
                    commandsUsed: 0,
                    mediaDownloaded: 0
                },
                permissions: this.getDefaultPermissions(role)
            };
            
            // Add referral to referrer if applicable
            if (referredBy && users[referredBy]) {
                users[referredBy].referrals.push(phoneNumber);
            }
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error registering user:', error);
            return { success: false, message: 'Registration failed' };
        }
    }

    getDefaultPermissions(role) {
        const basePermissions = {
            canUseBasicCommands: true,
            canDownloadMedia: true,
            canCreateDatingProfile: true
        };
        
        switch(role) {
            case this.userRoles.admin:
                return {
                    ...basePermissions,
                    canManageUsers: true,
                    canManageGroups: true,
                    canActivateSubscriptions: true,
                    canBroadcastMessages: true,
                    canViewStatistics: true,
                    canUseAdminCommands: true
                };
            case this.userRoles.groupManager:
                return {
                    ...basePermissions,
                    canManageGroups: true,
                    canJoinGroups: true,
                    canInviteToGroups: true
                };
            default:
                return basePermissions;
        }
    }

    async getUser(phoneNumber) {
        try {
            const users = await this.loadUsers();
            return users[phoneNumber] || null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    async updateUser(phoneNumber, updates) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            // Update user properties
            users[phoneNumber] = { ...users[phoneNumber], ...updates };
            users[phoneNumber].lastSeen = new Date().toISOString();
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error updating user:', error);
            return { success: false, message: 'Update failed' };
        }
    }

    async activateUser(phoneNumber) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            users[phoneNumber].isActivated = true;
            users[phoneNumber].activationDate = new Date().toISOString();
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error activating user:', error);
            return { success: false, message: 'Activation failed' };
        }
    }

    isUserActivated(phoneNumber) {
        return this.getUser(phoneNumber).then(user => {
            return user ? user.isActivated : false;
        }).catch(() => false);
    }

    isAdmin(phoneNumber) {
        return this.getUser(phoneNumber).then(user => {
            return user ? user.role === this.userRoles.admin : false;
        }).catch(() => false);
    }

    isGroupManager(phoneNumber) {
        return this.getUser(phoneNumber).then(user => {
            return user ? user.role === this.userRoles.groupManager : false;
        }).catch(() => false);
    }

    async updateUserProfile(phoneNumber, profileUpdates) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            // Update profile properties
            users[phoneNumber].profile = { 
                ...users[phoneNumber].profile, 
                ...profileUpdates 
            };
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error updating user profile:', error);
            return { success: false, message: 'Profile update failed' };
        }
    }

    async incrementUserStat(phoneNumber, statName) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return false;
            }
            
            if (users[phoneNumber].stats[statName] !== undefined) {
                users[phoneNumber].stats[statName] += 1;
                await this.saveUsers(users);
            }
            
            return true;
        } catch (error) {
            console.error('Error incrementing user stat:', error);
            return false;
        }
    }

    async getAllUsers() {
        try {
            return await this.loadUsers();
        } catch (error) {
            console.error('Error getting all users:', error);
            return {};
        }
    }

    async getUsersByRole(role) {
        try {
            const users = await this.loadUsers();
            const filteredUsers = {};
            
            for (const [phoneNumber, user] of Object.entries(users)) {
                if (user.role === role) {
                    filteredUsers[phoneNumber] = user;
                }
            }
            
            return filteredUsers;
        } catch (error) {
            console.error('Error getting users by role:', error);
            return {};
        }
    }

    async getActiveUsers(days = 7) {
        try {
            const users = await this.loadUsers();
            const activeUsers = {};
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            for (const [phoneNumber, user] of Object.entries(users)) {
                const lastSeen = new Date(user.lastSeen);
                if (lastSeen >= cutoffDate && user.isActivated) {
                    activeUsers[phoneNumber] = user;
                }
            }
            
            return activeUsers;
        } catch (error) {
            console.error('Error getting active users:', error);
            return {};
        }
    }

    async searchUsers(criteria) {
        try {
            const users = await this.loadUsers();
            const results = {};
            
            for (const [phoneNumber, user] of Object.entries(users)) {
                let matches = true;
                
                for (const [key, value] of Object.entries(criteria)) {
                    if (key.includes('.')) {
                        // Handle nested properties (e.g., 'profile.age')
                        const keys = key.split('.');
                        let nestedValue = user;
                        for (const k of keys) {
                            nestedValue = nestedValue[k];
                            if (nestedValue === undefined) break;
                        }
                        
                        if (nestedValue !== value) {
                            matches = false;
                            break;
                        }
                    } else if (user[key] !== value) {
                        matches = false;
                        break;
                    }
                }
                
                if (matches) {
                    results[phoneNumber] = user;
                }
            }
            
            return results;
        } catch (error) {
            console.error('Error searching users:', error);
            return {};
        }
    }

    async deleteUser(phoneNumber) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            // Remove user from their referrer's referrals
            const referredBy = users[phoneNumber].referredBy;
            if (referredBy && users[referredBy]) {
                users[referredBy].referrals = users[referredBy].referrals.filter(
                    ref => ref !== phoneNumber
                );
            }
            
            // Remove user
            delete users[phoneNumber];
            
            await this.saveUsers(users);
            return { success: true, message: 'User deleted successfully' };
        } catch (error) {
            console.error('Error deleting user:', error);
            return { success: false, message: 'Deletion failed' };
        }
    }

    async getUsersCount() {
        try {
            const users = await this.loadUsers();
            return Object.keys(users).length;
        } catch (error) {
            console.error('Error getting users count:', error);
            return 0;
        }
    }

    async getActivatedUsersCount() {
        try {
            const users = await this.loadUsers();
            return Object.values(users).filter(user => user.isActivated).length;
        } catch (error) {
            console.error('Error getting activated users count:', error);
            return 0;
        }
    }

    async changeUserRole(phoneNumber, newRole) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            if (!Object.values(this.userRoles).includes(newRole)) {
                return { success: false, message: 'Invalid role' };
            }
            
            users[phoneNumber].role = newRole;
            users[phoneNumber].permissions = this.getDefaultPermissions(newRole);
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error changing user role:', error);
            return { success: false, message: 'Role change failed' };
        }
    }

    getActivationCodes() {
        return this.activationCodes;
    }

    getUserRoles() {
        return this.userRoles;
    }
}

module.exports = UserManager;
