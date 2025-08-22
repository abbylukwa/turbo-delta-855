const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const UserManager = require('./user-manager.js');
const GroupManager = require('./group-manager.js');
const NicciCommands = require('./nicci-commands.js');
const AdminCommands = require('./admin-commands.js');
const Downloader = require('./downloader.js');
const WebSearcher = require('./web-searcher.js');
const WebsiteScraper = require('./website-scraper.js');
const MultiWebsiteManager = require('./multi-website-manager.js');
const DatingManager = require('./dating-manager.js');

const userManager = new UserManager();
const groupManager = new GroupManager();
const downloader = new Downloader();
const webSearcher = new WebSearcher();
const websiteScraper = new WebsiteScraper();
const multiWebsiteManager = new MultiWebsiteManager();
const datingManager = new DatingManager();

const nicciCommands = new NicciCommands(userManager, groupManager);
const adminCommands = new AdminCommands(userManager, groupManager, downloader, webSearcher, websiteScraper, multiWebsiteManager, datingManager);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        printQRInTerminal: true,
        browser: Browsers.ubuntu('Chrome'),
        auth: state,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
    });

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

    sock.ev.on("messages.upsert", async (m) => {
        const message = m.messages[0];
        if (!message.message) return;
        
        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text || 
                    message.message.imageMessage?.caption || "";
        
        const sender = message.key.remoteJid;
        const phoneNumber = sender.split('@')[0];
        const username = await getUsername(sock, sender);

        if (groupManager.isCommandNumber(phoneNumber)) {
            await nicciCommands.handleGroupLinks(sock, message);
        }

        if (['Abby0121', 'Admin0121', 'Nicci0121'].includes(text.trim())) {
            await handleActivation(sock, sender, phoneNumber, username, text.trim());
            return;
        }

        const userRole = userManager.getUserRole(phoneNumber);
        if (!userRole) {
            await sock.sendMessage(sender, { 
                text: `🔒 Please authenticate first ${username}!\nUse one of these keys:\n• Abby0121 - Media Downloader\n• Admin0121 - Web Search + Admin\n• Nicci0121 - Group Management` 
            });
            return;
        }


        if (userRole === 'nicci_user') {
            const handled = await nicciCommands.handleNicciCommand(sock, sender, phoneNumber, username, text, message);
            if (handled) return;
        }

        if (userRole === 'admin_user') {
            const handled = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
            if (handled) return;
        }

        if (userRole === 'abby_user') {
            const handled = await adminCommands.handleAbbyCommand(sock, sender, phoneNumber, username, text, message);
            if (handled) return;
        }

        if (text.startsWith('!dating')) {
            const handled = await datingManager.handleDatingCommand(sock, sender, phoneNumber, username, text);
            if (handled) return;
        }

        if (text.startsWith('!website')) {
            const handled = await multiWebsiteManager.handleWebsiteCommand(sock, sender, phoneNumber, username, text);
            if (handled) return;
        }

        if (userRole && !text.startsWith('!')) {
            await sock.sendMessage(sender, { 
                text: `👋 Hello ${username}! I'm your WhatsApp assistant.\n\n` +
                      `💡 Use !help to see available commands for your access level.`
            });
        }
    });

    sock.ev.on('group-participants.update', (update) => {
        groupManager.handleParticipantUpdate(update);
    });

    async function handleActivation(sock, sender, phoneNumber, username, key) {
        let role, welcomeMessage;
        
        switch(key) {
            case 'Abby0121':
                role = 'abby_user';
                welcomeMessage = `🎉 Welcome ${username} to Media Downloader mode!\n\n` +
                               `📥 I can download media from various platforms\n\n` +
                               `💡 Send me a link to get started!`;
                break;
                
            case 'Admin0121':
                role = 'admin_user';
                welcomeMessage = `⚡ Welcome ${username} to Admin mode!\n\n` +
                               `🔧 Available tools:\n` +
                               `• Web search\n` +
                               `• Website scraping\n` +
                               `• Media downloading\n` +
                               `• Group management\n\n` +
                               `Type !help for command list`;
                break;
                
            case 'Nicci0121':
                role = 'nicci_user';
                welcomeMessage = `🛡️ Welcome ${username} to Group Management mode!\n\n` +
                               `👥 Group features:\n` +
                               `• Auto-join group links\n` +
                               `• Group statistics\n` +
                               `• Group creation\n\n` +
                               `Type !help for command list`;
                break;
        }

        userManager.addUser(phoneNumber, username, role);
        await sock.sendMessage(sender, { text: welcomeMessage });
    }

    async function getUsername(sock, jid) {
        try {
            const contact = await sock.onWhatsApp(jid);
            return contact[0]?.exists ? contact[0].pushname || 'User' : 'User';
        } catch (error) {
            return 'User';
        }
    }
}

startBot().catch(console.error);

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});
