const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const UserManager = require('./user-manager.js');
const EnhancedDownloader = require('./downloader.js');
const WebsiteScraper = require('./website-scraper.js');
const WebSearcher = require('./web-searcher.js');
const GroupManager = require('./group-manager.js');

// Initialize all modules
const userManager = new UserManager();
const imageDownloader = new EnhancedDownloader();
const websiteScraper = new WebsiteScraper();
const webSearcher = new WebSearcher();
const groupManager = new GroupManager();

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

        // Check if message is an activation key
        if (['Abby0121', 'Admin0121', 'Nicci0121'].includes(text.trim())) {
            const activationKey = text.trim();
            if (userManager.authenticateUser(phoneNumber, activationKey)) {
                const role = userManager.getUserRole(phoneNumber);
                const welcomeMessage = userManager.getWelcomeMessage(role);
                
                await sock.sendMessage(sender, { text: welcomeMessage });
            } else {
                await sock.sendMessage(sender, { 
                    text: "❌ Invalid activation key. Please use a valid key." 
                });
            }
            return;
        }

        // Check if user is authenticated
        const userRole = userManager.getUserRole(phoneNumber);
        if (!userRole) {
            await sock.sendMessage(sender, { 
                text: "🔒 Please authenticate first using your activation key.\nAvailable keys: Abby0121, Admin0121, Nicci0121" 
            });
            return;
        }

        // Abby0121 - Website Media Downloader
        if (userRole === 'abby_user') {
            await handleAbbyUser(sock, sender, phoneNumber, text);
        }

        // Admin0121 - Free Web Searcher
        else if (userRole === 'admin_user') {
            await handleAdminUser(sock, sender, phoneNumber, text);
        }

        // Nicci0121 - Group Manager
        else if (userRole === 'nicci_user') {
            await handleNicciUser(sock, sender, phoneNumber, text, message);
        }
    });

    // Handle Abby user commands
    async function handleAbbyUser(sock, sender, phoneNumber, text) {
        if (text.startsWith('!search ')) {
            const query = text.replace('!search ', '').trim();
            if (query) {
                await sock.sendMessage(sender, { text: "🔍 Searching website for media..." });
                
                const results = await websiteScraper.scanWebsiteForImages();
                const filteredResults = results.filter(item => 
                    item.filename.toLowerCase().includes(query.toLowerCase()) ||
                    item.alt.toLowerCase().includes(query.toLowerCase())
                ).slice(0, 3);
                
                if (filteredResults.length > 0) {
                    imageDownloader.storeSearchResults(phoneNumber, filteredResults);
                    
                    let resultText = "📋 Search Results:\n\n";
                    filteredResults.forEach((result, index) => {
                        resultText += `${index + 1}. ${result.filename}\n`;
                        resultText += `   📝: ${result.alt}\n`;
                        resultText += `   🌐: ${result.url}\n\n`;
                    });
                    resultText += "💡 Reply with !download <number> to download";
                    
                    await sock.sendMessage(sender, { text: resultText });
                } else {
                    await sock.sendMessage(sender, { text: "❌ No results found for your search." });
                }
            }
        }
        // ... other Abby commands
    }

    // Handle Admin user commands
    async function handleAdminUser(sock, sender, phoneNumber, text) {
        if (text.startsWith('!websearch ')) {
            const query = text.replace('!websearch ', '').trim();
            if (query) {
                await sock.sendMessage(sender, { text: "🌐 Searching the web for media..." });
                
                const results = await webSearcher.searchWeb(query, 'all', 3);
                
                if (results.length > 0) {
                    imageDownloader.storeSearchResults(phoneNumber, results);
                    
                    let resultText = "🌍 Web Search Results:\n\n";
                    results.forEach((result, index) => {
                        resultText += `${index + 1}. ${result.title}\n`;
                        resultText += `   📁: ${result.type}\n`;
                        resultText += `   🌐: ${result.url}\n`;
                        if (result.duration) resultText += `   ⏱️: ${result.duration}\n`;
                        resultText += `   🔗: ${result.source}\n\n`;
                    });
                    resultText += "💡 Reply with !download <number> to download";
                    
                    await sock.sendMessage(sender, { text: resultText });
                } else {
                    await sock.sendMessage(sender, { text: "❌ No web results found." });
                }
            }
        }
        // ... other Admin commands
    }

    // Handle Nicci user commands
    async function handleNicciUser(sock, sender, phoneNumber, text, message) {
        if (text === '!groupinfo') {
            if (message.key.remoteJid.endsWith('@g.us')) {
                try {
                    const groupInfo = await groupManager.getGroupInfo(message.key.remoteJid, sock);
                    let infoText = `📊 Group Info:\n\n`;
                    infoText += `🏷️ Name: ${groupInfo.subject}\n`;
                    infoText += `👥 Members: ${groupInfo.participants.length}\n`;
                    infoText += `👑 Owner: ${groupInfo.owner}\n`;
                    infoText += `🆔 ID: ${groupInfo.id}\n`;
                    if (groupInfo.description) infoText += `📝 Description: ${groupInfo.description}\n`;
                    
                    await sock.sendMessage(sender, { text: infoText });
                } catch (error) {
                    await sock.sendMessage(sender, { text: "❌ Error getting group info." });
                }
            } else {
                await sock.sendMessage(sender, { text: "❌ This command only works in groups." });
            }
        }
        // ... other Nicci commands
    }
}

// Initialize on startup
imageDownloader.ensureDirectory().then(() => {
    console.log('Enhanced downloader initialized');
}).catch(console.error);

startBot().catch(console.error);
