const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const UserManager = require('./user-manager.js');
const EnhancedDownloader = require('./downloader.js');
const WebsiteScraper = require('./website-scraper.js');
const WebSearcher = require('./web-searcher.js');
const GroupManager = require('./group-manager.js');
const AdminCommands = require('./admin-commands.js');

// Initialize modules
const userManager = new UserManager();
const imageDownloader = new EnhancedDownloader();
const websiteScraper = new WebsiteScraper();
const webSearcher = new WebSearcher();
const groupManager = new GroupManager();
const adminCommands = new AdminCommands(userManager, imageDownloader, websiteScraper);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const sock = makeWASocket({ auth: state });

    // ... (connection handlers remain the same)

    sock.ev.on("messages.upsert", async (m) => {
        const message = m.messages[0];
        if (!message.message) return;
        
        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text || 
                    message.message.imageMessage?.caption || "";
        
        const sender = message.key.remoteJid;
        const phoneNumber = sender.split('@')[0];
        const username = await getUsername(sock, sender);

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

        // Check if it's an admin command first
        if (userRole === 'admin_user') {
            const handled = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
            if (handled) return;
        }

        // Route to appropriate handler
        if (userRole === 'abby_user') {
            await handleAbbyUser(sock, sender, phoneNumber, username, text, message);
        } else if (userRole === 'admin_user') {
            await handleAdminUser(sock, sender, phoneNumber, username, text, message);
        } else if (userRole === 'nicci_user') {
            await handleNicciUser(sock, sender, phoneNumber, username, text, message);
        }
    });

    // Admin User Handler - Has all Abby features + admin privileges
    async function handleAdminUser(sock, sender, phoneNumber, username, text, message) {
        // First try Abby commands
        if (text.startsWith('!search ')) {
            await handleSearch(sock, sender, phoneNumber, username, text);
        } else if (text.startsWith('!download ')) {
            await handleDownload(sock, sender, phoneNumber, username, text, true); // true = admin unlimited
        } else if (text === '!mystats') {
            await showUserStats(sock, sender, phoneNumber, username, true); // true = admin stats
        } else if (text === '!help') {
            await showAdminHelp(sock, sender, username);
        } else {
            await sock.sendMessage(sender, { 
                text: `👑 Hello Admin ${username}! Type !help for admin commands.` 
            });
        }
    }

    // Handle download with admin unlimited access
    async function handleDownload(sock, sender, phoneNumber, username, text, isAdmin = false) {
        const selection = parseInt(text.replace('!download ', '').trim());
        if (isNaN(selection) || selection < 1) {
            await sock.sendMessage(sender, { text: "❌ Please provide a valid number." });
            return;
        }

        const results = imageDownloader.getSearchResults(phoneNumber);
        if (!results || selection > results.length) {
            await sock.sendMessage(sender, { text: "❌ No search results found. Please search first." });
            return;
        }

        const selectedItem = results[selection - 1];
        const fileType = selectedItem.filename.includes('.mp4') ? 'videos' : 'images';

        // Admin has unlimited downloads, skip limit check
        if (!isAdmin && !userManager.canDownload(phoneNumber, fileType)) {
            // ... (limit check logic for non-admin users)
            return;
        }

        await sock.sendMessage(sender, { text: `📥 Downloading ${selectedItem.filename}...` });
        
        try {
            const result = await imageDownloader.downloadMedia(
                selectedItem.url, 
                selectedItem.filename
            );

            // Only increment usage for non-admin users
            if (!isAdmin) {
                userManager.incrementUsage(phoneNumber, fileType);
            }

            const remaining = isAdmin ? 'Unlimited' : userManager.getRemainingDownloads(phoneNumber, fileType);

            let successMessage = `✅ Download complete!\n`;
            successMessage += `📁: ${selectedItem.filename}\n`;
            if (result.dimensions) {
                successMessage += `📏: ${result.dimensions.width}x${result.dimensions.height}\n`;
            }
            successMessage += `📊 Remaining ${fileType}: ${remaining}\n`;
            successMessage += `💾: ${(result.size / 1024).toFixed(2)}KB`;

            if (isAdmin) {
                successMessage += `\n👑 Admin Privilege: Unlimited Downloads`;
            }

            await sock.sendMessage(sender, { text: successMessage });
        } catch (error) {
            await sock.sendMessage(sender, { text: `❌ Download failed: ${error.message}` });
        }
    }

    // Show admin-specific stats
    async function showUserStats(sock, sender, phoneNumber, username, isAdmin = false) {
        const userInfo = userManager.getUserInfo(phoneNumber);
        if (!userInfo) return;

        let statsText = `📊 ${username}'s Statistics\n`;
        if (isAdmin) statsText += `👑 ADMIN MODE\n\n`;

        statsText += `🎥 Videos: ${userInfo.usage.videos.used}/${userInfo.usage.videos.limit}\n`;
        statsText += `🖼️ Images: ${userInfo.usage.images.used}/${userInfo.usage.images.limit}\n`;
        
        if (isAdmin) {
            statsText += `⚡ Status: Unlimited Downloads\n`;
            statsText += `🎯 Admin Privileges: Active\n`;
        } else {
            statsText += `⏰ Resets in: ${getTimeRemaining(userInfo.usage.videos.resetTime)}\n`;
        }

        await sock.sendMessage(sender, { text: statsText });
    }

    // Show admin help
    async function showAdminHelp(sock, sender, username) {
        let helpText = `👑 Admin Help Menu for ${username}\n\n`;
        helpText += `🔍 !search <query> - Search website media\n`;
        helpText += `🌐 !websearch <query> - Search entire web\n`;
        helpText += `📥 !download <number> - Download any media\n`;
        helpText += `📊 !users - View all users\n`;
        helpText += `📋 !userinfo <phone> - User details\n`;
        helpText += `🔑 !genotp <phone> <plan> <days> - Generate OTP\n`;
        helpText += `🖥️ !sysinfo - System statistics\n`;
        helpText += `⚡ !modifylimits <phone> <videos> <images> - Change limits\n`;
        helpText += `🎯 !advanced <query> - Advanced search\n`;
        helpText += `📊 !mystats - Your statistics\n`;
        helpText += `❓ !help - This menu\n\n`;
        helpText += `⚡ ADMIN PRIVILEGES: Unlimited Downloads + Full System Access`;

        await sock.sendMessage(sender, { text: helpText });
    }

    // ... (other functions remain the same)
}

// Initialize and start bot
userManager.loadData().then(() => {
    console.log('User manager initialized with admin privileges');
    startBot().catch(console.error);
}).catch(console.error);
