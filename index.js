const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Crypto polyfill for Render
if (typeof crypto === 'undefined') {
    global.crypto = require('crypto');
}

const { useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');

// Config
const ACTIVATION_KEY = 'Abbie911';
const CONSTANT_ADMINS = [
    '0775156210@s.whatsapp.net', 
    '27614159817@s.whatsapp.net', 
    '263717457592@s.whatsapp.net', 
    '263777627210@s.whatsapp.net'
];

// Group Manager Configuration
const CHANNELS = ['music', 'entertainment', 'news'];
const ZIM_COMEDIANS = ['Carl Joshua', 'Doc Vikela', 'Q Dube', 'Long John'];
const SA_COMEDIANS = ['Trevor Noah', 'Loyiso Gola', 'Celeste Ntuli', 'Kagiso Lediga'];
const SATURDAY_SHOWS = ['Idols SA', 'The Voice', 'SA Got Talent', 'Dancing with the Stars'];
const NEWS_SOURCES = ['BBC Africa', 'CNN Africa', 'Al Jazeera', 'SABC News'];
const CHART_SOURCES = ['Billboard', 'Apple Music', 'Spotify', 'YouTube Charts'];

const HYPING_QUOTES = [
    "🔥 Stay focused and never give up! 🔥",
    "💪 Your potential is endless! Keep pushing! 💪",
    "🚀 Great things never come from comfort zones! 🚀",
    "🌟 Believe you can and you're halfway there! 🌟",
    "🎯 Success is walking from failure to failure with no loss of enthusiasm! 🎯"
];

const MUSIC_SCHEDULE = {
    'Monday': [['06:00-09:00', 'Afrobeats'], ['09:00-12:00', 'House'], ['12:00-15:00', 'Hip Hop'], ['15:00-18:00', 'Dancehall'], ['18:00-21:00', 'RnB'], ['21:00-24:00', 'Gospel']],
    'Tuesday': [['06:00-09:00', 'Reggae'], ['09:00-12:00', 'Jazz'], ['12:00-15:00', 'Soul'], ['15:00-18:00', 'Pop'], ['18:00-21:00', 'Electronic'], ['21:00-24:00', 'Classical']],
    'Wednesday': [['06:00-09:00', 'Amapiano'], ['09:00-12:00', 'Gqom'], ['12:00-15:00', 'Afro House'], ['15:00-18:00', 'Kwaito'], ['18:00-21:00', 'Maskandi'], ['21:00-24:00', 'Traditional']],
    'Thursday': [['06:00-09:00', 'Rock'], ['09:00-12:00', 'Metal'], ['12:00-15:00', 'Alternative'], ['15:00-18:00', 'Indie'], ['18:00-21:00', 'Punk'], ['21:00-24:00', 'Blues']],
    'Friday': [['06:00-09:00', 'Dance'], ['09:00-12:00', 'EDM'], ['12:00-15:00', 'Trance'], ['15:00-18:00', 'Techno'], ['18:00-21:00', 'Dubstep'], ['21:00-24:00', 'Party Hits']],
    'Saturday': [['06:00-12:00', 'Weekend Mix'], ['12:00-18:00', 'Chart Toppers'], ['18:00-24:00', 'Throwbacks']],
    'Sunday': [['06:00-12:00', 'Chill Vibes'], ['12:00-18:00', 'Relaxing Mix'], ['18:00-24:00', 'Sunday Worship']]
};

// State
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const userActivations = new Map();
let groupManager = null;

// Simple logger
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

// Group Manager Class
class GroupManager {
    constructor(sock) {
        this.sock = sock;
        this.isRunning = false;
        this.intervals = [];
        this.timeouts = [];
        this.downloadDir = path.join(__dirname, 'downloads');
        this.ensureDownloadDir();
    }

    ensureDownloadDir() {
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }
    }

    async downloadYouTubeAudio(url) {
        try {
            const filename = `audio_${Date.now()}.mp3`;
            const filepath = path.join(this.downloadDir, filename);
            
            const command = `yt-dlp -x --audio-format mp3 -o "${filepath}" "${url}"`;
            await execAsync(command);
            
            return fs.existsSync(filepath) ? filepath : null;
        } catch (error) {
            console.error('Error downloading audio:', error);
            return null;
        }
    }

    async downloadYouTubeVideo(url) {
        try {
            const filename = `video_${Date.now()}.mp4`;
            const filepath = path.join(this.downloadDir, filename);
            
            const command = `yt-dlp -f best -o "${filepath}" "${url}"`;
            await execAsync(command);
            
            return fs.existsSync(filepath) ? filepath : null;
        } catch (error) {
            console.error('Error downloading video:', error);
            return null;
        }
    }

    async searchYouTube(query, maxResults = 5) {
        try {
            const command = `yt-dlp --flat-playlist "ytsearch${maxResults}:${query}" -j`;
            const { stdout } = await execAsync(command);
            
            const videos = stdout.trim().split('\n')
                .filter(line => line.trim())
                .map(line => {
                    try {
                        const data = JSON.parse(line);
                        return `https://www.youtube.com/watch?v=${data.id}`;
                    } catch (e) {
                        return null;
                    }
                })
                .filter(url => url);
            
            return videos;
        } catch (error) {
            console.error('Error searching YouTube:', error);
            return [];
        }
    }

    async postToGroup(groupId, content, filePath = null) {
        try {
            if (!this.sock) return false;

            console.log(`📢 Posting to group: ${content}`);
            
            if (filePath && fs.existsSync(filePath)) {
                // Send as audio if it's MP3
                if (filePath.endsWith('.mp3')) {
                    await this.sock.sendMessage(groupId, {
                        audio: fs.readFileSync(filePath),
                        mimetype: 'audio/mpeg',
                        fileName: 'music.mp3'
                    });
                } else {
                    // Send as video
                    await this.sock.sendMessage(groupId, {
                        video: fs.readFileSync(filePath),
                        mimetype: 'video/mp4',
                        fileName: 'video.mp4'
                    });
                }
            } else {
                // Send text message
                await this.sock.sendMessage(groupId, { text: content });
            }
            
            return true;
        } catch (error) {
            console.error('Error posting to group:', error);
            return false;
        }
    }

    getCurrentGenre() {
        const now = new Date();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
        const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        
        const schedule = MUSIC_SCHEDULE[currentDay];
        if (!schedule) return null;
        
        for (const [timeRange, genre] of schedule) {
            const [start, end] = timeRange.split('-');
            if (currentTime >= start && currentTime <= end) {
                return genre;
            }
        }
        
        return null;
    }

    async downloadAndPostMusic() {
        try {
            const currentGenre = this.getCurrentGenre();
            if (!currentGenre) return;

            const searchQuery = `${currentGenre} 2024 latest hits`;
            const videos = await this.searchYouTube(searchQuery, 1);

            for (const videoUrl of videos) {
                const audioFile = await this.downloadYouTubeAudio(videoUrl);
                if (audioFile) {
                    // You need to replace with actual group IDs
                    const groupId = "123456789-123456@g.us"; // Example group ID
                    await this.postToGroup(
                        groupId, 
                        `🎵 ${currentGenre} Track 🎵\nEnjoy this latest ${currentGenre} hit!`,
                        audioFile
                    );
                    
                    // Clean up after posting
                    setTimeout(() => {
                        if (fs.existsSync(audioFile)) {
                            fs.unlinkSync(audioFile);
                        }
                    }, 30000);
                    break;
                }
            }
        } catch (error) {
            console.error('Error in music posting:', error);
        }
    }

    async postComedianContent() {
        try {
            const allComedians = [...ZIM_COMEDIANS, ...SA_COMEDIANS];
            const comedian = allComedians[new Date().getDate() % allComedians.length];
            
            const videos = await this.searchYouTube(`${comedian} comedy`, 1);
            for (const videoUrl of videos) {
                const videoFile = await this.downloadYouTubeVideo(videoUrl);
                if (videoFile) {
                    const groupId = "123456789-123456@g.us";
                    await this.postToGroup(
                        groupId,
                        `😂 ${comedian} - Comedy Gold! 😂\nLaugh out loud with ${comedian}!`,
                        videoFile
                    );
                    
                    setTimeout(() => {
                        if (fs.existsSync(videoFile)) {
                            fs.unlinkSync(videoFile);
                        }
                    }, 60000);
                    break;
                }
            }
        } catch (error) {
            console.error('Error posting comedian content:', error);
        }
    }

    async postHypingQuotes() {
        try {
            const quote = HYPING_QUOTES[new Date().getHours() % HYPING_QUOTES.length];
            const groupId = "123456789-123456@g.us";
            await this.postToGroup(groupId, `💫 MOTIVATION 💫\n\n${quote}\n\nKeep shining! ✨`);
        } catch (error) {
            console.error('Error posting quotes:', error);
        }
    }

    scheduleTasks() {
        // Schedule hyping quotes every 30 minutes
        const quoteInterval = setInterval(() => {
            this.postHypingQuotes();
        }, 30 * 60 * 1000);
        this.intervals.push(quoteInterval);

        // Schedule music every 2 hours (reduced frequency)
        const musicInterval = setInterval(() => {
            this.downloadAndPostMusic();
        }, 2 * 60 * 60 * 1000);
        this.intervals.push(musicInterval);

        // Schedule comedian content twice daily
        this.scheduleDailyTask('12:00', () => this.postComedianContent());
        this.scheduleDailyTask('20:00', () => this.postComedianContent());

        console.log('✅ Group Manager tasks scheduled');
    }

    scheduleDailyTask(time, task) {
        const now = new Date();
        const [hours, minutes] = time.split(':');
        const scheduledTime = new Date();
        scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        if (scheduledTime < now) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        const delay = scheduledTime.getTime() - now.getTime();
        
        const timeout = setTimeout(() => {
            task();
            // Reschedule for next day
            this.scheduleDailyTask(time, task);
        }, delay);
        
        this.timeouts.push(timeout);
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️ Group Manager is already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Starting Group Manager...');
        
        // Initial posts
        await this.postHypingQuotes();
        
        // Schedule all tasks
        this.scheduleTasks();
        
        console.log('✅ Group Manager started successfully!');
    }

    stop() {
        this.isRunning = false;
        
        // Clear all intervals and timeouts
        this.intervals.forEach(clearInterval);
        this.timeouts.forEach(clearTimeout);
        this.intervals = [];
        this.timeouts = [];
        
        console.log('🛑 Group Manager stopped');
    }
}

