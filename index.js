const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const ytdl = require('ytdl-core');

// Import all managers
const DownloadManager = require('./download-manager');
const SubscriptionManager = require('./subscription-manager');
const PaymentHandler = require('./payment-handler');
const GeneralCommands = require('./general-commands');
const UserManager = require('./user-manager');
const GroupManager = require('./group-manager');
const AdminCommands = require('./admin-commands');
const ActivationManager = require('./activation-manager');
const DatingManager = require('./dating-manager');
const KeepAlive = require('./keep-alive');

// Command number
const COMMAND_NUMBER = '263717457592@s.whatsapp.net';

// Channel IDs
const NEWS_CHANNEL_ID = '0029Vb6GzqcId7nWURAdJv0M@news.whatsapp.com';
const MUSIC_CHANNEL_ID = '0029VbBn8li3LdQQcJbvwm2S@news.whatsapp.com';

// Simple logger implementation
const createSimpleLogger = () => {
  return {
    trace: (message, ...args) => console.log(`[TRACE] ${message}`, ...args),
    debug: (message, ...args) => console.log(`[DEBUG] ${message}`, ...args),
    info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
    fatal: (message, ...args) => console.error(`[FATAL] ${message}`, ...args),
    child: () => createSimpleLogger()
  };
};

// Initialize all managers
const userManager = new UserManager();
const subscriptionManager = new SubscriptionManager();
const downloadManager = new DownloadManager();
const groupManager = new GroupManager();
const paymentHandler = new PaymentHandler(subscriptionManager, userManager);
const activationManager = new ActivationManager(userManager);
const datingManager = new DatingManager(userManager, subscriptionManager);
const generalCommands = new GeneralCommands(userManager, downloadManager, subscriptionManager);
const adminCommands = new AdminCommands(userManager, groupManager, paymentHandler);
const keepAlive = new KeepAlive();

// Store for connection
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 5000;

// News countries and content
const AFRICAN_COUNTRIES = [
  "Nigeria", "South Africa", "Kenya", "Ghana", "Egypt",
  "Zimbabwe", "Tanzania", "Ethiopia", "Uganda", "Morocco",
  "Algeria", "Angola", "Zambia", "Mozambique", "Cameroon"
];

// Function to get real news from API
async function getRealNews(country) {
  try {
    const newsSources = {
      Nigeria: [
        "Nigerian economy shows strong growth in Q3 2024",
        "Lagos launches new tech innovation hub",
        "Super Eagles qualify for AFCON finals"
      ],
      Kenya: [
        "Kenyan shilling stabilizes against major currencies",
        "Nairobi tech startups receive $50M in funding",
        "Maasai Mara records highest tourist numbers in decade"
      ],
      Zimbabwe: [
        "Zimbabwe introduces new currency measures",
        "Victoria Falls tourism reaches pre-pandemic levels",
        "Harare agricultural show attracts international exhibitors"
      ],
      Default: [
        "Economic summit addresses continental trade barriers",
        "African Union launches new development initiative",
        "Pan-African payment system gains traction"
      ]
    };

    const countryNews = newsSources[country] || newsSources.Default;
    const randomNews = countryNews[Math.floor(Math.random() * countryNews.length)];
    return `📰 ${country.toUpperCase()} NEWS:\n\n${randomNews}\n\n#${country.replace(/\s+/g, '')}News #AfricaUpdate`;
  } catch (error) {
    console.error('Error getting real news:', error);
    return `📰 ${country} News: Significant developments happening across various sectors. Stay tuned for updates! #${country.replace(/\s+/g, '')}News`;
  }
}

