const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const { Pool } = require('pg');

// Database connection - using Render PostgreSQL for dating features only
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://database_3lb1_user:SG82maildcd1UeiIs0Gdndp8tMPRjOcI@dpg-d37c830gjchc73c5l15g-a/database_3lb1',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables for dating only
async function initializeDatabase() {
  try {
    // Create dating profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dating_profiles (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100),
        age INTEGER,
        gender VARCHAR(20),
        location VARCHAR(100),
        bio TEXT,
        interests TEXT[],
        profile_picture_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create dating matches table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dating_matches (
        id SERIAL PRIMARY KEY,
        user1_phone VARCHAR(20) NOT NULL,
        user2_phone VARCHAR(20) NOT NULL,
        match_score INTEGER,
        status VARCHAR(20) DEFAULT 'pending',
        matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user1_phone, user2_phone)
      )
    `);

    // Create dating messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dating_messages (
        id SERIAL PRIMARY KEY,
        sender_phone VARCHAR(20) NOT NULL,
        receiver_phone VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE
      )
    `);

    console.log('✅ Dating database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing dating database:', error);
    throw error; // Re-throw to handle in calling function
  }
}

// Constant admins (these don't need activation)
const CONSTANT_ADMINS = [
  '27614159817@s.whatsapp.net',    // +27 61 415 9817
  '263717457592@s.whatsapp.net',   // +263 71 745 7592
  '263777627210@s.whatsapp.net'    // +263 777 627 210
];

// Import managers
const UserManager = require('./user-manager');
const ActivationManager = require('./activation-manager');
const GroupManager = require('./group-manager');
const AdminCommands = require('./admin-commands');
const GeneralCommands = require('./general-commands');
const DownloadManager = require('./download-manager');
const SubscriptionManager = require('./subscription-manager');
const PaymentHandler = require('./payment-handler');
const DatingManager = require('./dating-manager');

// Initialize managers
const userManager = new UserManager();
const activationManager = new ActivationManager();
const groupManager = new GroupManager();
const adminCommands = new AdminCommands();
const generalCommands = new GeneralCommands();
const downloadManager = new DownloadManager();
const subscriptionManager = new SubscriptionManager();
const paymentHandler = new PaymentHandler();
const datingManager = new DatingManager(pool); // Only dating manager gets database access

// Store for connection
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 50000;

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

// Ensure data directories exist
async function ensureDirectories() {
  try {
    const directories = [
      path.join(__dirname, 'auth_info_baileys'),
      path.join(__dirname, 'data'),
      path.join(__dirname, 'downloads'),
      path.join(__dirname, 'downloads', 'music'),
      path.join(__dirname, 'downloads', 'videos'),
      path.join(__dirname, 'downloads', 'reels')
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    }

    console.log('✅ All directories created successfully');
  } catch (error) {
    console.error('❌ Error creating directories:', error);
    throw error;
  }
}

// Clear auth files
async function clearAuthFiles() {
  try {
    const authDir = path.join(__dirname, 'auth_info_baileys');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log('✅ Cleared auth files');
    }
    fs.mkdirSync(authDir, { recursive: true });
    return true;
  } catch (error) {
    console.error('Error clearing auth files:', error.message);
    return false;
  }
}

// Connection manager
class ConnectionManager {
  constructor() {
    this.isConnecting = false;
    this.reconnectTimeout = null;
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (sock) {
      sock.end();
      sock = null;
    }
    isConnected = false;
  }
}

const connectionManager = new ConnectionManager();

// Function to display pairing information
function displayPairingInfo(qr, pairingCode) {
  console.log('\n'.repeat(5));
  console.log('═'.repeat(60));
  console.log('🤖 WHATSAPP BOT PAIRING INFORMATION');
  console.log('═'.repeat(60));

  if (qr) {
    console.log('📱 Scan the QR code below:');
    qrcode.generate(qr, { small: true });
  }

  if (pairingCode) {
    console.log(`🔢 Pairing code: ${pairingCode}`);
  }

  console.log('═'.repeat(60));
  console.log('💡 Tip: Use WhatsApp Linked Devices feature to pair');
  console.log('═'.repeat(60));
}

// Check if user is admin (including constant admins)
function isAdmin(phoneNumber) {
  return CONSTANT_ADMINS.includes(phoneNumber);
}

