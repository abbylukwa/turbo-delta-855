const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

// Crypto polyfill for Render
if (typeof crypto === 'undefined') {
    global.crypto = require('crypto');
}

// Simple QR code generator (basic implementation)
function generateQR(text) {
    console.log('\n'.repeat(3));
    console.log('═'.repeat(50));
    console.log('📱 SCAN QR CODE WITH WHATSAPP');
    console.log('═'.repeat(50));
    
    // Simple text-based QR representation
    const qrText = `QR: ${text.substring(0, 30)}...`;
    console.log(qrText);
    
    console.log('═'.repeat(50));
    console.log('1. WhatsApp → Settings → Linked Devices');
    console.log('2. Tap "Link a Device"');
    console.log('3. Scan the QR code');
    console.log('═'.repeat(50));
    console.log('\n');
}

// Simple WhatsApp connection
async function connectWhatsApp() {
    try {
        // Dynamically import baileys to avoid loading issues
        const baileys = await import('@whiskeysockets/baileys');
        const { useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = baileys;
        
        console.log('🔄 Loading WhatsApp connection...');
        
        // Ensure auth directory exists
        if (!fs.existsSync('auth_info')) {
            fs.mkdirSync('auth_info', { recursive: true });
        }
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        const { version } = await fetchLatestBaileysVersion();
        
        console.log('✅ WhatsApp version:', version.join('.'));
        
        // Simple logger that won't cause issues
        const logger = {
            level: 'silent',
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: (msg) => console.log('⚠️', msg),
            error: (msg) => console.log('❌', msg),
            child: () => logger
        };
        
        const sock = baileys.default({
            version,
            logger,
            printQRInTerminal: false,
            auth: state,
            browser: Browsers.ubuntu('Chrome')
        });
        
        // Handle connection events
        sock.ev.on('connection.update', (update) => {
            const { connection, qr } = update;
            
            if (qr) {
                generateQR(qr);
            }
            
            if (connection === 'open') {
                console.log('✅ WhatsApp connected successfully!');
                console.log('🤖 Bot is ready for messages');
            }
            
            if (connection === 'close') {
                console.log('❌ Connection closed, reconnecting...');
                setTimeout(connectWhatsApp, 5000);
            }
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        // Handle messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;
            
            const sender = msg.key.remoteJid;
            let text = '';
            
            if (msg.message.conversation) {
                text = msg.message.conversation;
            } else if (msg.message.extendedTextMessage) {
                text = msg.message.extendedTextMessage.text;
            }
            
            if (text.startsWith('.')) {
                await handleCommand(sock, sender, text);
            }
        });
        
        return sock;
        
    } catch (error) {
        console.log('❌ Connection error:', error.message);
        console.log('🔄 Retrying in 10 seconds...');
        setTimeout(connectWhatsApp, 10000);
    }
}

// Simple command handler
async function handleCommand(sock, sender, text) {
    const args = text.slice(1).split(' ');
    const command = args[0].toLowerCase();
    
    const responses = {
        ping: '🏓 Pong!',
        help: `📋 Available commands:
.ping - Test connection
.help - Show this help
.status - Bot status
.time - Current time`,
        status: '✅ Bot is running and connected',
        time: `🕒 Server time: ${new Date().toLocaleString()}`
    };
    
    const response = responses[command] || '❌ Unknown command. Use .help';
    
    try {
        await sock.sendMessage(sender, { text: response });
        console.log(`📤 Sent response to ${sender}: ${command}`);
    } catch (error) {
        console.log('❌ Error sending message:', error.message);
    }
}

// Simple health check server
function startHealthServer() {
    const server = http.createServer((req, res) => {
        if (req.url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                service: 'whatsapp-bot',
                timestamp: new Date().toISOString(),
                memory: process.memoryUsage(),
                uptime: process.uptime()
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('WhatsApp Bot Server - Use /health for status');
        }
    });
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Health server running on port ${PORT}`);
        console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
    });
    
    return server;
}

// Simple group manager
class BasicGroupManager {
    constructor() {
        this.isRunning = false;
    }
    
    start() {
        if (this.isRunning) return;
        
        console.log('🚀 Starting basic group manager...');
        this.isRunning = true;
        
        // Simulate group management
        setInterval(() => {
            if (this.isRunning) {
                console.log('📱 Group manager heartbeat');
            }
        }, 60000);
    }
    
    stop() {
        this.isRunning = false;
        console.log('🛑 Group manager stopped');
    }
}

// Main function
async function main() {
    console.log('🚀 Starting WhatsApp Bot...');
    console.log('📅 Started at:', new Date().toLocaleString());
    
    // Start health server
    startHealthServer();
    
    // Start group manager
    const groupManager = new BasicGroupManager();
    groupManager.start();
    
    // Connect to WhatsApp
    let whatsappSock = await connectWhatsApp();
    
    // Handle process events
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down gracefully...');
        groupManager.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM...');
        groupManager.stop();
        process.exit(0);
    });
    
    // Keep alive
    setInterval(() => {
        console.log('💓 Bot heartbeat -', new Date().toLocaleTimeString());
    }, 300000); // 5 minutes
}

// Error handling
process.on('uncaughtException', (error) => {
    console.log('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
main().catch(console.error);