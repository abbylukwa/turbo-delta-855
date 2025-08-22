const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Import required managers
const UserManager = require('./user-manager.js');
const GroupManager = require('./group-manager.js');
const NicciCommands = require('./nicci-commands.js');
const AdminCommands = require('./admin-commands.js');
const Downloader = require('./downloader.js');
const WebSearcher = require('./web-searcher.js');
const WebsiteScraper = require('./website-scraper.js');
const MultiWebsiteManager = require('./multi-website-manager.js');
const DatingManager = require('./dating-manager.js');

// Initialize all managers
const userManager = new UserManager();
const groupManager = new GroupManager();
const downloader = new Downloader();
const webSearcher = new WebSearcher();
const websiteScraper = new WebsiteScraper();
const multiWebsiteManager = new MultiWebsiteManager();
const datingManager = new DatingManager();

// Initialize command handlers
const nicciCommands = new NicciCommands(userManager, groupManager);
const adminCommands = new AdminCommands(userManager, groupManager, downloader, webSearcher, websiteScraper, multiWebsiteManager, datingManager);

// Store for reconnection
let sock = null;
let isConnected = false;

// Group link detection function
async function detectGroupLink(text) {
    const groupLinkPatterns = [
        /chat\.whatsapp\.com\/([a-zA-Z0-9_-]{22})/,
        /whatsapp\.com\/(?:chat|invite)\/([a-zA-Z0-9_-]{22})/,
        /https?:\/\/(?:www\.)?whatsapp\.com\/.{22}/,
        /https?:\/\/(?:www\.)?chat\.whatsapp\.com\/.{22}/
    ];
    
    return groupLinkPatterns.some(pattern => pattern.test(text));
}

