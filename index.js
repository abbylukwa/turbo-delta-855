const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

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
        console.log(`✅ Cleaned up temp directory: ${dir}`);
      }
    });
  } catch (error) {
    console.error('Error cleaning temp files:', error);
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
    if (!commandMatch) return;

    const command = commandMatch[1].toLowerCase();
    const args = commandMatch[2] ? commandMatch[2].split(' ') : [];

    console.log(`Processing command from ${sender}: ${command}`);

    // Command routing
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

// Connection manager class
class ConnectionManager {
  constructor() {
    this.isConnecting = false;
    this.reconnectTimeout = null;
    this.qrCodeGenerated = false;
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log('🔗 Initializing WhatsApp connection...');
      
      const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
      
      // Check if auth state is properly initialized
      if (!state || !state.auth) {
        console.log('🔄 Creating new authentication state...');
        // If state is invalid, we need to handle it differently
        await this.initializeFreshAuth();
        return;
      }

      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      sock = makeWASocket({
        version,
        logger: createSimpleLogger(),
        auth: {
          creds: state.auth.creds,
          keys: state.auth.keys
        },
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
      });

      sock.ev.on('creds.update', saveCreds);
      
      // Handle connection updates including QR code
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        console.log('Connection status:', connection);
        
        // Handle QR code generation
        if (qr && !this.qrCodeGenerated) {
          this.qrCodeGenerated = true;
          console.log('\n'.repeat(5)); // Add some space
          console.log('═'.repeat(60));
          console.log('🔄 SCAN THIS QR CODE WITH YOUR WHATSAPP');
          console.log('═'.repeat(60));
          qrcode.generate(qr, { small: false }); // Use large QR code
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
          this.qrCodeGenerated = false; // Reset QR flag for reconnection
          
          if (shouldReconnect) {
            this.reconnect();
          }
        } else if (connection === 'open') {
          console.log('✅ Connection opened successfully');
          isConnected = true;
          reconnectAttempts = 0;
          this.isConnecting = false;
          
          // Start group discovery after connection is established
          groupManager.startGroupDiscovery(sock);
          
          // Notify admins
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

  async initializeFreshAuth() {
    try {
      // Clear any existing auth data
      const authDir = path.join(__dirname, 'auth_info_baileys');
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
      }
      fs.mkdirSync(authDir, { recursive: true });

      // Create a fresh auth state
      const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
      
      const { version } = await fetchLatestBaileysVersion();

      sock = makeWASocket({
        version,
        logger: createSimpleLogger(),
        auth: {
          creds: state.auth.creds,
          keys: state.auth.keys
        },
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
      });

      sock.ev.on('creds.update', saveCreds);
      
      sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        
        console.log('Fresh connection status:', connection);
        
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
      console.error('Error initializing fresh auth:', error);
      this.reconnect();
    }
  }

  async notifyAdmins() {
    for (const admin of CONSTANT_ADMINS) {
      try {
        await sock.sendMessage(admin, { 
          text: '🤖 Bot is now connected and ready to receive commands!' 
        });
        console.log(`✅ Notified admin: ${admin}`);
      } catch (error) {
        console.error(`Failed to notify admin ${admin}:`, error);
      }
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
    
    if (groupManager.stopGroupDiscovery) {
      groupManager.stopGroupDiscovery();
    }
    
    cleanupTempFiles();
    
    if (sock) {
      sock.ws.close();
      sock = null;
    }
    isConnected = false;
    this.isConnecting = false;
    console.log('✅ Disconnected successfully');
  }

  getStatus() {
    return {
      isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts,
      hasQR: this.qrCodeGenerated
    };
  }
}

// Initialize connection manager
const connectionManager = new ConnectionManager();

// Express server setup
const app = express();
const port = process.env.PORT || 3000;

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
    res.json({ status: 'OK', connected: true });
  } else {
    res.status(503).json({ status: 'OFFLINE', connected: false });
  }
});

app.get('/status', (req, res) => {
  const status = connectionManager.getStatus();
  res.json(status);
});

app.post('/restart', (req, res) => {
  console.log('🔄 Manual restart requested via API');
  connectionManager.disconnect();
  setTimeout(() => {
    connectionManager.connect();
    res.json({ status: 'restarting', message: 'Bot is restarting...' });
  }, 2000);
});

app.post('/disconnect', (req, res) => {
  console.log('🛑 Manual disconnect requested via API');
  connectionManager.disconnect();
  res.json({ status: 'disconnected', message: 'Bot has been disconnected' });
});

// Start function
async function startBot() {
  try {
    console.log('🚀 Starting WhatsApp Bot...');
    console.log('📁 Setting up directories...');
    await ensureDirectories();

    console.log('🗄️ Initializing database...');
    await initializeDatabase();

    console.log('🔗 Starting connection manager...');
    await connectionManager.connect();

  } catch (error) {
    console.error('❌ Error starting bot:', error);
    setTimeout(() => startBot(), RECONNECT_INTERVAL);
  }
}

// Start the server and bot
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 HTTP server listening on port ${port}`);
  console.log(`🌐 Health check: http://0.0.0.0:${port}/health`);
  console.log(`📊 Status endpoint: http://0.0.0.0:${port}/status`);
  console.log(`🔄 Restart endpoint: http://0.0.0.0:${port}/restart (POST)`);
  console.log(`🛑 Disconnect endpoint: http://0.0.0.0:${port}/disconnect (POST)`);
  
  startBot();
});

// Process handlers
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  connectionManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  connectionManager.disconnect();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  connectionManager.reconnect();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { 
  startBot, 
  connectionManager, 
  app,
  isAdmin,
  hasActiveSubscription
};