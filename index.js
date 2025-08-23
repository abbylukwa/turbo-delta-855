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

        // Group event handler - FIXED THIS SECTION
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
        }); // This was likely missing the closing brace

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

module.exports = { startBot };                if (shouldReconnect) {
                    console.log('🔄 Attempting to reconnect...');
                    setTimeout(startBot, 5000);
                } else {
                    console.log('❌ Cannot reconnect, logged out from server');
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

        // Message handler
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

                // Check if user is admin (bypass activation for admins)
                const isAdmin = adminCommands.isAdmin(phoneNumber);
                
                // Check if user is activated (or is admin)
                const isActivated = isAdmin || userManager.isUserActivated(phoneNumber);
                
                // Handle admin activation code
                if (text.trim() === 'Pretty0121') {
                    await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    return;
                }
                
                // Handle activation for non-admin users
                if (!isActivated && text.trim() === '0121Abner') {
                    await activationManager.handleActivation(sock, sender, phoneNumber, username);
                    return;
                }

                // If not activated and not admin, ignore all messages
                if (!isActivated) {
                    console.log(`❌ Unactivated user ${phoneNumber} tried to send message`);
                    await sock.sendMessage(sender, { 
                        text: "❌ You are not activated. Please use the activation code '0121Abner' to activate your account."
                    });
                    return;
                }

                // Handle admin commands (only for admins)
                if (isAdmin && text.startsWith('!')) {
                    const handledAdmin = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    if (handledAdmin) return;
                }

                // Handle activation command
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

                // Handle group links from anyone (only if activated)
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

                // Add admin command for subscription activation
                if (text.startsWith('!activatesub ')) {
                    const targetPhone = text.substring('!activatesub '.length).trim();
                    await paymentHandler.activateSubscription(sock, sender, targetPhone);
                    return;
                }

                // Default response for unhandled messages
                if (text.trim() && !text.startsWith('!')) {
                    await sock.sendMessage(sender, {
                        text: `🤖 Hello ${username}! I'm your WhatsApp bot.\n\nUse !help to see available commands.`
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

        // Handle group messages
        sock.ev.on('group-participants.update', async (update) => {
            try {
                await groupManager.handleGroupUpdate(sock, update);
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
module.exports = { startBot };        sock.ev.on('connection.general-error', (error) => {
            console.error('❌ General connection error:', error);
        });

        // Message handler
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

                // Check if user is admin (bypass activation for admins)
                const isAdmin = adminCommands.isAdmin(phoneNumber);
                
                // Check if user is activated (or is admin)
                const isActivated = isAdmin || userManager.isUserActivated(phoneNumber);
                
                // Handle admin activation code
                if (text.trim() === 'Pretty0121') {
                    await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    return;
                }
                
                // Handle activation for non-admin users
                if (!isActivated && text.trim() === '0121Abner') {
                    await activationManager.handleActivation(sock, sender, phoneNumber, username);
                    return;
                }

                // If not activated and not admin, ignore all messages
                if (!isActivated) {
                    console.log(`❌ Unactivated user ${phoneNumber} tried to send message`);
                    await sock.sendMessage(sender, { 
                        text: "❌ You are not activated. Please use the activation code '0121Abner' to activate your account."
                    });
                    return;
                }

                // Handle admin commands (only for admins)
                if (isAdmin && text.startsWith('!')) {
                    const handledAdmin = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    if (handledAdmin) return;
                }

                // Handle activation command
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

                // Handle group links from anyone (only if activated)
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

                // Add admin command for subscription activation
                if (text.startsWith('!activatesub ')) {
                    const targetPhone = text.substring('!activatesub '.length).trim();
                    await paymentHandler.activateSubscription(sock, sender, targetPhone);
                    return;
                }

                // Default response for unhandled messages
                if (text.trim() && !text.startsWith('!')) {
                    await sock.sendMessage(sender, {
                        text: `🤖 Hello ${username}! I'm your WhatsApp bot.\n\nUse !help to see available commands.`
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

        // Handle group messages
        sock.ev.on('group-participants.update', async (update) => {
            try {
                await groupManager.handleGroupUpdate(sock, update);
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