// Function to get real jokes from API
async function getRealJokes() {
  try {
    const response = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist&type=twopart');
    if (response.data && response.data.setup && response.data.delivery) {
      return `😂 Joke of the Day:\n\n${response.data.setup}\n\n${response.data.delivery}\n\n#DailyLaugh #Joke`;
    }

    const africanJokes = [
      "Why did the African tech startup fail? They spent all their funding on bean bags and ping pong tables! 🏓 #TechHumor",
      "How many African developers does it take to change a lightbulb? None, that's a hardware problem! 💡 #DevJokes",
      "Why did the Nigerian prince finally stop sending emails? He got a real job in tech! 👑 #NaijaJokes"
    ];
    return africanJokes[Math.floor(Math.random() * africanJokes.length)];
  } catch (error) {
    console.error('Error getting real jokes:', error);
    return "😂 Why did the African chicken cross the road? To show the zebra it was possible! 🐔🦓 #AfricanHumor";
  }
}

// Function to clean up temporary files
function cleanupTempFiles() {
  try {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('Cleaned up temporary files');
    }
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
  }
}

// Ensure data directories exist
async function ensureDirectories() {
  try {
    const dirs = ['temp', 'downloads', 'data', 'auth_info_baileys'];
    for (const dir of dirs) {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
    console.log('✅ Data directories created successfully');
  } catch (error) {
    console.error('❌ Error creating directories:', error);
  }
}

// Function to completely reset authentication
async function resetAuthentication() {
  try {
    const authDir = path.join(__dirname, 'auth_info_baileys');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log('🧹 Completely reset authentication data');
    }
    fs.mkdirSync(authDir, { recursive: true });

    if (process.platform !== 'win32') {
      fs.chmodSync(authDir, 0o755);
    }

    return true;
  } catch (error) {
    console.error('Error resetting authentication:', error);
    return false;
  }
}