// QR Code Display
function showQR(qr) {
    console.log('\n'.repeat(3));
    console.log('═'.repeat(50));
    console.log('📱 WHATSAPP QR CODE - SCAN WITH YOUR PHONE');
    console.log('═'.repeat(50));
    qrcode.generate(qr, { small: true });
    console.log('═'.repeat(50));
    console.log('1. WhatsApp → Settings → Linked Devices');
    console.log('2. Tap "Link a Device"');
    console.log('3. Scan the QR code above');
    console.log('═'.repeat(50));
    console.log('\n');
}

// User Management
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

// Initialize Group Manager when WhatsApp connects
function initializeGroupManager() {
    if (!groupManager && sock) {
        console.log('🚀 Initializing Group Manager...');
        groupManager = new GroupManager(sock);
        groupManager.start().then(() => {
            console.log('✅ Group Manager started successfully!');
        }).catch(error => {
            console.log('❌ Failed to start Group Manager:', error);
        });
    }
}

// Message Handler
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

    // Ignore messages without text or not starting with command prefix
    if (!text || !text.startsWith('.')) return;

    console.log(`📨 Message from ${phoneNumber}: ${text}`);

    // Check if user is admin or activated
    const admin = isAdmin(sender);
    const activated = isUserActivated(phoneNumber);

    // Always process admin messages, ignore non-activated non-admin messages
    if (!admin && !activated) {
        console.log(`🚫 Ignoring non-activated user: ${phoneNumber}`);

        // Only respond if it's an activation attempt or help request
        const command = text.slice(1).split(' ')[0].toLowerCase();
        const allowedCommands = ['activate', 'help', 'status'];

        if (allowedCommands.includes(command)) {
            await handleBasicCommand(sock, sender, phoneNumber, text);
        } else {
            await sock.sendMessage(sender, {
                text: '❌ Please activate your account first!\n\nUse: .activate [key]\nActivation key: ' + ACTIVATION_KEY
            });
        }
        return;
    }

    // Process the message for admins or activated users
    try {
        await handleBasicCommand(sock, sender, phoneNumber, text);
    } catch (error) {
        console.log('Error handling message:', error);
        await sock.sendMessage(sender, {
            text: '❌ Error processing your command. Please try again.'
        });
    }
}

