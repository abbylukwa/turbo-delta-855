const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

// Polyfill for ReadableStream
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

// Pairing system - Store WhatsApp-generated pairing codes
const whatsappPairingCodes = new Map(); // Stores the pairing code data from WhatsApp
const PAIRING_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes

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
      }
    }
    console.log('✅ All directories created successfully');
  } catch (error) {
    console.error('❌ Error creating directories:', error);
    throw error;
  }
}

// Cleanup temporary files
function cleanupTempFiles() {
  try {
    const tempDirs = [
      path.join(__dirname, 'temp'),
      path.join(__dirname, 'downloads', 'temp')
    ];

    tempDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  } catch (error) {
    console.error('Error cleaning temp files:', error);
  }
}

// Cleanup expired pairing codes
function cleanupExpiredPairingCodes() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [code, data] of whatsappPairingCodes.entries()) {
    if (now - data.timestamp > PAIRING_CODE_EXPIRY) {
      whatsappPairingCodes.delete(code);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired pairing codes`);
  }
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
    
    // Handle WhatsApp pairing codes (8-digit numeric codes)
    const pairingCodeMatch = text.match(/^(\d{8})$/);
    if (pairingCodeMatch) {
      await handleWhatsAppPairingCode(sock, message, pairingCodeMatch[1], sender);
      return;
    }

    if (!commandMatch) return;

    const command = commandMatch[1].toLowerCase();
    const args = commandMatch[2] ? commandMatch[2].split(' ') : [];

    console.log(`Processing command from ${sender}: ${command}`);

    switch (command) {
      case 'activate':
        await activationManager.handleActivation(sock, message, args, sender);
        break;
      case 'pairingcode':
        await sendPairingCodeInfo(sock, message, sender);
        break;
      case 'userinfo':
        if (userIsAdmin) {
          await userManager.getUserInfo(sock, message, args);
        } else {
          await sock.sendMessage(sender, { text: "❌ Admin only command." });
        }
        break;
      case 'help':
        await generalCommands.showHelp(sock, message, userIsAdmin);
        break;
      case 'status':
        await sock.sendMessage(sender, { 
          text: `🤖 Bot Status:\n• Connected: ${isConnected ? '✅' : '❌'}\n• Reconnect Attempts: ${reconnectAttempts}\n• Uptime: ${Math.round(process.uptime())}s` 
        });
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

// Send pairing code information to user
async function sendPairingCodeInfo(sock, message, sender) {
  try {
    const currentCode = Array.from(whatsappPairingCodes.keys())[0];
    
    if (currentCode) {
      await sock.sendMessage(sender, {
        text: `🔐 *WHATSAPP PAIRING INFORMATION*\n\n` +
              `*Bot Phone:* +263775156210\n` +
              `*Current Pairing Code:* ${currentCode}\n\n` +
              `*How to use:*\n` +
              `1. Open WhatsApp Web/Desktop\n` +
              `2. Click "Link a Device"\n` +
              `3. Choose "Use phone number instead"\n` +
              `4. Enter: +263775156210\n` +
              `5. Enter code: ${currentCode}\n\n` +
              `📍 This code is generated by WhatsApp and will expire soon.`
      });
    } else {
      await sock.sendMessage(sender, {
        text: `❌ No active pairing code available.\n\n` +
              `Wait for the bot to generate a new QR code, then check the console/logs for the 8-digit pairing code that WhatsApp generates.`
      });
    }
  } catch (error) {
    console.error('Error sending pairing code info:', error);
    await sock.sendMessage(sender, { text: "❌ Error retrieving pairing code information." });
  }
}

// Handle WhatsApp-generated pairing code verification
async function handleWhatsAppPairingCode(sock, message, code, sender) {
  try {
    cleanupExpiredPairingCodes();
    
    const pairingData = whatsappPairingCodes.get(code);
    if (!pairingData) {
      await sock.sendMessage(sender, { 
        text: "❌ Invalid or expired pairing code.\n\n" +
              "Please check the current pairing code in the bot's console or use .pairingcode command."
      });
      return;
    }
    
    // Pairing successful
    whatsappPairingCodes.delete(code);
    
    await sock.sendMessage(sender, {
      text: `✅ *PAIRING SUCCESSFUL!*\n\n` +
            `Your device has been successfully paired with the bot using WhatsApp's pairing code!\n\n` +
            `You can now use all bot features. Type .help to see available commands.`
    });
    
    console.log(`✅ Successful WhatsApp pairing for ${sender} with code ${code}`);
    
    // Activate user subscription
    try {
      await subscriptionManager.activateDemo(sender.replace(/@s\.whatsapp\.net$/, ''));
    } catch (error) {
      console.error('Error activating demo after pairing:', error);
    }
    
  } catch (error) {
    console.error('Error handling WhatsApp pairing code:', error);
    await sock.sendMessage(sender, { text: "❌ Error processing pairing code. Please try again." });
  }
}

