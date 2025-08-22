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
const downloader = new Downloader(); // Initialize downloader first
const nicciCommands = new NicciCommands(userManager, groupManager);
const webSearcher = new WebSearcher();
const websiteScraper = new WebsiteScraper();
const multiWebsiteManager = new MultiWebsiteManager();
const datingManager = new DatingManager();

// Initialize command handlers
const adminCommands = new AdminCommands(userManager, groupManager, downloader, webSearcher, websiteScraper, multiWebsiteManager, datingManager);

// Store for reconnection
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Helper function to format file size
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
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

                // Get user role - if not activated, DO NOT SEND ANY MESSAGE
                const userRole = userManager.getUserRole(phoneNumber);
                if (!userRole) {
                    // Do not send any message to unactivated users
                    console.log(`❌ Unactivated user ${phoneNumber} tried to use commands`);
                    return;
                }

                // Handle download commands for all activated users
                if (text.startsWith('!download') || text.startsWith('!dl')) {
                    await handleDownloadCommand(sock, sender, text, username);
                    return;
                }

                // Handle media listing commands
                if (text.startsWith('!media') || text.startsWith('!files')) {
                    await handleMediaListCommand(sock, sender, text);
                    return;
                }

                // Handle Nicci commands first (for group management)
                if (userRole === userManager.roles.NICCI) {
                    const handled = await nicciCommands.handleNicciCommand(sock, sender, phoneNumber, username, text, message);
                    if (handled) return;
                }

                // Handle group links from Nicci users only
                if (userRole === userManager.roles.NICCI) {
                    const hasGroupLink = await nicciCommands.detectGroupLink(text);
                    if (hasGroupLink) {
                        console.log(`🔗 Detected group link from ${username}, attempting to join...`);
                        await nicciCommands.handleGroupLinks(sock, message);
                        return;
                    }
                }

                // Handle automatic group link joining from commanding number
                if (groupManager.isCommandNumber && groupManager.isCommandNumber(phoneNumber)) {
                    const hasGroupLink = await nicciCommands.detectGroupLink(text);
                    if (hasGroupLink) {
                        console.log(`🔗 Detected group link from command number, joining...`);
                        await nicciCommands.handleGroupLinks(sock, message);
                        return;
                    }
                }

                // Check if it's a command (starts with !)
                if (!text.startsWith('!')) {
                    // Ignore non-command messages from activated users
                    return;
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

// Download command handler
async function handleDownloadCommand(sock, sender, text, username) {
    const urlMatch = text.match(/!download\s+(.+)/) || text.match(/!dl\s+(.+)/);
    if (!urlMatch) {
        await sock.sendMessage(sender, { text: "Usage: !download <url> [filename]" });
        return;
    }
    
    const parts = urlMatch[1].split(' ');
    const url = parts[0];
    const filename = parts[1] || `download_${Date.now()}`;
    
    try {
        await sock.sendMessage(sender, { text: "⬇️ Downloading file..." });
        const fileInfo = await downloader.downloadMedia(url, filename);
        
        await sock.sendMessage(sender, { 
            text: `✅ Download complete!\n📁 File: ${fileInfo.path}\n📊 Size: ${formatFileSize(fileInfo.size)}${fileInfo.dimensions ? `\n📐 Dimensions: ${fileInfo.dimensions.width}x${fileInfo.dimensions.height}` : ''}${fileInfo.duration ? `\n⏱️ Duration: ${Math.round(fileInfo.duration)}s` : ''}`
        });
        
        // Notify admin if a regular user downloaded something
        const phoneNumber = sender.split('@')[0];
        const userRole = userManager.getUserRole(phoneNumber);
        if (userRole !== userManager.roles.ADMIN) {
            await adminCommands.notifyAdmins(sock, `📥 ${username} downloaded: ${filename} (${formatFileSize(fileInfo.size)})`);
        }
    } catch (error) {
        await sock.sendMessage(sender, { 
            text: `❌ Download failed: ${error.message}`
        });
    }
}

// Media list command handler
async function handleMediaListCommand(sock, sender, text) {
    const filter = {};
    if (text.includes('image')) filter.type = 'image';
    if (text.includes('video')) filter.type = 'video';
    if (text.includes('audio')) filter.type = 'audio';
    
    try {
        const files = await downloader.listDownloads(filter);
        
        if (files.length === 0) {
            await sock.sendMessage(sender, { text: "No media files found." });
            return;
        }
        
        let response = `📁 Media Files (${files.length}):\n\n`;
        files.slice(0, 10).forEach((file, index) => {
            response += `${index + 1}. ${file.name} (${formatFileSize(file.size)})\n`;
        });
        
        if (files.length > 10) {
            response += `\n... and ${files.length - 10} more files`;
        }
        
        await sock.sendMessage(sender, { text: response });
    } catch (error) {
        await sock.sendMessage(sender, { 
            text: `❌ Error listing files: ${error.message}`
        });
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
    
    // Send ONLY the activation success message (no user manual)
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

// Add health check endpoint if running on web service
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('🤖 WhatsApp Bot is running!\nStatus: ' + (isConnected ? 'Connected' : 'Disconnected'));
});

server.listen(process.env.PORT || 3000, () => {
    console.log(`🌐 Health check server running on port ${process.env.PORT || 3000}`);
});
