const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const ImageDownloader = require('./downloader.js');
const WebsiteScraper = require('./website-scraper.js');

// Initialize modules
const imageDownloader = new ImageDownloader();
const websiteScraper = new WebsiteScraper();

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

        // Activation command
        if (text === process.env.ACTIVATION_KEY) {
            console.log("Received activation code, responding...");
            await sock.sendMessage(sender, { 
                text: `🤖 Hello from ${process.env.BOT_NAME}! Your device is paired and ready.\n\n📋 Available commands:\n• !available - Show available images on website\n• !download image.jpg - Download specific image\n• !mydownloads - Show your downloaded images\n• !delete image.jpg - Delete downloaded image\n• !help - Show help menu` 
            });
        }

        // Show available images command
        if (text === '!available' || text === '!images') {
            try {
                await sock.sendMessage(sender, { 
                    text: "🔍 Scanning website for available images..." 
                });

                const availableImages = await websiteScraper.scanWebsiteForImages();
                
                if (availableImages.length > 0) {
                    let messageText = `📸 Available Images (${availableImages.length}):\n\n`;
                    
                    availableImages.forEach((image, index) => {
                        messageText += `${index + 1}. ${image.filename}\n`;
                        messageText += `   📝: ${image.alt}\n`;
                        messageText += `   🌐: ${image.url}\n\n`;
                    });
                    
                    messageText += "💡 Use !download filename.jpg to download any image";
                    
                    // Split long messages to avoid WhatsApp limits
                    if (messageText.length > 4000) {
                        const chunks = messageText.match(/[\s\S]{1,4000}/g) || [];
                        for (const chunk of chunks) {
                            await sock.sendMessage(sender, { text: chunk });
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } else {
                        await sock.sendMessage(sender, { text: messageText });
                    }
                } else {
                    await sock.sendMessage(sender, { 
                        text: "❌ No images found on the website." 
                    });
                }
            } catch (error) {
                await sock.sendMessage(sender, { 
                    text: `❌ Error scanning website: ${error.message}` 
                });
            }
        }

        // Download image command
        if (text.startsWith('!download ')) {
            const imageName = text.replace('!download ', '').trim();
            if (imageName) {
                try {
                    await sock.sendMessage(sender, { 
                        text: `📥 Downloading: ${imageName}...` 
                    });
                    
                    const result = await imageDownloader.downloadImage(imageName);
                    
                    let successMessage = `✅ Download successful!\n📁: ${result.path}`;
                    if (result.dimensions) {
                        successMessage += `\n📏: ${result.dimensions.width}x${result.dimensions.height}`;
                    }
                    if (result.size) {
                        successMessage += `\n💾: ${(result.size / 1024).toFixed(2)}KB`;
                    }
                    
                    await sock.sendMessage(sender, { text: successMessage });
                    
                } catch (error) {
                    await sock.sendMessage(sender, { 
                        text: `❌ Download failed: ${error.message}\n💡 Use !available to see valid filenames` 
                    });
                }
            }
        }

        // Show downloaded images command
        if (text === '!mydownloads' || text === '!downloads') {
            try {
                const downloadedImages = await imageDownloader.listDownloadedImages();
                
                if (downloadedImages.length > 0) {
                    let messageText = `📂 Your Downloads (${downloadedImages.length}):\n\n`;
                    
                    downloadedImages.forEach((image, index) => {
                        messageText += `${index + 1}. ${image.name}\n`;
                        if (image.dimensions) {
                            messageText += `   📏: ${image.dimensions.width}x${image.dimensions.height}\n`;
                        }
                        if (image.size) {
                            messageText += `   💾: ${(image.size / 1024).toFixed(2)}KB\n`;
                        }
                        messageText += `   🕒: ${image.modified.toLocaleString()}\n\n`;
                    });
                    
                    await sock.sendMessage(sender, { text: messageText });
                } else {
                    await sock.sendMessage(sender, { 
                        text: "📂 You haven't downloaded any images yet.\n💡 Use !available to see available images" 
                    });
                }
            } catch (error) {
                await sock.sendMessage(sender, { 
                    text: `❌ Error listing downloads: ${error.message}` 
                });
            }
        }

        // Help command
        if (text === '!help') {
            const helpText = `🤖 ${process.env.BOT_NAME} Bot Help\n\n📋 Commands:\n• !available - Show available images on website\n• !download filename.jpg - Download specific image\n• !mydownloads - Show your downloaded images\n• !delete image.jpg - Delete downloaded image\n• !help - Show this help\n\n🌐 Website: ${process.env.WEBSITE_URL}\n📁 Downloads: ${process.env.DOWNLOAD_PATH}`;
            
            await sock.sendMessage(sender, { text: helpText });
        }
    });
}

// Initialize on startup
imageDownloader.ensureDirectory().then(() => {
    console.log('Image downloader initialized');
}).catch(console.error);

startBot().catch(console.error);