// Connection manager class
class ConnectionManager {
  constructor() {
    this.isConnecting = false;
    this.reconnectTimeout = null;
    this.qrCodeGenerated = false;
    this.qrDisplayCount = 0;
    this.currentPairingCode = null;
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log('🔗 Initializing WhatsApp connection...');

      // Try to load existing auth state
      let authState;
      try {
        authState = await useMultiFileAuthState('auth_info_baileys');
        console.log('✅ Auth state loaded successfully');
      } catch (error) {
        console.log('❌ Error loading auth state:', error.message);
        authState = null;
      }

      // Check if auth state is valid
      if (!authState || !authState.state) {
        console.log('🔄 No valid auth state found, creating fresh authentication...');
        await this.initializeFreshAuth();
        return;
      }

      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      // Use the state directly from the authState object
      sock = makeWASocket({
        version,
        logger: createSimpleLogger(),
        printQRInTerminal: false,
        auth: authState.state,
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
      });

      sock.ev.on('creds.update', authState.saveCreds);

      // Handle connection updates including QR code and pairing code
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, isNewLogin, pairingCode } = update;

        console.log('Connection update:', {
          connection,
          isNewLogin,
          hasPairingCode: !!pairingCode,
          pairingCode: pairingCode || 'None'
        });

        // Handle pairing code from WhatsApp
        if (pairingCode) {
          this.handleWhatsAppPairingCode(pairingCode);
        }

        // Handle QR code generation
        if (qr) {
          this.qrDisplayCount++;
          this.displayQRCode(qr, this.qrDisplayCount);
        }

