const fs = require('fs');
const path = require('path');

// Polyfill for ReadableStream (important for Node environments that lack native support)
const { ReadableStream } = require('web-streams-polyfill');
global.ReadableStream = ReadableStream;

const { delay } = require('@whiskeysockets/baileys');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const { Pool } = require('pg');

// Database connection
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
    throw error;
  }
}

// Constant admins
const CONSTANT_ADMINS = [
  '27614159817@s.whatsapp.net',
  '263717457592@s.whatsapp.net', 
  '263777627210@s.whatsapp.net'
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
const datingManager = new DatingManager(pool);

// Store for connection
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 50000;

// QR code state management
let qrCodeData = null;
let qrCodeGeneratedAt = null;
const QR_CODE_EXPIRY = 120000;

// Simple logger
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

// Function to display pairing information with better visibility
function displayPairingInfo(qr, pairingCode) {
  // Store QR code data for API access
  qrCodeData = qr;
  qrCodeGeneratedAt = Date.now();

  console.log('\n'.repeat(10)); // Add more space to make it visible
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          🤖 WHATSAPP BOT PAIRING REQUEST                      ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ 📱 QR CODE DATA (COPY THIS ENTIRE BLOCK):                                     ║');
  console.log('║                                                                                ║');
  
  // Split QR code into manageable chunks for better display
  const qrChunks = [];
  for (let i = 0; i < qr.length; i += 70) {
    qrChunks.push(qr.substring(i, i + 70));
  }
  
  qrChunks.forEach(chunk => {
    console.log(`║ ${chunk.padEnd(78)} ║`);
  });
  
  console.log('║                                                                                ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
  
  if (pairingCode) {
    console.log(`║ 🔢 PAIRING CODE: ${pairingCode.toString().padEnd(61)} ║`);
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
  }
  
  console.log('║ 📋 INSTRUCTIONS:                                                              ║');
  console.log('║ 1. Copy the entire QR code data above                                         ║');
  console.log('║ 2. Visit: https://qrcode-generator.com/                                       ║');
  console.log('║ 3. Select "Text" option and paste the data                                    ║');
  console.log('║ 4. Generate QR code and scan with WhatsApp                                    ║');
  console.log('║ 5. WhatsApp → Linked Devices → Link a Device                                  ║');
  console.log('║                                                                                ║');
  console.log('║ 🌐 OR use the API endpoint: http://your-server-url/qr                         ║');
  console.log('║                                                                                ║');
  console.log('║ ⏰ This QR code expires in 2 minutes                                          ║');
  console.log('║ 🔄 If it expires, restart the bot to get a new one                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n'.repeat(3));
}

// Check if user is admin
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

    if (sender.endsWith('@broadcast') || sender === 'status@broadcast') {
      return;
    }

    const userIsAdmin = isAdmin(sender);
    const commandMatch = text.match(/^\.(\w+)(?:\s+(.*))?$/);
    if (!commandMatch) return;

    const command = commandMatch[1].toLowerCase();
    const args = commandMatch[2] ? commandMatch[2].split(' ') : [];

    console.log(`Processing command from ${sender}: ${command}`);

    // Command routing (simplified for brevity)
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
      // ... other command cases
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
  }
}

async function startBot() {
  try {
    console.log('🚀 Starting WhatsApp Bot...');
    console.log('📁 Setting up directories...');
    await ensureDirectories();

    console.log('🗄️ Initializing database...');
    await initializeDatabase();

    console.log('🔐 Loading authentication state...');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    console.log('📡 Fetching latest WhatsApp version...');
    const { version } = await fetchLatestBaileysVersion();
    console.log(`✅ Using WhatsApp version: ${version}`);

    sock = makeWASocket({
      version,
      logger: createSimpleLogger(),
      printQRInTerminal: false,
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

      console.log(`🔗 Connection update: ${connection}`);
      
      if (qr) {
        console.log('🎯 QR Code received, displaying pairing information...');
        displayPairingInfo(qr, pairingCode);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`🔌 Connection closed: ${lastDisconnect.error?.message || 'Unknown reason'}`);
        console.log(`🔄 Should reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(() => startBot(), RECONNECT_INTERVAL);
          } else {
            console.log('❌ Max reconnection attempts reached. Please restart the bot.');
          }
        } else {
          console.log('❌ Connection closed permanently. Please re-pair the device.');
          await clearAuthFiles();
        }
        isConnected = false;
      } else if (connection === 'open') {
        console.log('✅ Connected to WhatsApp successfully!');
        isConnected = true;
        reconnectAttempts = 0;
        qrCodeData = null;
        qrCodeGeneratedAt = null;

        // Notify admins
        for (const admin of CONSTANT_ADMINS) {
          try {
            await sock.sendMessage(admin, { 
              text: '🤖 Bot is now connected and ready to receive commands!' 
            });
          } catch (error) {
            console.error(`Failed to notify admin ${admin}:`, error);
          }
        }

        groupManager.startAllSchedulers();
      } else if (connection === 'connecting') {
        console.log('🔄 Connecting to WhatsApp...');
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
      console.log(`🔄 Restarting bot... Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
      setTimeout(() => startBot(), RECONNECT_INTERVAL);
    } else {
      console.log('❌ Max restart attempts reached. Please check your configuration.');
    }
  }
}

// Express server setup
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'WhatsApp Bot is running', 
    connected: isConnected,
    timestamp: new Date().toISOString(),
    hasQR: !!qrCodeData,
    qrExpired: qrCodeData && (Date.now() - qrCodeGeneratedAt) > QR_CODE_EXPIRY
  });
});

app.get('/health', (req, res) => {
  if (isConnected) {
    res.json({ status: 'OK', connected: true });
  } else {
    res.status(503).json({ status: 'OFFLINE', connected: false });
  }
});

app.get('/qr', (req, res) => {
  if (!qrCodeData) {
    return res.status(404).json({ 
      error: 'No QR code available', 
      message: isConnected ? 'Bot is already connected' : 'Waiting for QR code generation' 
    });
  }

  if (Date.now() - qrCodeGeneratedAt > QR_CODE_EXPIRY) {
    return res.status(410).json({ 
      error: 'QR code expired', 
      message: 'The QR code has expired. Please wait for a new one to be generated.' 
    });
  }

  res.json({
    qr: qrCodeData,
    generatedAt: qrCodeGeneratedAt,
    expiresAt: qrCodeGeneratedAt + QR_CODE_EXPIRY,
    timeRemaining: Math.max(0, QR_CODE_EXPIRY - (Date.now() - qrCodeGeneratedAt)),
    instructions: [
      'Copy the QR code data',
      'Visit: https://qrcode-generator.com/',
      'Select "Text" option and paste the data',
      'Generate QR code and scan with WhatsApp'
    ]
  });
});

app.get('/status', (req, res) => {
  res.json({ 
    status: isConnected ? 'CONNECTED' : 'DISCONNECTED', 
    reconnectAttempts: reconnectAttempts, 
    uptime: process.uptime()
  });
});

// Start the server and bot
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 HTTP server listening on port ${port}`);
  console.log(`🌐 Health check: http://0.0.0.0:${port}/health`);
  console.log(`📱 QR endpoint: http://0.0.0.0:${port}/qr`);
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