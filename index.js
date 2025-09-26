const fs = require('fs');
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const express = require('express');

const GroupManager = require('./group-manager.js');

const ACTIVATION_KEY = 'Abbie911';
const CONSTANT_ADMINS = [
    '0775156210@s.whatsapp.net', 
    '27614159817@s.whatsapp.net', 
    '263717457592@s.whatsapp.net', 
    '263777627210@s.whatsapp.net'
];

let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const userActivations = new Map();
let groupManager = null;

const simpleLogger = {
    level: 'silent',
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (msg) => console.log('⚠️', msg),
    error: (msg) => console.log('❌', msg),
    fatal: (msg) => console.log('💀', msg),
    child: () => simpleLogger
};

if (typeof crypto === 'undefined') {
    global.crypto = require('crypto');
}

function cleanAuthFile() {
    const authFile = './auth_info.json';
    if (fs.existsSync(authFile)) {
        console.log('🗑️ Removing corrupted auth file...');
        try {
            fs.unlinkSync(authFile);
            console.log('✅ Auth file cleaned successfully');
        } catch (error) {
            console.log('❌ Error cleaning auth file:', error.message);
        }
    }
}

function activateUser(phoneNumber) {
    userActivations.set(phoneNumber, {
        activated: true,
        freeDownloads: 10,
        activationTime: new Date()
    });
    console.log(`✅ User activated: ${phoneNumber}`);
}

function isUserActivated(phoneNumber) {
    const user = userActivations.get(phoneNumber);
    return user && user.activated;
}

function isAdmin(sender) {
    return CONSTANT_ADMINS.includes(sender);
}

function initializeGroupManager() {
    if (!groupManager && sock) {
        console.log('🚀 Initializing Group Manager from external file...');
        try {
            groupManager = new GroupManager(sock);
            groupManager.start().then(() => {
                console.log('✅ External Group Manager started successfully!');
            }).catch(error => {
                console.log('❌ Failed to start external Group Manager:', error);
            });
        } catch (error) {
            console.log('❌ Error initializing external Group Manager:', error);
        }
    }
}

async function handleMessage(message) {
    if (!message.message) return;

    const sender = message.key.remoteJid;
    const phoneNumber = sender.split('@')[0];
    let text = '';

    if (message.message.conversation) {
        text = message.message.conversation;
    } else if (message.message.extendedTextMessage) {
        text = message.message.extendedTextMessage.text;
    }

    if (!text || !text.startsWith('.')) return;

    console.log(`📨 Message from ${phoneNumber} (Admin: ${isAdmin(sender)}): ${text}`);

    const admin = isAdmin(sender);
    const activated = isUserActivated(phoneNumber);

    if (!admin && !activated) {
        console.log(`🚫 Ignoring non-activated user: ${phoneNumber}`);
        const command = text.slice(1).split(' ')[0].toLowerCase();
        const allowedCommands = ['activate', 'help', 'status'];

        if (allowedCommands.includes(command)) {
            await handleBasicCommand(sock, sender, phoneNumber, text);
        }
        return;
    }

    try {
        await handleBasicCommand(sock, sender, phoneNumber, text);
    } catch (error) {
        console.log('Error handling message:', error);
        await sock.sendMessage(sender, {
            text: '❌ Error processing your command. Please try again.'
        });
    }
}