        if (connection === 'close') {
          const shouldReconnect = 
            lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;

          console.log('Connection closed, reconnecting:', shouldReconnect);
          this.qrCodeGenerated = false;
          this.qrDisplayCount = 0;
          this.currentPairingCode = null;

          if (shouldReconnect) {
            this.reconnect();
          }
        } else if (connection === 'open') {
          console.log('✅ Connection opened successfully');
          isConnected = true;
          reconnectAttempts = 0;
          this.isConnecting = false;
          groupManager.startGroupDiscovery(sock);
          this.notifyAdmins();
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

  // Handle WhatsApp-generated pairing code
  handleWhatsAppPairingCode(pairingCode) {
    console.log('🔐 WhatsApp generated pairing code:', pairingCode);
    
    // Store the WhatsApp pairing code
    this.currentPairingCode = pairingCode;
    whatsappPairingCodes.set(pairingCode, {
      timestamp: Date.now(),
      source: 'whatsapp'
    });
    
    console.log(`✅ Stored WhatsApp pairing code: ${pairingCode}`);
    console.log(`📍 Users can pair using: Phone: +263775156210, Code: ${pairingCode}`);
  }

  displayQRCode(qr, displayCount) {
    if (!this.qrCodeGenerated) {
      this.qrCodeGenerated = true;

      // Clear console and display QR code prominently
      console.log('\n'.repeat(3));
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║                   WHATSAPP CONNECTION                   ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      
      if (displayCount === 1) {
        console.log('║                     FIRST QR CODE                      ║');
      } else if (displayCount === 3) {
        console.log('║                     THIRD QR CODE                      ║');
      } else {
        console.log('║                     QR CODE #' + displayCount + '                        ║');
      }
      
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║ Scan QR code with WhatsApp:                             ║');
      console.log('║                                                          ║');
      
      // Generate smaller QR code
      qrcode.generate(qr, { 
        small: true
      });
      
      console.log('║                                                          ║');
      
      // Display pairing code if available
      if (this.currentPairingCode) {
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║                🔢 WHATSAPP PAIRING CODE                 ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║                                                          ║');
        console.log('║ 📱 Bot Phone: +263775156210                             ║');
        console.log('║ 🔐 Pairing Code: ' + this.currentPairingCode + '                           ║');
        console.log('║                                                          ║');
        console.log('║ *Alternative to QR scanning:*                           ║');
        console.log('║ 1. WhatsApp Web → Link a Device                         ║');
        console.log('║ 2. Choose "Use phone number instead"                    ║');
        console.log('║ 3. Enter phone: +263775156210                           ║');
        console.log('║ 4. Enter code: ' + this.currentPairingCode + '                           ║');
        console.log('║                                                          ║');
      } else {
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║          ⏳ WAITING FOR PAIRING CODE...                 ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║                                                          ║');
        console.log('║ WhatsApp will generate an 8-digit pairing code          ║');
        console.log('║ shortly. Check logs for the code when available.        ║');
        console.log('║                                                          ║');
      }
      
      console.log('║ Code expires in 10 minutes                              ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('\n');
    }
  }

  async initializeFreshAuth() {
    try {
      // Clear any existing auth data
      const authDir = path.join(__dirname, 'auth_info_baileys');
      if (fs.existsSync(authDir)) {
        console.log('🧹 Cleaning up old auth data...');
        fs.rmSync(authDir, { recursive: true, force: true });
      }
      fs.mkdirSync(authDir, { recursive: true });

      console.log('🔄 Creating fresh authentication state...');
      
      // Create a fresh auth state
      const authState = await useMultiFileAuthState('auth_info_baileys');
      
      console.log('✅ Fresh auth state created:', {
        stateExists: !!authState.state,
        stateKeys: authState.state ? Object.keys(authState.state) : 'none'
      });

      const { version } = await fetchLatestBaileysVersion();
      console.log('✅ Fetched WhatsApp version:', version.join('.'));

      // Create socket with the fresh auth state
      sock = makeWASocket({
        version,
        logger: createSimpleLogger(),
        printQRInTerminal: false,
        auth: authState.state,
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
      });

      sock.ev.on('creds.update', authState.saveCreds);

      sock.ev.on('connection.update', (update) => {
        const { connection, qr, pairingCode } = update;

        console.log('Fresh connection status:', connection);

        // Handle WhatsApp pairing code
        if (pairingCode) {
          this.handleWhatsAppPairingCode(pairingCode);
        }

        // Handle QR code display
        if (qr) {
          this.qrDisplayCount++;
          this.displayQRCode(qr, this.qrDisplayCount);
        }

        if (connection === 'open') {
          console.log('✅ Fresh connection opened successfully');
          isConnected = true;
          reconnectAttempts = 0;
          this.isConnecting = false;
          groupManager.startGroupDiscovery(sock);
          this.notifyAdmins();
        }
      });

    } catch (error) {
      console.error('❌ Error initializing fresh auth:', error);
      setTimeout(() => {
        this.reconnect();
      }, 10000);
    }
  }

  async notifyAdmins() {
    for (const admin of CONSTANT_ADMINS) {
      try {
        const message = this.currentPairingCode ? 
          `🤖 Bot is now connected and ready!\n\n` +
          `📱 Bot Phone: +263775156210\n` +
          `🔐 WhatsApp Pairing Code: ${this.currentPairingCode}\n` +
          `Use .pairingcode command to get pairing information.` :
          `🤖 Bot is now connected and ready!\n\n` +
          `📱 Bot Phone: +263775156210\n` +
          `Waiting for WhatsApp pairing code...`;
          
        await sock.sendMessage(admin, { text: message });
        console.log(`✅ Notified admin: ${admin}`);
      } catch (error) {
        console.error(`Failed to notify admin ${admin}:`, error);
      }
    }
  }

  reconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('❌ Max reconnection attempts reached');
      return;
    }

    reconnectAttempts++;
    const delayTime = Math.min(RECONNECT_INTERVAL * reconnectAttempts, 300000);
    
    console.log(`🔄 Attempting to reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delayTime/1000}s`);

    this.reconnectTimeout = setTimeout(() => {
      this.isConnecting = false;
      this.connect();
    }, delayTime);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (groupManager.stopGroupDiscovery) {
      groupManager.stopGroupDiscovery();
    }

    cleanupTempFiles();
    cleanupExpiredPairingCodes();

    if (sock) {
      sock.ws.close();
      sock = null;
    }
    isConnected = false;
    this.isConnecting = false;
    this.qrCodeGenerated = false;
    this.qrDisplayCount = 0;
    this.currentPairingCode = null;
    console.log('✅ Disconnected successfully');
  }