// Check if user has active subscription
async function hasActiveSubscription(phoneNumber) {
  try {
    return await subscriptionManager.isUserSubscribed(phoneNumber);
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

// Function to process incoming messages
async function processMessage(sock, message) {
  try {
    if (!message.message) return;

    const sender = message.key.remoteJid;
    const messageType = Object.keys(message.message)[0];
    let text = '';

    if (messageType === 'conversation') {
      text = message.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
      text = message.message.extendedTextMessage.text;
    }

    // Ignore messages from broadcast lists and status
    if (sender.endsWith('@broadcast') || sender === 'status@broadcast') {
      return;
    }

    // Check if user is admin
    const userIsAdmin = isAdmin(sender);

    // Parse command
    const commandMatch = text.match(/^\.(\w+)(?:\s+(.*))?$/);
    if (!commandMatch) return;

    const command = commandMatch[1].toLowerCase();
    const args = commandMatch[2] ? commandMatch[2].split(' ') : [];

    console.log(`Processing command from ${sender}: ${command}`);

    // Route to appropriate command handler
    switch (command) {
      case 'activate':
        await activationManager.handleActivation(sock, message, args, sender);
        break;
      case 'userinfo':
        if (userIsAdmin) {
          await userManager.getUserInfo(sock, message, args);
        } else {
          await sock.sendMessage(sender, { text: "❌ Admin only command." });
        }
        break;
      case 'ban':
        if (userIsAdmin) {
          await userManager.banUser(sock, message, args);
        } else {
          await sock.sendMessage(sender, { text: "❌ Admin only command." });
        }
        break;
      case 'unban':
        if (userIsAdmin) {
          await userManager.unbanUser(sock, message, args);
        } else {
          await sock.sendMessage(sender, { text: "❌ Admin only command." });
        }
        break;
      case 'creategroup':
      case 'joingroup':
      case 'listgroups':
      case 'autojointoggle':
      case 'advertisechannels':
      case 'posttochannel':
      case 'forcedownload':
      case 'channelstats':
      case 'cleanup':
        if (userIsAdmin) {
          await groupManager.handleGroupCommand(sock, message, command, args, sender);
        } else {
          await sock.sendMessage(sender, { text: "❌ Admin only command." });
        }
        break;
      case 'broadcast':
      case 'stats':
      case 'restart':
        if (userIsAdmin) {
          await adminCommands.handleAdminCommand(sock, message, command, args);
        } else {
          await sock.sendMessage(sender, { text: "❌ Admin only command." });
        }
        break;
      case 'download':
        await downloadManager.handleDownload(sock, message, args);
        break;
      case 'subscribe':
        await subscriptionManager.handleSubscription(sock, message, args, sender);
        break;
      case 'payment':
        await paymentHandler.handlePayment(sock, message, args, sender);
        break;
      case 'dating':
        // Check if user has active subscription for dating features
        const hasSubscription = await hasActiveSubscription(sender);
        if (hasSubscription) {
          await datingManager.handleDatingCommand(sock, message, args, sender);
        } else {
          await sock.sendMessage(sender, { 
            text: "❌ Dating features require an active subscription. Use .subscribe to get access." 
          });
        }
        break;
      case 'help':
        await generalCommands.showHelp(sock, message, userIsAdmin);
        break;
      default:
        await sock.sendMessage(sender, { 
          text: "❌ Unknown command. Type .help for available commands." 
        });
    }
  } catch (error) {
    console.error('Error processing message:', error);
    try {
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ Error processing command: ${error.message}`
      });
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }
  }
}

async function startBot() {
  try {
    console.log('🚀 Starting WhatsApp Bot...');
    await ensureDirectories();

    // Initialize dating database only
    await initializeDatabase();

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger: createSimpleLogger(),
      printQRInTerminal: true,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 0,
    });

    // Setup event handlers
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin, pairingCode } = update;

      if (qr) {
        displayPairingInfo(qr, pairingCode);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;

        console.log(`Connection closed due to ${lastDisconnect.error} | reconnecting ${shouldReconnect}`);

        if (shouldReconnect) {
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(() => startBot(), RECONNECT_INTERVAL);
          } else {
            console.log('Max reconnection attempts reached. Please restart the bot.');
          }
        } else {
          console.log('Connection closed permanently. Please re-pair the device.');
          await clearAuthFiles();
        }
        isConnected = false;
      } else if (connection === 'open') {
        console.log('✅ Connected to WhatsApp');
        isConnected = true;
        reconnectAttempts = 0;

        // Send connection success message to constant admins
        for (const admin of CONSTANT_ADMINS) {
          try {
            await sock.sendMessage(admin, { 
              text: '🤖 Bot is now connected and ready to receive commands!' 
            });
          } catch (error) {
            console.error(`Failed to send message to admin ${admin}:`, error);
          }
        }

        // Start group manager schedulers after connection is established
        groupManager.startAllSchedulers();
      }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const message of m.messages) {
          await processMessage(sock, message);
        }
      }
    });

  } catch (error) {
    console.error('❌ Error starting bot:', error);
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`Restarting bot... Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
      setTimeout(() => startBot(), RECONNECT_INTERVAL);
    } else {
      console.log('Max restart attempts reached. Please check your configuration.');
    }
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
    timestamp: new Date().toISOString() 
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

// Bot status endpoint
app.get('/status', (req, res) => {
  res.json({ 
    status: isConnected ? 'CONNECTED' : 'DISCONNECTED', 
    reconnectAttempts: reconnectAttempts, 
    uptime: process.uptime(), 
    memory: { 
      usage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + 'MB', 
      total: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2) + 'MB' 
    } 
  });
});

// Start the HTTP server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 HTTP server listening on port ${port}`);
  console.log(`🌐 Health check available at http://0.0.0.0:${port}/health`);
  // Start the bot after the server is running
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

module.exports = { startBot, connectionManager, app };