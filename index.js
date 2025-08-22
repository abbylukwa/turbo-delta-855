const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
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

// Store for connection
let sock = null;
let isConnected = false;

// Command number
const COMMAND_NUMBER = '263717457592@s.whatsapp.net';

async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        sock = makeWASocket({
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            markOnlineOnConnect: true,
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

        sock.ev.on('connection.update', (update) => {
            const { connection, qr } = update;

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
            } else if (connection === 'close') {
                isConnected = false;
                console.log('🔌 Connection closed');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Message handler
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const message = m.messages[0];
                if (!message.message) return;

                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text || "";
                
                const sender = message.key.remoteJid;
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
                    return;
                }

                // Handle admin commands (only for admins)
                if (isAdmin) {
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

            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });

    } catch (error) {
        console.error('Error starting bot:', error);
        setTimeout(startBot, 5000);
    }
}

// Helper function for debugging
function echo(message) {
    console.log(`[DEBUG] ${message}`);
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});        // Message handler
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const message = m.messages[0];
                if (!message.message) return;

                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text || "";
                
                const sender = message.key.remoteJid;
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
                    return;
                }

                // Handle admin commands (only for admins)
                if (isAdmin) {
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

            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });

    } catch (error) {
        console.error('Error starting bot:', error);
        setTimeout(startBot, 5000);
    }
}

// Helper function for debugging
function echo(message) {
    console.log(`[DEBUG] ${message}`);
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});        });

        sock.ev.on('creds.update', saveCreds);

        // Message handler
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const message = m.messages[0];
                if (!message.message) return;

                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text || "";
                
                const sender = message.key.remoteJid;
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
                    return;
                }

                // Handle admin commands (only for admins)
                if (isAdmin) {
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

            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });

    } catch (error) {
        console.error('Error starting bot:', error);
        setTimeout(startBot, 5000);
    }
}

// Helper function for debugging
function echo(message) {
    console.log(`[DEBUG] ${message}`);
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});            const { connection, qr } = update;

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
            } else if (connection === 'close') {
                isConnected = false;
                console.log('🔌 Connection closed');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Message handler
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const message = m.messages[0];
                if (!message.message) return;

                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text || "";
                
                const sender = message.key.remoteJid;
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

                // Check if user is activated
                const isActivated = userManager.isUserActivated(phoneNumber);
                
                // Handle activation
                if (!isActivated && text.trim() === '0121Abner') {
                    await activationManager.handleActivation(sock, sender, phoneNumber, username);
                    return;
                }

                // If not activated, ignore all messages
                if (!isActivated) {
                    console.log(`❌ Unactivated user ${phoneNumber} tried to send message`);
                    return;
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

            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });

    } catch (error) {
        console.error('Error starting bot:', error);
        setTimeout(startBot, 5000);
    }
}

// Helper function for debugging
function echo(message) {
    console.log(`[DEBUG] ${message}`);
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});