  getStatus() {
    return {
      isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts,
      hasQR: this.qrCodeGenerated,
      qrDisplayCount: this.qrDisplayCount,
      currentPairingCode: this.currentPairingCode,
      activePairingCodes: whatsappPairingCodes.size,
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS
    };
  }
}

// Initialize connection manager
const connectionManager = new ConnectionManager();

// Express server setup
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  const status = connectionManager.getStatus();
  res.json({ 
    status: 'OK', 
    message: 'WhatsApp Bot is running', 
    ...status,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  const status = connectionManager.getStatus();
  if (status.isConnected) {
    res.json({ status: 'OK', connected: true, uptime: process.uptime() });
  } else {
    res.status(503).json({ 
      status: 'OFFLINE', 
      connected: false, 
      reconnecting: status.isConnecting,
      reconnectAttempts: status.reconnectAttempts 
    });
  }
});

app.get('/status', (req, res) => {
  const status = connectionManager.getStatus();
  res.json({
    ...status,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/restart', async (req, res) => {
  try {
    console.log('🔄 Manual restart requested via API');
    connectionManager.disconnect();
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    connectionManager.connect();
    res.json({ 
      status: 'restarting', 
      message: 'Bot is restarting...',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during restart:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Restart failed',
      error: error.message 
    });
  }
});

app.post('/disconnect', (req, res) => {
  try {
    console.log('🛑 Manual disconnect requested via API');
    connectionManager.disconnect();
    res.json({ 
      status: 'disconnected', 
      message: 'Bot has been disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during disconnect:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Disconnect failed',
      error: error.message 
    });
  }
});

// Start function
async function startBot() {
  try {
    console.log('🚀 Starting WhatsApp Bot...');
    console.log('📁 Setting up directories...');
    await ensureDirectories();

    console.log('🗄️ Initializing database...');
    await initializeDatabase();

    // Start pairing code cleanup interval
    setInterval(cleanupExpiredPairingCodes, 5 * 60 * 1000); // Clean every 5 minutes

    console.log('🔗 Starting connection manager...');
    await connectionManager.connect();

    console.log('✅ Bot startup sequence completed');

  } catch (error) {
    console.error('❌ Error starting bot:', error);
    setTimeout(() => {
      startBot();
    }, 10000);
  }
}

// Start the server and bot
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 HTTP server listening on port ${port}`);
  console.log(`🌐 Health check: http://0.0.0.0:${port}/health`);
  console.log(`📊 Status endpoint: http://0.0.0.0:${port}/status`);
  console.log(`🔄 Restart endpoint: http://0.0.0.0:${port}/restart (POST)`);
  console.log(`🛑 Disconnect endpoint: http://0.0.0.0:${port}/disconnect (POST)`);
  console.log(`⏰ Starting bot in 3 seconds...`);

  setTimeout(() => {
    startBot();
  }, 3000);
});

// Process handlers
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  connectionManager.disconnect();
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  connectionManager.disconnect();
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  connectionManager.reconnect();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { 
  startBot, 
  connectionManager, 
  app,
  isAdmin,
  hasActiveSubscription
};