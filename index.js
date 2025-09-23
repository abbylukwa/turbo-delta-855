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

// Enhanced Pairing System
const activePairingCodes = new Map();
const PAIRING_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes
let pairingCodeSequence = [];
let pairingCodeAttempts = 0;
const MAX_PAIRING_ATTEMPTS = 3;
const PAIRING_INTERVAL = 45000; // 45 seconds
let pairingTimer = null;

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
  
  for (const [code, data] of activePairingCodes.entries()) {
    if (now - data.timestamp > PAIRING_CODE_EXPIRY) {
      activePairingCodes.delete(code);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired pairing codes`);
  }
}

// Generate 8-character alphanumeric pairing code (WhatsApp style)
function generatePairingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Start pairing code sequence
function startPairingCodeSequence() {
  pairingCodeAttempts = 0;
  pairingCodeSequence = [];
  
  console.log('🔐 Starting pairing code sequence...');
  generateNextPairingCode();
}

// Generate next pairing code in sequence
function generateNextPairingCode() {
  if (pairingCodeAttempts >= MAX_PAIRING_ATTEMPTS) {
    console.log('✅ Pairing code sequence completed, switching to QR code mode');
    return;
  }
  
  pairingCodeAttempts++;
  const pairingCode = generatePairingCode();
  pairingCodeSequence.push(pairingCode);
  
  // Store pairing code
  activePairingCodes.set(pairingCode, {
    phone: 'sequence',
    timestamp: Date.now(),
    attempt: pairingCodeAttempts
  });
  
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║                   PAIRING CODE ${pairingCodeAttempts}/${MAX_PAIRING_ATTEMPTS}                    ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║                                                          ║`);
  console.log(`║ 🔐 Pairing Code: ${pairingCode}                               ║`);
  console.log(`║                                                          ║`);
  console.log(`║ 📱 Bot Phone: +263775156210                             ║`);
  console.log(`║ ⏰ Expires in: 10 minutes                                ║`);
  console.log(`║                                                          ║`);
  console.log(`║ Instructions:                                            ║`);
  console.log(`║ 1. WhatsApp Web → Link a Device                         ║`);
  console.log(`║ 2. Choose "Use phone number instead"                    ║`);
  console.log(`║ 3. Enter: +263775156210                                 ║`);
  console.log(`║ 4. Enter code: ${pairingCode}                               ║`);
  console.log(`║                                                          ║`);
  console.log(`║ Next code in 45 seconds...                              ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);
  
  // Schedule next pairing code or QR code
  if (pairingCodeAttempts < MAX_PAIRING_ATTEMPTS) {
    pairingTimer = setTimeout(generateNextPairingCode, PAIRING_INTERVAL);
  } else {
    pairingTimer = setTimeout(() => {
      console.log('🔄 Switching to QR code authentication...');
    }, PAIRING_INTERVAL);
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
    
    // Handle pairing codes (8-character alphanumeric codes)
    const pairingCodeMatch = text.match(/^([A-Z0-9]{8})$/i);
    if (pairingCodeMatch) {
      await handlePairingCode(sock, message, pairingCodeMatch[1].toUpperCase(), sender);
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
      case 'pair':
        await handlePairRequest(sock, message, sender);
        break;
      case 'pairingcode':
        await sendCurrentPairingCode(sock, message, sender);
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

// Send current pairing code information
async function sendCurrentPairingCode(sock, message, sender) {
  try {
    const currentCodes = Array.from(activePairingCodes.entries())
      .filter(([code, data]) => Date.now() - data.timestamp < PAIRING_CODE_EXPIRY)
      .map(([code, data]) => code);
    
    if (currentCodes.length > 0) {
      await sock.sendMessage(sender, {
        text: `🔐 *CURRENT PAIRING CODES*\n\n` +
              `*Bot Phone:* +263775156210\n\n` +
              `*Active Codes:*\n` +
              currentCodes.map(code => `• ${code}`).join('\n') + `\n\n` +
              `*How to use:*\n` +
              `1. WhatsApp Web → Link a Device\n` +
              `2. Choose "Use phone number instead"\n` +
              `3. Enter: +263775156210\n` +
              `4. Enter any active code above\n\n` +
              `📍 Codes expire in 10 minutes`
      });
    } else {
      await sock.sendMessage(sender, {
        text: `❌ No active pairing codes available.\n\n` +
              `The bot is currently in QR code mode. Wait for the next pairing code sequence.`
      });
    }
  } catch (error) {
    console.error('Error sending pairing code info:', error);
    await sock.sendMessage(sender, { text: "❌ Error retrieving pairing code information." });
  }
}

// Handle pair request
async function handlePairRequest(sock, message, sender) {
  try {
    // Generate 8-character pairing code
    const pairingCode = generatePairingCode();
    
    // Store pairing code
    activePairingCodes.set(pairingCode, {
      phone: sender,
      timestamp: Date.now(),
      custom: true
    });
    
    // Send pairing instructions
    await sock.sendMessage(sender, {
      text: `🔐 *PERSONAL PAIRING CODE*\n\n` +
            `Your pairing code: *${pairingCode}*\n\n` +
            `*Instructions:*\n` +
            `1. Go to WhatsApp Web on your computer\n` +
            `2. Click on the 3 dots menu\n` +
            `3. Select "Link a Device"\n` +
            `4. Choose "Use phone number instead"\n` +
            `5. Enter this code: *${pairingCode}*\n\n` +
            `📍 *Bot Phone Number:* +263775156210\n\n` +
            `This code will expire in 10 minutes.`
    });
    
    console.log(`🔐 Generated personal pairing code ${pairingCode} for ${sender}`);
    
  } catch (error) {
    console.error('Error handling pair request:', error);
    await sock.sendMessage(sender, { text: "❌ Error generating pairing code. Please try again." });
  }
}

// Handle pairing code verification
async function handlePairingCode(sock, message, code, sender) {
  try {
    cleanupExpiredPairingCodes();
    
    const pairingData = activePairingCodes.get(code);
    if (!pairingData) {
      await sock.sendMessage(sender, { 
        text: "❌ Invalid or expired pairing code.\n\n" +
              "Use .pairingcode to see active codes or .pair to generate a new one."
      });
      return;
    }
    
    // Pairing successful
    activePairingCodes.delete(code);
    
    await sock.sendMessage(sender, {
      text: `✅ *PAIRING SUCCESSFUL!*\n\n` +
            `Your device has been successfully paired with the bot!\n\n` +
            `You can now use all bot features. Type .help to see available commands.`
    });
    
    console.log(`✅ Successful pairing for ${sender} with code ${code}`);
    
    // Activate user subscription
    try {
      await subscriptionManager.activateDemo(sender.replace(/@s\.whatsapp\.net$/, ''));
    } catch (error) {
      console.error('Error activating demo after pairing:', error);
    }
    
  } catch (error) {
    console.error('Error handling pairing code:', error);
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
    this.pairingMode = true; // Start with pairing code mode
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log('🔗 Initializing WhatsApp connection...');

      // Start with pairing code sequence
      if (this.pairingMode) {
        console.log('🔐 Starting authentication with pairing codes...');
        startPairingCodeSequence();
        
        // Wait for pairing code sequence to complete
        await new Promise(resolve => {
          const checkSequence = () => {
            if (pairingCodeAttempts >= MAX_PAIRING_ATTEMPTS) {
              resolve();
            } else {
              setTimeout(checkSequence, 1000);
            }
          };
          checkSequence();
        });
        
        // Switch to QR code mode after pairing sequence
        this.pairingMode = false;
        console.log('🔄 Switching to QR code authentication...');
      }

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

      // Handle connection updates including QR code
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        console.log('Connection status:', connection);

        // Handle QR code generation (only after pairing sequence)
        if (qr && !this.pairingMode) {
          this.qrDisplayCount++;
          this.displayQRCode(qr, this.qrDisplayCount);
        }

        if (connection === 'close') {
          const shouldReconnect = 
            lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;

          console.log('Connection closed, reconnecting:', shouldReconnect);
          this.qrCodeGenerated = false;
          this.qrDisplayCount = 0;
          this.pairingMode = true; // Reset to pairing mode for reconnection

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

  displayQRCode(qr, displayCount) {
    if (!this.qrCodeGenerated) {
      this.qrCodeGenerated = true;

      // Clear console and display QR code prominently
      console.log('\n'.repeat(3));
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║                   QR CODE AUTHENTICATION                ║');
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
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║                 ALTERNATIVE METHODS                     ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║                                                          ║');
      console.log('║ 📱 Use .pair command to get a personal pairing code     ║');
      console.log('║ 📱 Use .pairingcode to see active codes                 ║');
      console.log('║                                                          ║');
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
      
      // Start with pairing code sequence for fresh auth too
      if (this.pairingMode) {
        console.log('🔐 Starting fresh authentication with pairing codes...');
        startPairingCodeSequence();
        
        // Wait for pairing code sequence to complete
        await new Promise(resolve => {
          const checkSequence = () => {
            if (pairingCodeAttempts >= MAX_PAIRING_ATTEMPTS) {
              resolve();
            } else {
              setTimeout(checkSequence, 1000);
            }
          };
          checkSequence();
        });
        
        this.pairingMode = false;
      }

      // Create a fresh auth state
      const authState = await useMultiFileAuthState('auth_info_baileys');
      
      console.log('✅ Fresh auth state created');

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
        const { connection, qr } = update;

        console.log('Fresh connection status:', connection);

        // Handle QR code display (after pairing sequence)
        if (qr && !this.pairingMode) {
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
        await sock.sendMessage(admin, { 
          text: '🤖 Bot is now connected and ready to receive commands!\n\n' +
                '📱 Bot Phone: +263775156210\n' +
                '🔐 Use .pair for personal pairing codes\n' +
                '🔐 Use .pairingcode for active codes'
        });
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

    if (pairingTimer) {
      clearTimeout(pairingTimer);
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
    this.pairingMode = true;
    console.log('✅ Disconnected successfully');
  }

  getStatus() {
    return {
      isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts,
      hasQR: this.qrCodeGenerated,
      qrDisplayCount: this.qrDisplayCount,
      pairingMode: this.pairingMode,
      pairingCodeAttempts: pairingCodeAttempts,
      activePairingCodes: activePairingCodes.size,
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
  if (pairingTimer) clearTimeout(pairingTimer);
  connectionManager.disconnect();
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  if (pairingTimer) clearTimeout(pairingTimer);
  connectionManager.disconnect();
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  if (pairingTimer) clearTimeout(pairingTimer);
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