// Basic command handler
async function handleBasicCommand(sock, sender, phoneNumber, text) {
    const args = text.slice(1).split(' ');
    const command = args[0].toLowerCase();
    const admin = isAdmin(sender);
    const activated = isUserActivated(phoneNumber);

    console.log(`🔧 Processing command: ${command} from ${phoneNumber}`);

    // Activation command - available to everyone
    if (command === 'activate') {
        if (args[1] === ACTIVATION_KEY) {
            activateUser(phoneNumber);
            await sock.sendMessage(sender, {
                text: '✅ Account activated successfully! You now have 10 free downloads.'
            });
        } else {
            await sock.sendMessage(sender, { 
                text: '❌ Invalid activation key! Use: .activate ' + ACTIVATION_KEY
            });
        }
        return;
    }

    // Help command - available to everyone
    if (command === 'help') {
        let helpText = `📋 *BOT COMMANDS* 📋\n\n`;
        helpText += `*FOR EVERYONE:*\n`;
        helpText += `.activate [key] - Activate your account\n`;
        helpText += `.help - Show this help message\n`;
        helpText += `.status - Check bot status\n\n`;
        helpText += `*AFTER ACTIVATION:*\n`;
        helpText += `.download [url] - Download from any website\n`;
        helpText += `.yt [url] - YouTube download\n`;
        helpText += `.ig [url] - Instagram download\n`;

        await sock.sendMessage(sender, { text: helpText });
        return;
    }

    // Status command - available to everyone
    if (command === 'status') {
        const statusText = `🤖 *BOT STATUS*\n\n` +
                         `• Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}\n` +
                         `• Active Users: ${userActivations.size}\n` +
                         `• Your Status: ${admin ? '👑 Admin' : activated ? '✅ Activated' : '❌ Not activated'}`;

        await sock.sendMessage(sender, { text: statusText });
        return;
    }

    // Check if user is activated for premium commands
    if (!admin && !activated) {
        await sock.sendMessage(sender, {
            text: '❌ Please activate your account! Use: .activate ' + ACTIVATION_KEY
        });
        return;
    }

    // Premium commands for activated users and admins
    switch (command) {
        case 'download':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .download [url]'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `⏳ Starting download from: ${args[1]}`
            });
            break;

        case 'yt':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Usage: .yt [url]'
                });
                return;
            }
            await sock.sendMessage(sender, {
                text: `🎥 Processing YouTube: ${args[1]}`
            });
            break;

        default:
            await sock.sendMessage(sender, { 
                text: '❌ Unknown command. Use .help'
            });
    }
}