async function handleBasicCommand(sock, sender, phoneNumber, text) {
    const args = text.slice(1).split(' ');
    const command = args[0].toLowerCase();
    const admin = isAdmin(sender);
    const activated = isUserActivated(phoneNumber);

    console.log(`🔧 Processing command: ${command} from ${phoneNumber} (Admin: ${admin}, Activated: ${activated})`);

    if (command === 'activate') {
        if (args[1] === ACTIVATION_KEY) {
            activateUser(phoneNumber);
            await sock.sendMessage(sender, {
                text: '✅ Account activated successfully! You now have 10 free downloads.\n\nAvailable commands:\n.download [url] - Download from any website\n.yt [url] - YouTube download\n.ig [url] - Instagram download\n.tt [url] - TikTok download\n.help - Show all commands'
            });
        } else {
            await sock.sendMessage(sender, { 
                text: '❌ Invalid activation key!\n\nPlease use: .activate ' + ACTIVATION_KEY + '\nOr contact admin for assistance.'
            });
        }
        return;
    }

    if (command === 'help') {
        let helpText = `📋 *DOWNLOAD BOT COMMANDS* 📋\n\n`;
        helpText += `*FOR EVERYONE:*\n`;
        helpText += `.activate [key] - Activate your account\n`;
        helpText += `.help - Show this help message\n`;
        helpText += `.status - Check bot status\n\n`;
        helpText += `*AFTER ACTIVATION:*\n`;
        helpText += `.download [url] - Download from any website\n`;
        helpText += `.yt [url/query] - YouTube download\n`;
        helpText += `.ig [url] - Instagram download\n`;
        helpText += `.tt [url] - TikTok download\n`;
        helpText += `.fb [url] - Facebook download\n\n`;
        helpText += `*ADMIN COMMANDS:*\n`;
        helpText += `.users - Show active users\n`;
        helpText += `.stats - Show bot statistics\n`;
        helpText += `.groupstatus - Check group manager status\n`;

        await sock.sendMessage(sender, { text: helpText });
        return;
    }

    if (command === 'status') {
        const statusText = `🤖 *BOT STATUS*\n\n` +
                         `• Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}\n` +
                         `• Active Users: ${userActivations.size}\n` +
                         `• Group Manager: ${groupManager && groupManager.isRunning ? '✅ Running' : '❌ Stopped'}\n` +
                         `• Your Status: ${admin ? '👑 Admin' : activated ? '✅ Activated' : '❌ Not activated'}\n` +
                         `• Downloads Left: ${activated ? '10' : '0'}\n\n` +
                         `Server: ${isConnected ? '🟢 Online' : '🔴 Offline'}`;

        await sock.sendMessage(sender, { text: statusText });
        return;
    }

    if (command === 'groupstatus') {
        if (!admin) {
            await sock.sendMessage(sender, { 
                text: '❌ Admin only command. Contact admin for assistance.'
            });
            return;
        }

        const groupStatus = groupManager ? 
            `• Status: ${groupManager.isRunning ? '✅ Running' : '❌ Stopped'}\n` +
            `• Active Tasks: ${groupManager.intervals ? groupManager.intervals.length + groupManager.timeouts.length : 'N/A'}\n` +
            `• External File: ✅ Loaded` :
            '❌ Group Manager not initialized';

        await sock.sendMessage(sender, {
            text: `👥 *GROUP MANAGER STATUS*\n\n${groupStatus}`
        });
        return;
    }

    if (command === 'users' || command === 'stats') {
        if (!admin) {
            await sock.sendMessage(sender, { 
                text: '❌ Admin only command. Contact admin for assistance.'
            });
            return;
        }

        if (command === 'users') {
            const usersList = Array.from(userActivations.entries())
                .map(([phone, data]) => `• ${phone} - Activated: ${new Date(data.activationTime).toLocaleDateString()}`)
                .join('\n');

            await sock.sendMessage(sender, {
                text: `👥 *ACTIVE USERS* (${userActivations.size})\n\n${usersList || 'No active users yet.'}`
            });
            return;
        }

        if (command === 'stats') {
            await sock.sendMessage(sender, {
                text: `📊 *BOT STATISTICS*\n\n` +
                      `• Total Active Users: ${userActivations.size}\n` +
                      `• Connection Status: ${isConnected ? '✅' : '❌'}\n` +
                      `• Group Manager: ${groupManager ? '✅' : '❌'}\n` +
                      `• Uptime: ${process.uptime().toFixed(0)}s\n` +
                      `• Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`
            });
            return;
        }
    }

    if (!admin && !activated) {
        await sock.sendMessage(sender, {
            text: '❌ Please activate your account to use this command!\n\nUse: .activate ' + ACTIVATION_KEY + '\nOr contact admin for assistance.'
        });
        return;
    }

    switch (command) {
        case 'download':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .download [url]\nExample: .download https://example.com/video.mp4'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `⏳ Starting download from: ${args[1]}\nThis may take a few moments...`
            });
            break;

        case 'yt':
        case 'youtube':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .yt [url or search query]\nExample: .yt https://youtube.com/watch?v=abc123'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `🎥 Processing YouTube request: ${args.slice(1).join(' ')}...`
            });
            break;

        case 'ig':
        case 'instagram':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .ig [url]\nExample: .ig https://instagram.com/p/abc123'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `📸 Processing Instagram request: ${args[1]}...`
            });
            break;

        case 'tt':
        case 'tiktok':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .tt [url]\nExample: .tt https://tiktok.com/@user/video/123'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `🎵 Processing TikTok request: ${args[1]}...`
            });
            break;

        case 'fb':
        case 'facebook':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .fb [url]\nExample: .fb https://facebook.com/video/abc123'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `👥 Processing Facebook request: ${args[1]}...`
            });
            break;

        default:
            await sock.sendMessage(sender, { 
                text: '❌ Unknown command. Use .help to see available commands.'
            });
    }
}

