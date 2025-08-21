const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const ImageDownloader = require('./downloader.js');

// Initialize image downloader
const imageDownloader = new ImageDownloader();

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
                text: "Hello from Abby Bot! Your device is paired and ready.\n\nAvailable commands:\n• !download image.jpg - Download specific image\n• !list - List downloaded images\n• !help - Show help" 
            });
        }

        // Download image command
        if (text.startsWith('!download ')) {
            const imageName = text.replace('!download ', '').trim();
            if (imageName) {
                try {
                    await sock.sendMessage(sender, { 
                        text: `📥 Downloading image: ${imageName}...` 
                    });
                    
                    const filePath = await imageDownloader.downloadImage(imageName);
                    
                    await sock.sendMessage(sender, { 
                        text: `✅ Image downloaded successfully!\n📁 Path: ${filePath}\n🌐 From: ${process.env.WEBSITE_URL}/${imageName}` 
                    });
                    
                } catch (error) {
                    await sock.sendMessage(sender, { 
                        text: `❌ Error downloading image: ${error.message}` 
                    });
                }
            }
        }

        // List downloaded images command
        if (text === '!list') {
            try {
                const images = await imageDownloader.listDownloadedImages();
                if (images.length > 0) {
                    await sock.sendMessage(sender, { 
                        text: `📂 Downloaded images (${images.length}):\n${images.join('\n')}` 
                    });
                } else {
                    await sock.sendMessage(sender, { 
                        text: "📂 No images downloaded yet." 
                    });
                }
            } catch (error) {
                await sock.sendMessage(sender, { 
                    text: `❌ Error listing images: ${error.message}` 
                });
            }
        }

        // Help command
        if (text === '!help') {
            await sock.sendMessage(sender, { 
                text: `🤖 ${process.env.BOT_NAME} Bot Help\n\nCommands:\n• !download filename.jpg - Download image from website\n• !list - Show downloaded images\n• !help - Show this help\n\nWebsite: ${process.env.WEBSITE_URL}` 
            });
        }
    });
}

// Initialize download directory on startup
imageDownloader.ensureDirectory().then(() => {
    console.log('Image downloader initialized');
}).catch(console.error);

startBot().catch(console.error);
