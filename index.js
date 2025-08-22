const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
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
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

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
        console.log(`🚀 Starting WhatsApp Bot (Attempt ${reconnectAttempts + 1})...`);
        
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
                
                if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delayTime = Math.min(5000 * reconnectAttempts, 30000); // Exponential backoff
                    setTimeout(() => {
                        console.log(`🔄 Reconnecting... (Attempt ${reconnectAttempts})`);
                        startBot();
                    }, delayTime);
                } else {
                    console.log('❌ Cannot reconnect - authentication error or max attempts reached');
                }
            } else if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0; // Reset on successful connection
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is now online and ready to receive messages');
                
                // Send keep-alive messages periodically
                startKeepAlive();
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

                // Handle activation keys (EXACT MATCH ONLY)
                const trimmedText = text.trim();
                if (['Abby0121', 'Admin0121', 'Nicci0121'].includes(trimmedText)) {
                    await handleActivation(sock, sender, phoneNumber, username, trimmedText);
                    return; // Stop processing after activation
                }

                // Get user role - if not activated, send activation message
                const userRole = userManager.getUserRole(phoneNumber);
                if (!userRole) {
                    await sock.sendMessage(sender, { 
                        text: `🔒 Please authenticate first ${username}!\n\nUse one of these EXACT activation keys:\n\n• Abby0121 - Media Downloader Mode\n• Admin0121 - Web Search + Admin Mode\n• Nicci0121 - Group Management Mode` 
                    });
                    return;
                }

                // Handle group links from Nicci users only
                if (userRole === userManager.roles.NICCI) {
                    const hasGroupLink = await detectGroupLink(text);
                    if (hasGroupLink) {
                        console.log(`🔗 Detected group link from ${username}, attempting to join...`);
                        await handleGroupLinks(sock, message);
                        return;
                    }
                }

                // Handle automatic group link joining from commanding number
                if (groupManager.isCommandNumber && groupManager.isCommandNumber(phoneNumber)) {
                    const hasGroupLink = await detectGroupLink(text);
                    if (hasGroupLink) {
                        console.log(`🔗 Detected group link from command number, joining...`);
                        await handleGroupLinks(sock, message);
                        return;
                    }
                }

                // Check if it's a command (starts with !)
                if (!text.startsWith('!')) {
                    // Ignore non-command messages from activated users
                    return;
                }

                // Handle Nicci commands
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

                // If no command was handled, send unknown command message
                await sock.sendMessage(sender, { 
                    text: `❌ Unknown command: ${text}\n\n💡 Use !help to see available commands for your mode.` 
                });

            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });

        // Add group event handlers for Nicci mode
        sock.ev.on('group-participants.update', (update) => {
            if (groupManager.handleParticipantUpdate) {
                groupManager.handleParticipantUpdate(update);
            }
        });

        // Handle group joins and other events
        sock.ev.on('groups.update', (updates) => {
            updates.forEach(update => {
                console.log(`Group update: ${update.id} - ${update.subject}`);
            });
        });

    } catch (error) {
        console.error('Error starting bot:', error);
        reconnectAttempts++;
        const delayTime = Math.min(5000 * reconnectAttempts, 30000);
        setTimeout(startBot, delayTime);
    }
}

// Keep the bot always online
function startKeepAlive() {
    setInterval(() => {
        if (isConnected && sock) {
            // Send a ping to keep connection alive
            sock.sendPresenceUpdate('available')
                .then(() => console.log('🫀 Keep-alive ping sent'))
                .catch(err => console.log('❌ Keep-alive failed:', err.message));
        }
    }, 60000); // Ping every 60 seconds
}

// Activation handler
async function handleActivation(sock, sender, phoneNumber, username, key) {
    let role, welcomeMessage, userManual;
    
    switch(key) {
        case 'Abby0121':
            role = userManager.roles.ABBY;
            welcomeMessage = userManager.getWelcomeMessage(userManager.roles.ABBY, username);
            userManual = `📖 ABBY MODE USER MANUAL 📖

👋 Welcome to Abby Mode - Media Downloader!

🎯 WHAT YOU CAN DO:
• Download media from websites
• Search for specific content
• Check your download limits
• Manage subscriptions

🔧 AVAILABLE COMMANDS:
• !search <query> - Search for media content
• !download <number> - Download selected media
• !mystats - Check your usage statistics
• !subscribe - View subscription plans
• !help - Show this help menu

📊 YOUR LIMITS:
• Videos: 5/13 hours remaining
• Images: 10/13 hours remaining

💎 UPGRADE OPTIONS:
• 1 Week Unlimited: 50¢
• 2 Weeks Unlimited: 75¢

⚡ TIP: Use !search first to find content, then !download with the result number.`;
            break;
            
        case 'Admin0121':
            role = userManager.roles.ADMIN;
            welcomeMessage = userManager.getWelcomeMessage(userManager.roles.ADMIN, username);
            userManual = `📖 ADMIN MODE USER MANUAL 📖

👑 Welcome to Admin Mode - Full System Access!

🎯 WHAT YOU CAN DO:
• Unlimited downloads from any source
• Web search capabilities
• User management
• OTP generation
• System statistics

🔧 AVAILABLE COMMANDS:
• !search <query> - Search website media
• !websearch <query> - Search entire web
• !download <number> - Download any media
• !users - View all system users
• !genotp <phone> <plan> <days> - Generate OTP codes
• !userinfo <phone> - Get user details
• !sysinfo - View system statistics
• !help - Show this help menu

⚡ ADMIN PRIVILEGES:
• Unlimited access to all features
• User management capabilities
• System monitoring tools
• OTP generation for subscriptions

🔐 SECURITY: Keep your admin credentials secure!`;
            break;
            
        case 'Nicci0121':
            role = userManager.roles.NICCI;
            welcomeMessage = userManager.getWelcomeMessage(userManager.roles.NICCI, username);
            userManual = `📖 NICCI MODE USER MANUAL 📖

🛡️ Welcome to Nicci Mode - Group Management!

🎯 WHAT YOU CAN DO:
• Auto-join group links
• Send messages to multiple groups
• Manage group participants
• Export group statistics
• Monitor group activity

🔧 AVAILABLE COMMANDS:
• !joingroup <link> - Join a group from invite link
• !creategroup <name> - Create a new group
• !createchannel <name> - Create a channel
• !groupstats - View group statistics
• !grouplinks - Export all group links
• !sendall <message> - Send message to all groups
• !help - Show this help menu

🌐 GROUP MANAGEMENT:
• Automatic group joining
• Mass messaging capabilities
• Participant management
• Link export functionality

⚡ CONTROLLED BY: +263717457592
🔒 SECURITY: Group management features are monitored.`;
            break;
    }

    userManager.addUser(phoneNumber, username, role);
    
    // Send welcome message
    await sock.sendMessage(sender, { text: welcomeMessage });
    
    // Send user manual after a short delay
    setTimeout(async () => {
        await sock.sendMessage(sender, { text: userManual });
    }, 1000);
    
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

// Add health check endpoint if running on web service
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('🤖 WhatsApp Bot is running!\nStatus: ' + (isConnected ? 'Connected' : 'Disconnected'));
});

server.listen(process.env.PORT || 3000, () => {
    console.log(`🌐 Health check server running on port ${process.env.PORT || 3000}`);
});