async function connectToWhatsApp() {
    try {
        console.log('🔄 Starting WhatsApp connection with single file auth...');
        
        cleanAuthFile();
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { state, saveState } = useSingleFileAuthState('./auth_info.json');
        const { version } = await fetchLatestBaileysVersion();

        console.log(`🔗 Using WA v${version.join('.')}`);

        sock = makeWASocket({
            version,
            logger: simpleLogger,
            printQRInTerminal: true,
            auth: state,
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            maxIdleTimeMs: 60000,
            maxRetries: 3,
            emitOwnEvents: true,
            defaultQueryTimeoutMs: 0,
            transactionOpts: {
                maxCommitRetries: 3,
                delayBetweenTriesMs: 1000
            }
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('📱 Scan the QR code above with your WhatsApp');
            }
            
            if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                console.log('✅ WhatsApp connected successfully!');
                initializeGroupManager();
            }
            
            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                
                console.log(`🔌 Connection closed. Status: ${statusCode || 'unknown'}`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('❌ Device logged out, cleaning auth file...');
                    cleanAuthFile();
                    return;
                }

                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = Math.min(10000, reconnectAttempts * 2000);
                    console.log(`🔄 Reconnecting in ${delay/1000}s... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(connectToWhatsApp, delay);
                } else {
                    console.log('❌ Max reconnection attempts reached');
                    cleanAuthFile();
                }
            }
            
            if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            }
        });

        sock.ev.on('creds.update', saveState);

        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                if (msg.key.remoteJid === 'status@broadcast') continue;
                try {
                    await handleMessage(msg);
                } catch (error) {
                    console.log('Error handling message:', error);
                }
            }
        });

        sock.ev.on('call', (call) => {
            console.log('📞 Incoming call ignored');
        });

    } catch (error) {
        console.log('❌ Connection setup failed:', error.message);
        cleanAuthFile();
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = 5000;
            console.log(`🔄 Retrying connection in ${delay/1000}s... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(connectToWhatsApp, delay);
        }
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connected: isConnected,
        activeUsers: userActivations.size,
        groupManagerActive: groupManager ? groupManager.isRunning : false,
        externalGroupManager: true,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'WhatsApp Download Bot',
        version: '2.0.0',
        status: 'running',
        activationRequired: true,
        adminCount: CONSTANT_ADMINS.length,
        groupManager: groupManager ? 'active' : 'inactive',
        externalGroupManager: true
    });
});

app.get('/users', (req, res) => {
    if (req.query.key !== ACTIVATION_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const users = Array.from(userActivations.entries()).map(([phone, data]) => ({
        phone,
        activated: data.activated,
        activationTime: data.activationTime,
        freeDownloads: data.freeDownloads
    }));
    
    res.json({ totalUsers: users.length, users });
});

async function start() {
    console.log('🚀 Starting WhatsApp Download Bot with Single File Auth...');
    console.log('🔑 Activation Key:', ACTIVATION_KEY);
    console.log('👑 Admin Users:', CONSTANT_ADMINS.length);
    console.log('💾 Using single file authentication system');
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Server running on port ${PORT}`);
        console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
        console.log(`👥 Users API: http://0.0.0.0:${PORT}/users?key=${ACTIVATION_KEY}`);
    });

    await connectToWhatsApp();
}

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (groupManager) groupManager.stop();
    if (sock) sock.end();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM...');
    if (groupManager) groupManager.stop();
    if (sock) sock.end();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.log('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

start();