// Connection Manager
class ConnectionManager {
    constructor() {
        this.isConnecting = false;
    }

    async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            // Ensure auth directory exists
            if (!fs.existsSync('auth_info_baileys')) {
                fs.mkdirSync('auth_info_baileys', { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
            const { version } = await fetchLatestBaileysVersion();

            console.log('🔗 Connecting to WhatsApp...');

            const { default: makeWASocket } = await import('@whiskeysockets/baileys');

            sock = makeWASocket({
                version,
                logger: simpleLogger,
                printQRInTerminal: false,
                auth: state,
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true
            });

            // Handle connection events
            sock.ev.on('connection.update', (update) => {
                const { connection, qr } = update;

                if (qr) {
                    showQR(qr);
                }

                if (connection === 'open') {
                    this.handleSuccessfulConnection();
                }

                if (connection === 'close') {
                    this.handleDisconnection(update);
                }
            });

            // Handle credentials
            sock.ev.on('creds.update', saveCreds);

            // Handle messages
            sock.ev.on('messages.upsert', async ({ messages }) => {
                const msg = messages[0];
                if (msg.key.remoteJid === 'status@broadcast') return;

                try {
                    await handleMessage(msg);
                } catch (error) {
                    console.log('Error handling message:', error);
                }
            });

        } catch (error) {
            console.log('❌ Connection error:', error.message);
            this.isConnecting = false;
        }
    }

    handleSuccessfulConnection() {
        isConnected = true;
        reconnectAttempts = 0;
        this.isConnecting = false;
        console.log('✅ WhatsApp connected successfully!');
        
        // Initialize Group Manager as soon as WhatsApp connects
        initializeGroupManager();
    }

    handleDisconnection(update) {
        isConnected = false;
        this.isConnecting = false;

        // Stop group manager when disconnected
        if (groupManager) {
            groupManager.stop();
            groupManager = null;
        }

        const { lastDisconnect } = update;
        if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(10000 * reconnectAttempts, 60000);
                console.log(`🔄 Reconnecting in ${delay/1000}s...`);
                setTimeout(() => this.connect(), delay);
            } else {
                console.log('❌ Max reconnection attempts reached');
            }
        } else {
            console.log('❌ Device logged out, please scan QR code again');
            if (fs.existsSync('auth_info_baileys')) {
                fs.rmSync('auth_info_baileys', { recursive: true });
            }
        }
    }
}

// Web Server
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connected: isConnected,
        activeUsers: userActivations.size,
        groupManagerActive: !!groupManager
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'WhatsApp Bot',
        status: 'running',
        activationRequired: true
    });
});

// Start function
async function start() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        console.log('🔑 Activation Key:', ACTIVATION_KEY);
        console.log('👑 Admin Users:', CONSTANT_ADMINS.length);

        // Start web server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 Server running on port ${PORT}`);
        });

        // Start WhatsApp connection
        const connectionManager = new ConnectionManager();
        await connectionManager.connect();

    } catch (error) {
        console.log('❌ Failed to start:', error);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    if (groupManager) groupManager.stop();
    if (sock) sock.end();
    process.exit(0);
});

// Start the application
start();