async function handleGroupLinks(sock, message) {
    const text = message.message.conversation || 
                message.message.extendedTextMessage?.text || '';
    
    const groupLinkMatch = text.match(/https?:\/\/(?:www\.)?(?:chat\.)?whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})/);
    
    if (groupLinkMatch) {
        const inviteCode = groupLinkMatch[1];
        try {
            console.log(`🔗 Attempting to join group with code: ${inviteCode}`);
            await sock.groupAcceptInvite(inviteCode);
            console.log('✅ Successfully joined group!');
            
            const sender = message.key.remoteJid;
            await sock.sendMessage(sender, { 
                text: `✅ Successfully joined the group!\n\n🔗 Invite Code: ${inviteCode}\n📊 I will now monitor this group for management.`
            });
        } catch (error) {
            console.error('❌ Failed to join group:', error);
            const sender = message.key.remoteJid;
            await sock.sendMessage(sender, { 
                text: `❌ Failed to join group:\n${error.message || 'Unknown error'}`
            });
        }
    }
}

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        sock = makeWASocket({
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
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
            
            if (connection === 'close') {
                isConnected = false;
                console.log('🔌 Connection closed, attempting to reconnect...');
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
                
                if (shouldReconnect) {
                    setTimeout(() => {
                        console.log('🔄 Reconnecting...');
                        startBot();
                    }, 5000);
                } else {
                    console.log('❌ Cannot reconnect - authentication error');
                }
            } else if (connection === 'open') {
                isConnected = true;
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is now online and ready to receive messages');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Message handler
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const message = m.messages[0];
                if (!message.message) return;
                
                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text || 
                            message.message.imageMessage?.caption || "";
                
                const sender = message.key.remoteJid;
                const phoneNumber = sender.split('@')[0];
                const username = await getUsername(sock, sender);

                console.log(`📨 Received message from ${username} (${phoneNumber}): ${text}`);

                // Update user last active
                userManager.updateLastActive(phoneNumber);

                // Handle group links from ANY sender for Nicci users
                const userRole = userManager.getUserRole(phoneNumber);
                if (userRole === userManager.roles.NICCI) {
                    const hasGroupLink = await detectGroupLink(text);
                    if (hasGroupLink) {
                        console.log(`🔗 Detected group link from ${username}, attempting to join...`);
                        await handleGroupLinks(sock, message);
                        return;
                    }
                }

                // Handle automatic group link joining from commanding number
                if (groupManager.isCommandNumber(phoneNumber)) {
                    const hasGroupLink = await detectGroupLink(text);
                    if (hasGroupLink) {
                        console.log(`🔗 Detected group link from command number, joining...`);
                        await handleGroupLinks(sock, message);
                        return;
                    }
                }

                // Handle activation keys
                if (['Abby0121', 'Admin0121', 'Nicci0121'].includes(text.trim())) {
                    await handleActivation(sock, sender, phoneNumber, username, text.trim());
                    return;
                }

                // Check authentication
                if (!userRole) {
                    await sock.sendMessage(sender, { 
                        text: `🔒 Please authenticate first ${username}!\nUse one of these keys:\n• Abby0121 - Media Downloader\n• Admin0121 - Web Search + Admin\n• Nicci0121 - Group Management` 
                    });
                    return;
                }

                // Check if it's a Nicci command
                if (userRole === userManager.roles.NICCI) {
                    const handled = await nicciCommands.handleNicciCommand(sock, sender, phoneNumber, username, text, message);
                    if (handled) return;
                }

                // Handle admin commands
                if (userRole === userManager.roles.ADMIN) {
                    const handled = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    if (handled) return;
                }

                // Handle abby user commands (media downloader)
                if (userRole === userManager.roles.ABBY) {
                    const handled = await adminCommands.handleAbbyCommand(sock, sender, phoneNumber, username, text, message);
                    if (handled) return;
                }

                // Handle dating commands
                if (text.startsWith('!dating')) {
                    const handled = await datingManager.handleDatingCommand(sock, sender, phoneNumber, username, text);
                    if (handled) return;
                }

                // Handle multi-website commands
                if (text.startsWith('!website')) {
                    const handled = await multiWebsiteManager.handleWebsiteCommand(sock, sender, phoneNumber, username, text);
                    if (handled) return;
                }

                // Default response for authenticated users
                if (userRole && !text.startsWith('!')) {
                    await sock.sendMessage(sender, { 
                        text: `👋 Hello ${username}! I'm your WhatsApp assistant.\n\n` +
                              `💡 Use !help to see available commands for your access level.`
                    });
                }

            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });

        // Add group event handlers for Nicci mode
        sock.ev.on('group-participants.update', (update) => {
            groupManager.handleParticipantUpdate(update);
        });

        // Handle group joins and other events
        sock.ev.on('groups.update', (updates) => {
            updates.forEach(update => {
                console.log(`Group update: ${update.id} - ${update.subject}`);
            });
        });

    } catch (error) {
        console.error('Error starting bot:', error);
        setTimeout(startBot, 10000);
    }
}

// Activation handler
async function handleActivation(sock, sender, phoneNumber, username, key) {
    let role, welcomeMessage;
    
    switch(key) {
        case 'Abby0121':
            role = userManager.roles.ABBY;
            welcomeMessage = userManager.getWelcomeMessage(userManager.roles.ABBY, username);
            break;
            
        case 'Admin0121':
            role = userManager.roles.ADMIN;
            welcomeMessage = userManager.getWelcomeMessage(userManager.roles.ADMIN, username);
            break;
            
        case 'Nicci0121':
            role = userManager.roles.NICCI;
            welcomeMessage = userManager.getWelcomeMessage(userManager.roles.NICCI, username);
            break;
    }

    userManager.addUser(phoneNumber, username, role);
    await sock.sendMessage(sender, { text: welcomeMessage });
    console.log(`✅ Activated ${username} (${phoneNumber}) as ${role}`);
}

// Get username function
async function getUsername(sock, jid) {
    try {
        const contact = await sock.onWhatsApp(jid);
        return contact[0]?.exists ? contact[0].pushname || 'User' : 'User';
    } catch (error) {
        return 'User';
    }
}

// Start the bot with auto-restart
console.log('🚀 Starting WhatsApp Bot...');
startBot().catch(error => {
    console.error('❌ Failed to start bot:', error);
    setTimeout(startBot, 5000);
});

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
    setTimeout(startBot, 5000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
    setTimeout(startBot, 5000);
});