// Connection manager class
class ConnectionManager {
  constructor() {
    this.isConnecting = false;
    this.reconnectTimeout = null;
    this.qrCodeGenerated = false;
    this.authState = null;
    this.saveCreds = null;
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log('🔗 Initializing WhatsApp connection...');

      // Ensure auth directory exists
      const authDir = path.join(__dirname, 'auth_info_baileys');
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      // Initialize auth state
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      this.authState = state;
      this.saveCreds = saveCreds;

      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      sock = makeWASocket({
        version,
        logger: createSimpleLogger(),
        auth: this.authState,
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
      });

      sock.ev.on('creds.update', this.saveCreds);

      // Handle connection updates including QR code
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        console.log('Connection status:', connection);

        // Handle QR code generation
        if (qr && !this.qrCodeGenerated) {
          this.qrCodeGenerated = true;
          console.log('\n'.repeat(5));
          console.log('═'.repeat(60));
          console.log('🔄 SCAN THIS QR CODE WITH YOUR WHATSAPP');
          console.log('═'.repeat(60));
          qrcode.generate(qr, { small: false });
          console.log('═'.repeat(60));
          console.log('1. Open WhatsApp on your phone');
          console.log('2. Tap Menu → Linked Devices → Link a Device');
          console.log('3. Scan the QR code above');
          console.log('═'.repeat(60));
          console.log('\n');
        }

        if (connection === 'close') {
          const shouldReconnect = 
            lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;

          console.log('Connection closed, reconnecting:', shouldReconnect);
          this.qrCodeGenerated = false;

          if (shouldReconnect) {
            this.reconnect();
          }
        } else if (connection === 'open') {
          console.log('✅ Connection opened successfully');
          isConnected = true;
          reconnectAttempts = 0;
          this.isConnecting = false;
          groupManager.startGroupDiscovery(sock);
        }
      });

      // Handle incoming messages
      sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
          for (const message of m.messages) {
            await processMessage(sock, message);
          }
        }
      });

    } catch (error) {
      console.error('Connection error:', error);
      this.isConnecting = false;
      this.reconnect();
    }
  }

  reconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached');
      return;
    }

    reconnectAttempts++;
    console.log(`Attempting to reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, RECONNECT_INTERVAL);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    groupManager.stopGroupDiscovery();
    cleanupTempFiles();
    keepAlive.stopPinging();

    if (sock) {
      sock.ws.close();
      sock = null;
    }
    isConnected = false;
    this.isConnecting = false;
  }
}

const connectionManager = new ConnectionManager();

// Function to process incoming messages
async function processMessage(sock, message) {
  try {
    if (!message.message) return;

    let text = '';
    if (message.message.conversation) {
      text = message.message.conversation;
    } else if (message.message.extendedTextMessage) {
      text = message.message.extendedTextMessage.text;
    }

    if (!text) return;

    const sender = message.key.remoteJid;
    const phoneNumber = sender.split('@')[0];
    const isAdmin = sender === COMMAND_NUMBER || adminCommands.isAdmin(phoneNumber);
    const args = text.trim().split(' ');
    const command = args[0].toLowerCase();

    // Update user activity
    userManager.incrementStat(phoneNumber, 'messagesSent');

    // Handle activation messages first
    if (text.startsWith('!activate ')) {
      const code = text.substring('!activate '.length).trim();
      const result = await activationManager.handleActivation(sock, sender, phoneNumber, '', code);
      if (result.success && result.message) {
        await sock.sendMessage(sender, { text: result.message });
      }
      userManager.incrementStat(phoneNumber, 'commandsUsed');
      return;
    }

    // Handle payment and subscription messages
    const paymentHandled = await paymentHandler.handleMessage(sock, sender, phoneNumber, '', text, isAdmin);
    if (paymentHandled) {
      userManager.incrementStat(phoneNumber, 'commandsUsed');
      return;
    }

    // Handle admin commands
    if (isAdmin) {
      const adminHandled = await adminCommands.handleAdminCommand(sock, sender, phoneNumber, '', text, message);
      if (adminHandled) {
        userManager.incrementStat(phoneNumber, 'commandsUsed');
        return;
      }
    }

    // Handle dating commands
    const datingHandled = await datingManager.handleDatingCommand(sock, sender, phoneNumber, text, message);
    if (datingHandled) {
      userManager.incrementStat(phoneNumber, 'commandsUsed');
      return;
    }

    // Handle general commands
    const generalHandled = await generalCommands.handleGeneralCommand(sock, sender, phoneNumber, '', text, message);
    if (generalHandled) {
      userManager.incrementStat(phoneNumber, 'commandsUsed');
      return;
    }

    // Handle group links (auto-join)
    if (text.includes('https://chat.whatsapp.com/')) {
      await groupManager.handleGroupLink(sock, message);
      userManager.incrementStat(phoneNumber, 'commandsUsed');
      return;
    }

    // Process admin-only commands (starting with .)
    if (command.startsWith('.') && isAdmin) {
      switch (command) {
        case '.help':
          await showHelp(sock, message);
          break;
        case '.stats':
          await sock.sendMessage(sender, {
            text: `📊 Bot Statistics:\nConnected: ${isConnected}\nGroups: ${groupManager.joinedGroups.size}\nUptime: ${process.uptime().toFixed(2)}s`
          });
          break;
        case '.broadcast':
          if (args.length > 1) {
            const broadcastMessage = args.slice(1).join(' ');
            await groupManager.broadcastToGroups(sock, broadcastMessage);
            await sock.sendMessage(sender, { text: `✅ Broadcast sent to ${groupManager.joinedGroups.size} groups` });
          }
          break;
        case '.testnews':
          const country = AFRICAN_COUNTRIES[Math.floor(Math.random() * AFRICAN_COUNTRIES.length)];
          const news = await getRealNews(country);
          await sock.sendMessage(NEWS_CHANNEL_ID, { text: news });
          await sock.sendMessage(sender, { text: `✅ Test news sent to news channel` });
          break;
        case '.testcomedy':
          const joke = await getRealJokes();
          await sock.sendMessage(NEWS_CHANNEL_ID, { text: joke });
          await sock.sendMessage(sender, { text: `✅ Test comedy sent to news channel` });
          break;
        case '.userinfo':
          await userManager.getUserInfo(sock, message, args);
          break;
        default:
          break;
      }
      userManager.incrementStat(phoneNumber, 'commandsUsed');
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

// Show help function
async function showHelp(sock, message) {
  const helpText = `
🤖 WhatsApp Bot Help 🤖

Admin Commands:
.help - Show this help message
.stats - Show bot statistics
.broadcast [message] - Broadcast message to all groups
.testnews - Send test news to news channel
.testcomedy - Send test comedy to news channel
.userinfo - Show user information

Features:
- Auto-joins any WhatsApp group link received
- Broadcasts channel info daily at 6 AM and 8 PM
- Posts real news from African countries
- Shares real jokes from API
- No database - discovers groups by scanning messages

Channels:
📰 News: https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M
🎵 Music: https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S
  `;

  await sock.sendMessage(message.key.remoteJid, { text: helpText });
}

// Content scheduler
function startContentScheduler() {
  let lastBroadcastDate = null;

  setInterval(async () => {
    if (!isConnected) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentDate = now.toDateString();

    try {
      // Broadcast channel info daily at 6 AM and 8 PM
      if ((hours === 6 || hours === 20) && minutes === 0) {
        if (lastBroadcastDate !== currentDate || (lastBroadcastDate === currentDate && hours === 20)) {
          const channelInfo = `
🌟 JOIN OUR OFFICIAL CHANNELS 🌟

📰 NEWS & COMEDY CHANNEL:
Daily news from across Africa and hilarious comedy content!
https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M

🎵 MUSIC CHANNEL:
Latest music updates, artist features, and exclusive content!
https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S

👉 Tap the links above to join both channels now!
          `;

          await groupManager.broadcastToGroups(sock, channelInfo);
          lastBroadcastDate = currentDate;
          console.log(`✅ Broadcasted channel info at ${hours}:00`);
        }
      }

      // African news between 7 PM and 9 PM to NEWS channel
      if (hours >= 19 && hours < 21 && minutes % 30 === 0) {
        const randomCountry = AFRICAN_COUNTRIES[Math.floor(Math.random() * AFRICAN_COUNTRIES.length)];
        const news = await getRealNews(randomCountry);
        await sock.sendMessage(NEWS_CHANNEL_ID, { text: news });
        console.log(`Posted news to news channel: ${randomCountry}`);
      }

      // Comedy content to NEWS channel every 2 hours
      if (hours % 2 === 0 && minutes === 15) {
        const joke = await getRealJokes();
        await sock.sendMessage(NEWS_CHANNEL_ID, { text: joke });
        console.log("Posted comedy content to news channel");
      }

    } catch (error) {
      console.error('Error in content scheduler:', error);
    }
  }, 60 * 1000);
}

async function startBot() {
  try {
    console.log('🚀 Starting WhatsApp Bot...');
    await ensureDirectories();
    await connectionManager.connect();
    startContentScheduler();
    console.log('✅ Bot started successfully');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// ==================== EXPRESS SERVER SETUP ====================
const app = express();
const port = process.env.PORT || 3000;

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'WhatsApp Bot is running',
    connected: isConnected,
    groups: groupManager.joinedGroups.size,
    users: Object.keys(userManager.getAllUsers()).length,
    channels: {
      news: 'https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M',
      music: 'https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  if (isConnected) {
    res.json({ status: 'OK', connected: true });
  } else {
    res.status(503).json({ status: 'OFFLINE', connected: false });
  }
});

// Admin stats endpoint
app.get('/admin/stats', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const stats = {
    users: Object.keys(userManager.getAllUsers()).length,
    groups: groupManager.joinedGroups.size,
    connected: isConnected,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    subscriptions: subscriptionManager.getActiveSubscriptions().length
  };

  res.json(stats);
});

// Start the HTTP server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 HTTP server listening on port ${port}`);
  console.log(`🌐 Health check available at http://0.0.0.0:${port}/health`);
  
  // Start keep-alive pinging
  keepAlive.startPinging(`http://0.0.0.0:${port}/health`, 300000);
  
  startBot();
});

// Process handlers
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  connectionManager.disconnect();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});