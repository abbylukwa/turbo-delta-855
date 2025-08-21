const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const UserManager = require('./user-manager.js');
const EnhancedDownloader = require('./downloader.js');
const WebsiteScraper = require('./website-scraper.js');
const WebSearcher = require('./web-searcher.js');
const GroupManager = require('./group-manager.js');

// Initialize modules
const userManager = new UserManager();
const imageDownloader = new EnhancedDownloader();
const websiteScraper = new WebsiteScraper();
const webSearcher = new WebSearcher();
const groupManager = new GroupManager();

// Store user sessions
const userSessions = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const sock = makeWASocket({ auth: state });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("Scan QR code to connect:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === "close") {
            console.log("Connection closed, reconnecting...");
            startBot();
        } else if (connection === "open") {
            console.log("Bot connected successfully!");
        }
    });

    sock.ev.on("creds.update", saveCreds);

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
                text: `🔒 Please authenticate first ${username}!\nUse one of these keys:\n• Abby0121 - Media Downloader\n• Admin0121 - Web Search\n• Nicci0121 - Group Management` 
            });
            return;
        }

        // Route to appropriate handler
        if (userRole === 'abby_user') {
            await handleAbbyUser(sock, sender, phoneNumber, username, text, message);
        } else if (userRole === 'admin_user') {
            await handleAdminUser(sock, sender, phoneNumber, username, text);
        } else if (userRole === 'nicci_user') {
            await handleNicciUser(sock, sender, phoneNumber, username, text, message);
        }
    });

    // Get username from contact
    async function getUsername(sock, jid) {
        try {
            const contact = await sock.onWhatsApp(jid.split('@')[0]);
            return contact[0]?.name || 'User';
        } catch (error) {
            return 'User';
        }
    }

    // Handle activation
    async function handleActivation(sock, sender, phoneNumber, username, activationKey) {
        if (userManager.authenticateUser(phoneNumber, activationKey)) {
            const role = userManager.getUserRole(phoneNumber);
            const welcomeMessage = userManager.getWelcomeMessage(role, username);
            await sock.sendMessage(sender, { text: welcomeMessage });
        } else {
            await sock.sendMessage(sender, { text: "❌ Invalid activation key." });
        }
    }

    // Abby0121 User Handler
    async function handleAbbyUser(sock, sender, phoneNumber, username, text, message) {
        if (text.startsWith('!search ')) {
            await handleSearch(sock, sender, phoneNumber, username, text);
        } else if (text.startsWith('!download ')) {
            await handleDownload(sock, sender, phoneNumber, username, text);
        } else if (text === '!mystats') {
            await showUserStats(sock, sender, phoneNumber, username);
        } else if (text === '!subscribe') {
            await showSubscriptionOptions(sock, sender, phoneNumber, username);
        } else if (text.startsWith('!otp ')) {
            await handleOTP(sock, sender, phoneNumber, username, text);
        } else if (text === '!help') {
            await showHelp(sock, sender, username, 'abby');
        } else {
            await sock.sendMessage(sender, { 
                text: `👋 Hello ${username}! Type !help to see available commands.` 
            });
        }
    }

    // Handle search command
    async function handleSearch(sock, sender, phoneNumber, username, text) {
        const query = text.replace('!search ', '').trim();
        if (!query) {
            await sock.sendMessage(sender, { text: "❌ Please provide a search query." });
            return;
        }

        await sock.sendMessage(sender, { text: `🔍 Searching for "${query}"...` });
        
        const results = await websiteScraper.scanWebsiteForImages();
        const filteredResults = results.filter(item => 
            item.filename.toLowerCase().includes(query.toLowerCase()) ||
            item.alt.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3);

        if (filteredResults.length > 0) {
            imageDownloader.storeSearchResults(phoneNumber, filteredResults);
            
            let resultText = `📋 Results for "${query}":\n\n`;
            filteredResults.forEach((result, index) => {
                resultText += `${index + 1}. ${result.filename}\n`;
                resultText += `   📝: ${result.alt}\n`;
                resultText += `   🌐: ${result.url}\n\n`;
            });
            resultText += "💡 Reply with !download <number> to download";

            await sock.sendMessage(sender, { text: resultText });
        } else {
            await sock.sendMessage(sender, { text: "❌ No results found. Try different keywords." });
        }
    }

    // Handle download command
    async function handleDownload(sock, sender, phoneNumber, username, text) {
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

        // Check download limits
        if (!userManager.canDownload(phoneNumber, fileType)) {
            const remaining = userManager.getRemainingDownloads(phoneNumber, fileType);
            const subStatus = userManager.getSubscriptionStatus(phoneNumber);
            
            let message = `❌ Download limit reached! \n`;
            message += `📊 Used: ${userManager.getUserInfo(phoneNumber).usage[fileType].used}/${userManager.getUserInfo(phoneNumber).usage[fileType].limit}\n`;
            
            if (!subStatus || !subStatus.isActive) {
                message += `\n💎 Upgrade to unlimited downloads!\nUse !subscribe for premium plans.`;
            }
            
            await sock.sendMessage(sender, { text: message });
            return;
        }

        await sock.sendMessage(sender, { text: `📥 Downloading ${selectedItem.filename}...` });
        
        try {
            const result = await imageDownloader.downloadMedia(
                selectedItem.url, 
                selectedItem.filename
            );

            // Increment usage count
            userManager.incrementUsage(phoneNumber, fileType);
            const remaining = userManager.getRemainingDownloads(phoneNumber, fileType);

            let successMessage = `✅ Download complete!\n`;
            successMessage += `📁: ${selectedItem.filename}\n`;
            if (result.dimensions) {
                successMessage += `📏: ${result.dimensions.width}x${result.dimensions.height}\n`;
            }
            successMessage += `📊 Remaining ${fileType}: ${remaining}\n`;
            successMessage += `💾: ${(result.size / 1024).toFixed(2)}KB`;

            await sock.sendMessage(sender, { text: successMessage });
        } catch (error) {
            await sock.sendMessage(sender, { text: `❌ Download failed: ${error.message}` });
        }
    }

    // Show user statistics
    async function showUserStats(sock, sender, phoneNumber, username) {
        const userInfo = userManager.getUserInfo(phoneNumber);
        if (!userInfo) return;

        let statsText = `📊 ${username}'s Statistics\n\n`;
        statsText += `🎥 Videos: ${userInfo.usage.videos.used}/${userInfo.usage.videos.limit}\n`;
        statsText += `🖼️ Images: ${userInfo.usage.images.used}/${userInfo.usage.images.limit}\n`;
        statsText += `⏰ Resets in: ${getTimeRemaining(userInfo.usage.videos.resetTime)}\n\n`;

        if (userInfo.subscription) {
            if (userInfo.subscription.isActive) {
                statsText += `💎 Premium Subscription Active!\n`;
                statsText += `📅 Plan: ${userInfo.subscription.plan}\n`;
                statsText += `⏳ Expires in: ${userInfo.subscription.daysRemaining} days\n`;
                statsText += `🎉 Unlimited downloads!`;
            } else {
                statsText += `💡 Subscription expired. Use !subscribe to renew.`;
            }
        } else {
            statsText += `💡 No active subscription. Use !subscribe for unlimited downloads!`;
        }

        await sock.sendMessage(sender, { text: statsText });
    }

    // Show subscription options
    async function showSubscriptionOptions(sock, sender, phoneNumber, username) {
        const paymentInfo = userManager.getPaymentInfo('2weeks');
        
        let subText = `💎 Subscription Plans for ${username}\n\n`;
        subText += `1️⃣ 1 Week Unlimited - 50¢\n`;
        subText += `2️⃣ 2 Weeks Unlimited - 75¢\n\n`;
        subText += `💳 Payment Methods:\n`;
        subText += `• EcoCash: ${paymentInfo.ecoCash}\n`;
        subText += `• InBucks: ${paymentInfo.inBucks}\n`;
        subText += `• South Africa: ${paymentInfo.southAfrica}\n\n`;
        subText += `📋 After payment:\n`;
        subText += `1. Send screenshot to admin\n`;
        subText += `2. Admin will send OTP code\n`;
        subText += `3. Use !otp <code> to activate\n\n`;
        subText += `👨‍💼 Admins: ${userManager.adminNumbers.join(', ')}`;

        await sock.sendMessage(sender, { text: subText });
    }

    // Handle OTP activation
    async function handleOTP(sock, sender, phoneNumber, username, text) {
        const otpCode = text.replace('!otp ', '').trim().toUpperCase();
        const otpData = userManager.validateOTP(otpCode, phoneNumber);

        if (otpData) {
            const subscription = userManager.activateSubscription(
                phoneNumber, 
                otpData.plan, 
                otpData.duration
            );

            await sock.sendMessage(sender, { 
                text: `🎉 Subscription activated ${username}!\n\n📅 Plan: ${subscription.plan}\n⏰ Expires: ${subscription.expiresAt.toLocaleDateString()}\n🎊 Enjoy unlimited downloads!` 
            });
        } else {
            await sock.sendMessage(sender, { 
                text: `❌ Invalid OTP code ${username}.\n💡 Contact admin for a valid code.` 
            });
        }
    }

    // Show help
    async function showHelp(sock, sender, username, role) {
        let helpText = `🤖 Help Menu for ${username}\n\n`;
        
        if (role === 'abby') {
            helpText += `🔍 !search <query> - Search media\n`;
            helpText += `📥 !download <number> - Download selected\n`;
            helpText += `📊 !mystats - Your usage statistics\n`;
            helpText += `💎 !subscribe - Premium plans\n`;
            helpText += `🔑 !otp <code> - Activate subscription\n`;
            helpText += `❓ !help - This menu\n\n`;
            helpText += `📞 Admins: ${userManager.adminNumbers.join(', ')}`;
        }

        await sock.sendMessage(sender, { text: helpText });
    }

    // Get time remaining
    function getTimeRemaining(futureDate) {
        const now = new Date();
        const diff = futureDate - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }
}

// Initialize and start bot
userManager.loadData().then(() => {
    console.log('User manager initialized');
    startBot().catch(console.error);
}).catch(console.error);
