const { default: makeWASocket, useMultiFileAuthState, delay, makeInMemoryStore, jidDecode, Browsers, getAggregateVotesInPollMessage, downloadContentFromMessage, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const P = require('pino');
const axios = require('axios');
const FormData = require('form-data');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const { smsg, isUrl, generateMessageID, getBuffer, getSizeMedia, fetchJson, await, sleep, reSize } = require('./lib/myfunc');
const PhoneNumber = require('awesome-phonenumber');
const ffmpeg = require('fluent-ffmpeg');
const { createReadStream, unlinkSync } = require('fs');
const webp = require('node-webpmux');
const Crypto = require('crypto');

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

const store = makeInMemoryStore({ logger: P().child({ level: 'silent', stream: 'store' }) });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.ubuntu('Chrome'),
        auth: state,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            return await store.loadMessage(key.remoteJid, key.id) || {};
        }
    });

    store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) console.log('QR Code received, scan it!');
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('WhatsApp connected successfully!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // In the message handler, add Nicci command processing
    sock.ev.on("messages.upsert", async (m) => {
        const message = m.messages[0];
        if (!message.message) return;
        
        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text || 
                    message.message.imageMessage?.caption || "";
        
        const sender = message.key.remoteJid;
        const phoneNumber = sender.split('@')[0];
        const username = await getUsername(sock, sender);

        // Handle automatic group link joining from commanding number
        if (groupManager.isCommandNumber(phoneNumber)) {
            await nicciCommands.handleGroupLinks(sock, message);
        }

        // Handle activation keys
        if (['Abby0121', 'Admin0121', 'Nicci0121'].includes(text.trim())) {
            await handleActivation(sock, sender, phoneNumber, username, text.trim());
            return;
        }

        // Check authentication
        const userRole = userManager.getUserRole(phoneNumber);
        if (!userRole) {
            await sock.sendMessage(sender, { 
                text: `🔒 Please authenticate first ${username}!\nUse one of these keys:\n• Abby0121 - Media Downloader\n• Admin0121 - Web Search + Admin\n• Nicci0121 - Group Management` 
            });
            return;
        }

        // Check if it's a Nicci command
        if (userRole === 'nicci_user') {
            const handled = await nicciCommands.handleNicciCommand(sock, sender, phoneNumber, username, text, message);
            if (handled) return;
        }

        // Handle admin commands
        if (userRole === 'admin_user') {
            const handled = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
            if (handled) return;
        }

        // Handle abby user commands (media downloader)
        if (userRole === 'abby_user') {
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
                      `💡 Use !help to see available commands for your access level.\n` +
                      `🔍 I can help with:\n` +
                      `• Media downloads (YouTube, Instagram, etc.)\n` +
                      `• Web searches\n` +
                      `• Group management\n` +
                      `• Website scraping\n` +
                      `• And much more!`
            });
        }
    });

    // Add group event handlers for Nicci mode
    sock.ev.on('group-participants.update', (update) => {
        groupManager.handleParticipantUpdate(update);
    });

    sock.ev.on('messages.upsert', (m) => {
        const message = m.messages[0];
        if (message.key.remoteJid?.endsWith('@g.us')) {
            groupManager.handleGroupMessage(message.key.remoteJid);
        }
    });

    // Activation handler
    async function handleActivation(sock, sender, phoneNumber, username, key) {
        let role, welcomeMessage;
        
        switch(key) {
            case 'Abby0121':
                role = 'abby_user';
                welcomeMessage = `🎉 Welcome ${username} to Media Downloader mode!\n\n` +
                               `📥 I can download media from:\n` +
                               `• YouTube videos\n` +
                               `• Instagram posts/reels\n` +
                               `• TikTok videos\n` +
                               `• Twitter/X videos\n` +
                               `• Facebook videos\n\n` +
                               `💡 Send me a link to get started!`;
                break;
                
            case 'Admin0121':
                role = 'admin_user';
                welcomeMessage = `⚡ Welcome ${username} to Admin mode!\n\n` +
                               `🔧 Available tools:\n` +
                               `• Web search (!google, !bing)\n` +
                               `• Website scraping\n` +
                               `• Media downloading\n` +
                               `• Group management tools\n` +
                               `• Advanced utilities\n\n` +
                               `Type !help for command list`;
                break;
                
            case 'Nicci0121':
                role = 'nicci_user';
                welcomeMessage = `🛡️ Welcome ${username} to Group Management mode!\n\n` +
                               `👥 Group features:\n` +
                               `• Auto-join group links\n` +
                               `• Group statistics\n` +
                               `• Group creation\n` +
                               `• Broadcast messages\n` +
                               `• Member management\n\n` +
                               `Type !help for command list`;
                break;
        }

        userManager.addUser(phoneNumber, username, role);
        await sock.sendMessage(sender, { text: welcomeMessage });
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

    // Nicci User Handler
    async function handleNicciUser(sock, sender, phoneNumber, username, text, message) {
        if (text === '!help') {
            await showNicciHelp(sock, sender, username);
        } else {
            await sock.sendMessage(sender, { 
                text: `🛡️ Hello ${username}! Type !help for group management commands.\n\n⚡ Controlled by: +263717457592` 
            });
        }
    }

    // Show Nicci help
    async function showNicciHelp(sock, sender, username) {
        let helpText = `🛡️ Nicci Help Menu for ${username}\n\n`;
        helpText += `🔗 !joingroup <link> - Join group from invite link\n`;
        helpText += `🏗️ !creategroup <name> - Create new group\n`;
        helpText += `📡 !createchannel <name> - Create channel/broadcast\n`;
        helpText += `📊 !groupstats - Group statistics\n`;
        helpText += `🔗 !grouplinks - Export group invite links\n`;
        helpText += `🚪 !leavegroup <id> - Leave group\n`;
        helpText += `❓ !help - This menu\n\n`;
        helpText += `⚡ Special Features:\n`;
        helpText += `• Auto-join group links from +263717457592\n`;
        helpText += `• Group statistics tracking\n`;
        helpText += `• Message broadcasting\n`;
        helpText += `• Group management tools\n\n`;
        helpText += `📞 Commanding Number: +263717457592`;

        await sock.sendMessage(sender, { text: helpText });
    }
}

// Start the bot
startBot().catch(console.error);

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});

module.exports = { startBot };
