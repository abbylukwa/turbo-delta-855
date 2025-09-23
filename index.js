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

// ⚠️ CONFIGURE YOUR PERSONAL NUMBER HERE ⚠️
// Replace with YOUR personal WhatsApp number (with country code, no +)
const YOUR_PERSONAL_NUMBER = '1234567890'; // Example: 1234567890 for US number
const YOUR_PERSONAL_JID = `${YOUR_PERSONAL_NUMBER}@s.whatsapp.net`;

// Constant admins - Add your number as admin
const CONSTANT_ADMINS = [
  YOUR_PERSONAL_JID,
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
let currentWhatsAppPairingCode = null;
let pairingCodeTimestamp = null;

// Pairing attempt tracking
let pairingAttemptCount = 0;
const MAX_PAIRING_ATTEMPTS = 3;
let pairingMode = true; // Start with pairing code mode

// Message storage for your personal messages
const yourMessages = {
  received: [],
  sent: [],
  groups: new Map(),
  contacts: new Map()
};

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
  
  // Clear current WhatsApp pairing code if expired
  if (currentWhatsAppPairingCode && now - pairingCodeTimestamp > PAIRING_CODE_EXPIRY) {
    currentWhatsAppPairingCode = null;
    pairingCodeTimestamp = null;
    cleaned++;
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired pairing codes`);
  }
}

// Display real WhatsApp pairing code
function displayWhatsAppPairingCode(pairingCode, attemptNumber) {
  currentWhatsAppPairingCode = pairingCode;
  pairingCodeTimestamp = Date.now();
  
  // Store in active codes
  activePairingCodes.set(pairingCode, {
    phone: 'whatsapp_generated',
    timestamp: pairingCodeTimestamp,
    isRealWhatsAppCode: true,
    attempt: attemptNumber
  });

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║               WHATSAPP PAIRING CODE                      ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║                                                          ║');
  console.log(`║ 🔐 Pairing Attempt: ${attemptNumber}/${MAX_PAIRING_ATTEMPTS}                          ║`);
  console.log('║ 🔐 Real Pairing Code: ' + pairingCode + '                 ║');
  console.log('║                                                          ║');
  console.log(`║ 📱 Your Personal Number: ${YOUR_PERSONAL_NUMBER}                   ║`);
  console.log('║ ⏰ Expires in: 10 minutes                                ║');
  console.log('║                                                          ║');
  console.log('║ Instructions:                                            ║');
  console.log('║ 1. Open WhatsApp on your phone                          ║');
  console.log('║ 2. Go to Linked Devices                                 ║');
  console.log('║ 3. Tap on "Link a Device"                               ║');
  console.log('║ 4. Scan QR code or use pairing code                     ║');
  console.log('║ 5. Enter code: ' + pairingCode + '                         ║');
  console.log('║                                                          ║');
  
  if (attemptNumber < MAX_PAIRING_ATTEMPTS) {
    console.log(`║ ⏳ Next pairing code in 45 seconds...                    ║`);
  } else {
    console.log(`║ 🔄 Switching to QR code after this attempt...            ║`);
  }
  
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

// Display QR code
function displayQRCode(qr, displayCount) {
  console.log('\n'.repeat(3));
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                   QR CODE AUTHENTICATION                ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  
  if (displayCount === 1) {
    console.log('║                  FIRST QR CODE (AFTER 3 PAIRING ATTEMPTS) ║');
  } else {
    console.log('║                     QR CODE #' + displayCount + '                        ║');
  }
  
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║ Scan this QR code with your personal WhatsApp:          ║');
  console.log('║                                                          ║');
  console.log('║ 1. Open WhatsApp on your phone                          ║');
  console.log('║ 2. Go to Settings → Linked Devices                      ║');
  console.log('║ 3. Tap on "Link a Device"                               ║');
  console.log('║ 4. Scan this QR code                                    ║');
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
  console.log('║ 📱 Use .pair command for pairing instructions           ║');
  console.log('║ 📱 Use .pairingcode to see active codes                 ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');
}

// Enhanced message storage for your personal messages
function storePersonalMessage(message) {
  try {
    const messageData = {
      timestamp: new Date().toISOString(),
      from: message.key.remoteJid,
      message: message.message,
      type: Object.keys(message.message)[0],
      id: message.key.id,
      participant: message.key.participant // For group messages
    };

    // Extract message text
    let messageText = '';
    if (messageData.type === 'conversation') {
      messageText = message.message.conversation;
    } else if (messageData.type === 'extendedTextMessage') {
      messageText = message.message.extendedTextMessage.text;
    } else if (messageData.type === 'imageMessage') {
      messageText = message.message.imageMessage.caption || '[Image]';
    } else if (messageData.type === 'videoMessage') {
      messageText = message.message.videoMessage.caption || '[Video]';
    } else if (messageData.type === 'audioMessage') {
      messageText = '[Audio]';
    } else if (messageData.type === 'documentMessage') {
      messageText = message.message.documentMessage.caption || '[Document]';
    }
    messageData.text = messageText;

    // Check if message is from you or to you
    const isFromYou = message.key.fromMe;
    const isToYou = message.key.remoteJid === YOUR_PERSONAL_JID || 
                   (message.key.remoteJid.includes('-') && !isFromYou); // Group messages

    if (isFromYou) {
      // Message sent by you
      yourMessages.sent.push(messageData);
      console.log(`💬 Message SENT by you to: ${message.key.remoteJid}`);
    } else if (isToYou) {
      // Message received by you
      yourMessages.received.push(messageData);
      console.log(`💬 Message RECEIVED by you from: ${message.key.remoteJid}`);
      
      // Store contact information
      const contactJid = message.key.participant || message.key.remoteJid;
      if (!yourMessages.contacts.has(contactJid)) {
        yourMessages.contacts.set(contactJid, {
          jid: contactJid,
          lastMessage: new Date(),
          messageCount: 0
        });
      }
      const contact = yourMessages.contacts.get(contactJid);
      contact.lastMessage = new Date();
      contact.messageCount++;
      
      // Store group messages separately
      if (message.key.remoteJid.includes('-')) {
        const groupId = message.key.remoteJid;
        if (!yourMessages.groups.has(groupId)) {
          yourMessages.groups.set(groupId, []);
        }
        yourMessages.groups.get(groupId).push(messageData);
      }
    }

    // Keep only last 1000 messages to prevent memory issues
    if (yourMessages.received.length > 1000) yourMessages.received.shift();
    if (yourMessages.sent.length > 1000) yourMessages.sent.shift();

  } catch (error) {
    console.error('Error storing message:', error);
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

    // Store ALL messages for your personal account
    storePersonalMessage(message);

    const sender = message.key.remoteJid;
    const messageType = Object.keys(message.message)[0];
    let text = '';

    if (messageType === 'conversation') {
      text = message.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
      text = message.message.extendedTextMessage.text;
    }

    // Ignore broadcasts and status updates
    if (sender.endsWith('@broadcast') || sender === 'status@broadcast') {
      return;
    }

    const userIsAdmin = isAdmin(sender);
    const commandMatch = text.match(/^\.(\w+)(?:\s+(.*))?$/);
    
    // Handle pairing codes (WhatsApp style codes - typically 6-8 digits)
    const pairingCodeMatch = text.match(/^(\d{6,8})$/);
    if (pairingCodeMatch) {
      await handlePairingCode(sock, message, pairingCodeMatch[1], sender);
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
        const status = connectionManager.getStatus();
        const messageStats = `📊 Your Messages: ${yourMessages.received.length} received, ${yourMessages.sent.length} sent, ${yourMessages.groups.size} groups, ${yourMessages.contacts.size} contacts`;
        
        await sock.sendMessage(sender, { 
          text: `🤖 Bot Status:\n• Connected: ${isConnected ? '✅' : '❌'}\n• Mode: ${pairingMode ? 'Pairing Codes' : 'QR Code'}\n• Pairing Attempts: ${pairingAttemptCount}/${MAX_PAIRING_ATTEMPTS}\n• Reconnect Attempts: ${reconnectAttempts}\n• Uptime: ${Math.round(process.uptime())}s\n\n${messageStats}` 
        });
        break;
      case 'mystats':
        if (sender === YOUR_PERSONAL_JID) {
          await showMessageStats(sock, message);
        } else {
          await sock.sendMessage(sender, { text: "❌ This command is only for your personal account." });
        }
        break;
      case 'recent':
        if (sender === YOUR_PERSONAL_JID) {
          await showRecentMessages(sock, message, args);
        } else {
          await sock.sendMessage(sender, { text: "❌ This command is only for your personal account." });
        }
        break;
      case 'contacts':
        if (sender === YOUR_PERSONAL_JID) {
          await showContacts(sock, message, args);
        } else {
          await sock.sendMessage(sender, { text: "❌ This command is only for your personal account." });
        }
        break;
      case 'search':
        if (sender === YOUR_PERSONAL_JID) {
          await searchMessages(sock, message, args);
        } else {
          await sock.sendMessage(sender, { text: "❌ This command is only for your personal account." });
        }
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

// Show message statistics
async function showMessageStats(sock, message) {
  try {
    const totalMessages = yourMessages.received.length + yourMessages.sent.length;
    const stats = `📊 YOUR MESSAGE STATISTICS:\n\n` +
                 `📥 Messages Received: ${yourMessages.received.length}\n` +
                 `📤 Messages Sent: ${yourMessages.sent.length}\n` +
                 `💬 Total Messages: ${totalMessages}\n` +
                 `👥 Active Contacts: ${yourMessages.contacts.size}\n` +
                 `👪 Active Groups: ${yourMessages.groups.size}\n\n` +
                 `🕒 Tracking since: ${yourMessages.received[0] ? new Date(yourMessages.received[0].timestamp).toLocaleString() : 'No messages yet'}\n\n` +
                 `💡 Use .recent [number] to see recent messages\n` +
                 `💡 Use .contacts to see message counts by contact\n` +
                 `💡 Use .search [keyword] to search messages`;
    
    await sock.sendMessage(message.key.remoteJid, { text: stats });
  } catch (error) {
    console.error('Error showing stats:', error);
  }
}

// Show recent messages
async function showRecentMessages(sock, message, args) {
  try {
    const limit = Math.min(parseInt(args[0]) || 10, 20);
    const type = args[1] || 'all'; // all, received, sent
    
    let recentMessages = [];
    
    if (type === 'received' || type === 'all') {
      recentMessages = recentMessages.concat(yourMessages.received.slice(-limit));
    }
    if (type === 'sent' || type === 'all') {
      recentMessages = recentMessages.concat(yourMessages.sent.slice(-limit));
    }
    
    // Sort by timestamp and get most recent
    recentMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    recentMessages = recentMessages.slice(0, limit);
    
    let response = `📨 RECENT MESSAGES (Last ${limit} ${type}):\n\n`;
    
    if (recentMessages.length > 0) {
      recentMessages.forEach((msg, index) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const date = new Date(msg.timestamp).toLocaleDateString();
        const direction = msg.from === message.key.remoteJid ? '📤 TO' : '📥 FROM';
        const contact = msg.from.replace('@s.whatsapp.net', '');
        const preview = msg.text ? (msg.text.length > 30 ? msg.text.substring(0, 30) + '...' : msg.text) : `[${msg.type}]`;
        
        response += `${index + 1}. [${date} ${time}] ${direction} ${contact}\n   ${preview}\n\n`;
      });
    } else {
      response += `No recent ${type} messages found.\n`;
    }
    
    response += `💡 Use .recent [number] [received/sent/all] for more options`;
    
    await sock.sendMessage(message.key.remoteJid, { text: response });
  } catch (error) {
    console.error('Error showing recent messages:', error);
  }
}

// Show contacts and message counts
async function showContacts(sock, message, args) {
  try {
    const limit = Math.min(parseInt(args[0]) || 10, 25);
    
    // Convert contacts map to array and sort by last message
    const contactsArray = Array.from(yourMessages.contacts.values())
      .sort((a, b) => new Date(b.lastMessage) - new Date(a.lastMessage))
      .slice(0, limit);
    
    let response = `👥 RECENT CONTACTS (Top ${limit}):\n\n`;
    
    if (contactsArray.length > 0) {
      contactsArray.forEach((contact, index) => {
        const time = new Date(contact.lastMessage).toLocaleTimeString();
        const date = new Date(contact.lastMessage).toLocaleDateString();
        const phone = contact.jid.replace('@s.whatsapp.net', '');
        
        response += `${index + 1}. ${phone}\n   Messages: ${contact.messageCount} | Last: ${date} ${time}\n\n`;
      });
    } else {
      response += `No contact data available.\n`;
    }
    
    response += `💡 Total contacts tracked: ${yourMessages.contacts.size}`;
    
    await sock.sendMessage(message.key.remoteJid, { text: response });
  } catch (error) {
    console.error('Error showing contacts:', error);
  }
}

// Search messages
async function searchMessages(sock, message, args) {
  try {
    if (args.length === 0) {
      await sock.sendMessage(message.key.remoteJid, { 
        text: "🔍 Usage: .search [keyword]\nExample: .search hello" 
      });
      return;
    }
    
    const keyword = args.join(' ').toLowerCase();
    const limit = 10;
    
    // Search in both received and sent messages
    const allMessages = [...yourMessages.received, ...yourMessages.sent];
    const matchingMessages = allMessages.filter(msg => 
      msg.text && msg.text.toLowerCase().includes(keyword)
    ).slice(0, limit);
    
    let response = `🔍 SEARCH RESULTS for "${keyword}":\n\n`;
    
    if (matchingMessages.length > 0) {
      matchingMessages.forEach((msg, index) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const date = new Date(msg.timestamp).toLocaleDateString();
        const direction = msg.from === message.key.remoteJid ? '📤 TO' : '📥 FROM';
        const contact = msg.from.replace('@s.whatsapp.net', '');
        
        response += `${index + 1}. [${date} ${time}] ${direction} ${contact}\n   ${msg.text}\n\n`;
      });
    } else {
      response += `No messages found containing "${keyword}".\n`;
    }
    
    response += `💡 Found ${matchingMessages.length} matches (showing first ${limit})`;
    
    await sock.sendMessage(message.key.remoteJid, { text: response });
  } catch (error) {
    console.error('Error searching messages:', error);
  }
}

// Send current pairing code information
async function sendCurrentPairingCode(sock, message, sender) {
  try {
    cleanupExpiredPairingCodes();
    
    let responseText = `🔐 WHATSAPP LINKED DEVICE SETUP\n\n`;
    responseText += `📱 Your Personal Number: ${YOUR_PERSONAL_NUMBER}\n\n`;
    responseText += `🔧 Authentication Mode: ${pairingMode ? 'Pairing Codes' : 'QR Code'}\n`;
    responseText += `🔄 Pairing Attempts: ${pairingAttemptCount}/${MAX_PAIRING_ATTEMPTS}\n\n`;
    
    if (currentWhatsAppPairingCode) {
      responseText += `🔐 Current Pairing Code:\n`;
      responseText += `• ${currentWhatsAppPairingCode}\n\n`;
      responseText += `📋 How to link this device:\n`;
      responseText += `1. Open WhatsApp on your phone\n`;
      responseText += `2. Go to Linked Devices\n`;
      responseText += `3. Tap "Link a Device"\n`;
      responseText += `4. Enter code: ${currentWhatsAppPairingCode}\n\n`;
      responseText += `⏰ Code expires in 10 minutes\n\n`;
    } else if (pairingMode) {
      responseText += `⏳ Generating new pairing code...\n\n`;
      responseText += `Please wait for the next pairing code to appear.\n\n`;
    } else {
      responseText += `📱 QR Code Mode Active\n\n`;
      responseText += `Please scan the QR code when it appears.\n\n`;
    }
    
    responseText += `🎯 This bot will receive ALL your personal WhatsApp messages\n`;
    responseText += `💬 Use .mystats to see your message statistics\n`;
    responseText += `📨 Use .recent to see recent messages\n`;
    responseText += `👥 Use .contacts to see message counts\n`;
    responseText += `🔍 Use .search to find messages`;
    
    await sock.sendMessage(sender, { text: responseText });
    
  } catch (error) {
    console.error('Error sending pairing code info:', error);
    await sock.sendMessage(sender, { text: "❌ Error retrieving pairing code information." });
  }
}

// Handle pair request
async function handlePairRequest(sock, message, sender) {
  try {
    cleanupExpiredPairingCodes();
    
    let responseText = `🔐 LINK YOUR PERSONAL WHATSAPP\n\n`;
    responseText += `📱 Your Number: ${YOUR_PERSONAL_NUMBER}\n`;
    responseText += `🔧 Mode: ${pairingMode ? 'Pairing Codes' : 'QR Code'}\n`;
    responseText += `🔄 Attempts: ${pairingAttemptCount}/${MAX_PAIRING_ATTEMPTS}\n\n`;
    
    if (currentWhatsAppPairingCode && pairingMode) {
      responseText += `🔐 Current Pairing Code: ${currentWhatsAppPairingCode}\n\n`;
      responseText += `📋 Instructions:\n`;
      responseText += `1. Open WhatsApp on your phone\n`;
      responseText += `2. Go to Settings → Linked Devices\n`;
      responseText += `3. Tap on "Link a Device"\n`;
      responseText += `4. Enter this code: ${currentWhatsAppPairingCode}\n\n`;
      responseText += `🎯 This will link as a new device to your personal account\n`;
      responseText += `💬 You'll receive all your messages here\n`;
      responseText += `📊 You can track messages with .mystats, .recent, .contacts, .search`;
    } else if (pairingMode) {
      responseText += `⏳ Generating new pairing code...\n\n`;
      responseText += `Please wait for the next pairing code to appear.\n`;
      responseText += `This is attempt ${pairingAttemptCount + 1}/${MAX_PAIRING_ATTEMPTS}\n\n`;
    } else {
      responseText += `📱 QR Code Mode Active\n\n`;
      responseText += `Please wait for the QR code to appear and scan it.\n\n`;
      responseText += `📸 How to scan:\n`;
      responseText += `1. WhatsApp → Linked Devices → Link a Device\n`;
      responseText += `2. Point your camera at the QR code\n`;
    }
    
    await sock.sendMessage(sender, { text: responseText });
    console.log(`🔐 Sent pairing information to ${sender}`);
    
  } catch (error) {
    console.error('Error handling pair request:', error);
    await sock.sendMessage(sender, { text: "❌ Error generating pairing information. Please try again." });
  }
}

// Handle pairing code verification
async function handlePairingCode(sock, message, code, sender) {
  try {
    cleanupExpiredPairingCodes();
    
    // Check if it's the current WhatsApp pairing code
    if (currentWhatsAppPairingCode && code === currentWhatsAppPairingCode) {
      // Pairing successful
      currentWhatsAppPairingCode = null;
      pairingCodeTimestamp = null;
      activePairingCodes.delete(code);
      pairingAttemptCount = 0; // Reset counter on successful pairing
      pairingMode = true; // Reset to pairing mode for next connection
      
      await sock.sendMessage(sender, {
        text: `✅ DEVICE LINKING SUCCESSFUL!\n\n` +
              `Your personal WhatsApp account has been successfully linked!\n\n` +
              `📱 This bot is now connected as a linked device\n` +
              `💬 You will receive all your personal messages here\n` +
              `👥 Group messages and individual chats will appear\n\n` +
              `📊 Use .mystats to see your message statistics\n` +
              `📨 Use .recent to see recent messages\n` +
              `👥 Use .contacts to see message counts\n` +
              `🔍 Use .search to find messages\n\n` +
              `🔔 You will now receive all incoming messages!`
      });
      
      console.log(`✅ Successful WhatsApp linking for ${YOUR_PERSONAL_NUMBER}`);
      
      return;
    }
    
    // Check other active codes
    const pairingData = activePairingCodes.get(code);
    if (!pairingData) {
      await sock.sendMessage(sender, { 
        text: "❌ Invalid or expired pairing code.\n\n" +
              "Use .pairingcode to see the current code or .pair for instructions."
      });
      return;
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
    this.pairingCodeDisplayed = false;
    this.pairingCodeTimer = null;
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log('🔗 Initializing WhatsApp connection as Linked Device...');
      console.log(`📱 Linking to personal number: ${YOUR_PERSONAL_NUMBER}`);
      console.log(`🔐 Starting with pairing code mode (${MAX_PAIRING_ATTEMPTS} attempts then QR code)`);

      // Reset counters for new connection attempt
      pairingAttemptCount = 0;
      pairingMode = true;

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

      sock = makeWASocket({
        version,
        logger: createSimpleLogger(),
        printQRInTerminal: false,
        auth: authState.state,
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
        // Enhanced pairing options for linked device
        shouldSyncHistoryMessage: () => true,
        syncFullHistory: true, // Sync your message history
        linkPreviewImageThumbnailWidth: 192,
        getMessage: async (key) => {
          return {
            conversation: "hello"
          }
        }
      });

      sock.ev.on('creds.update', authState.saveCreds);

      // Handle connection updates including QR code and pairing codes
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, pairingCode } = update;

        console.log('Connection status:', connection);

        // Handle REAL WhatsApp pairing code (only in pairing mode)
        if (pairingCode && pairingMode && !this.pairingCodeDisplayed) {
          pairingAttemptCount++;
          console.log(`🔐 REAL WhatsApp Pairing Code Received (Attempt ${pairingAttemptCount}/${MAX_PAIRING_ATTEMPTS}):`, pairingCode);
          this.pairingCodeDisplayed = true;
          displayWhatsAppPairingCode(pairingCode, pairingAttemptCount);
          
          // Set timer to switch to QR code after timeout or max attempts
          this.scheduleNextAuthMethod();
          return;
        }

        // Handle QR code generation (after pairing attempts or in QR mode)
        if (qr && (!pairingMode || pairingAttemptCount >= MAX_PAIRING_ATTEMPTS)) {
          if (pairingMode && pairingAttemptCount >= MAX_PAIRING_ATTEMPTS) {
            pairingMode = false;
            console.log('🔄 Switching to QR code mode after maximum pairing attempts');
          }
          
          this.qrDisplayCount++;
          displayQRCode(qr, this.qrDisplayCount);
          this.qrCodeGenerated = true;
        }

                  if (connection === 'close') {
            const shouldReconnect = 
              lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log('Connection closed, reconnecting:', shouldReconnect);

            if (shouldReconnect) {
              this.handleReconnection();
            } else {
              console.log('❌ Logged out, clearing auth and restarting...');
              this.clearAuthAndRestart();
            }
          } else if (connection === 'open') {
            console.log('✅ WhatsApp connection opened successfully!');
            this.handleSuccessfulConnection();
          }
        });

        // Handle incoming messages
        sock.ev.on('messages.upsert', async (messageData) => {
          const { messages, type } = messageData;
          
          if (type === 'notify') {
            for (const message of messages) {
              await processMessage(sock, message);
            }
          }
        });
  class ConnectionManager {
  constructor() {
    this.isConnecting = false;
    this.pairingCodeDisplayed = false;
    this.qrCodeGenerated = false;
    this.qrDisplayCount = 0;
    this.reconnectTimeout = null;
    this.pairingCodeTimer = null;
  }

  // Handle message receipts
  setupMessageReceipts() {
    sock.ev.on('message-receipt.update', (receipts) => {
      for (const { key, receipt } of receipts) {
        console.log(`📨 Message receipt: ${key.id} -> ${receipt.type}`);
      }
    });
  }

  scheduleNextAuthMethod() {
    // Clear any existing timer
    if (this.pairingCodeTimer) {
      clearTimeout(this.pairingCodeTimer);
    }

    // Schedule next authentication method
    this.pairingCodeTimer = setTimeout(() => {
      if (pairingAttemptCount < MAX_PAIRING_ATTEMPTS) {
        console.log(`🔄 Generating new pairing code (attempt ${pairingAttemptCount + 1}/${MAX_PAIRING_ATTEMPTS})`);
        this.pairingCodeDisplayed = false;

        // Force new connection to get fresh pairing code
        this.handleReconnection();
      } else {
        console.log('🔄 Maximum pairing attempts reached, switching to QR code mode');
        pairingMode = false;
        this.handleReconnection();
      }
    }, 45000); // 45 seconds between pairing codes
  }

  async initializeFreshAuth() {
    try {
      console.log('🔄 Starting fresh authentication process...');

      // Clear any existing auth data
      if (fs.existsSync('auth_info_baileys')) {
        fs.rmSync('auth_info_baileys', { recursive: true, force: true });
      }

      // Create new auth state
      const authState = await useMultiFileAuthState('auth_info_baileys');

      const { version } = await fetchLatestBaileysVersion();

      sock = makeWASocket({
        version,
        logger: createSimpleLogger(),
        printQRInTerminal: false,
        auth: authState.state,
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
        // Enhanced options for linked device
        shouldSyncHistoryMessage: () => true,
        syncFullHistory: false, // Don't sync full history initially
        linkPreviewImageThumbnailWidth: 192,
        // Critical: Set up as linked device properly
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        maxIdleTimeMs: 60000,
        emitOwnEvents: true,
        defaultQueryTimeoutMs: 60000,
        // Mobile device characteristics for better linking
        mobile: false, // This is a companion device
        getMessage: async (key) => {
          return {
            conversation: "message sync"
          };
        }
      });

      sock.ev.on('creds.update', authState.saveCreds);

      // Enhanced connection handling for fresh auth
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, pairingCode } = update;

        console.log('Fresh auth connection status:', connection);

        // Handle pairing code (primary method for fresh auth)
        if (pairingCode && pairingMode && !this.pairingCodeDisplayed) {
          pairingAttemptCount++;
          console.log(`🔐 Fresh Auth - Pairing Code (Attempt ${pairingAttemptCount}/${MAX_PAIRING_ATTEMPTS}):`, pairingCode);
          this.pairingCodeDisplayed = true;
          displayWhatsAppPairingCode(pairingCode, pairingAttemptCount);
          this.scheduleNextAuthMethod();
          return;
        }

        // Handle QR code as fallback
        if (qr && (!pairingMode || pairingAttemptCount >= MAX_PAIRING_ATTEMPTS)) {
          if (pairingMode && pairingAttemptCount >= MAX_PAIRING_ATTEMPTS) {
            pairingMode = false;
            console.log('🔄 Fresh Auth - Switching to QR code after max attempts');
          }

          this.qrDisplayCount++;
          displayQRCode(qr, this.qrDisplayCount);
          this.qrCodeGenerated = true;
        }

        if (connection === 'open') {
          console.log('✅ Fresh authentication successful!');
          this.handleSuccessfulConnection();
        }

        if (connection === 'close') {
          const shouldReconnect = 
            lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;

          if (shouldReconnect) {
            this.handleReconnection();
          }
        }
      });

      // Handle messages for fresh connection
      sock.ev.on('messages.upsert', async (messageData) => {
        const { messages, type } = messageData;

        if (type === 'notify') {
          for (const message of messages) {
            await processMessage(sock, message);
          }
        }
      });

      this.setupMessageReceipts();

    } catch (error) {
      console.error('❌ Fresh auth initialization error:', error);
      this.handleConnectionError(error);
    }
  }

  handleSuccessfulConnection() {
    isConnected = true;
    reconnectAttempts = 0;
    pairingAttemptCount = 0;
    this.pairingCodeDisplayed = false;
    this.qrCodeGenerated = false;

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║              WHATSAPP LINKED DEVICE ACTIVE               ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║                                                          ║');
    console.log(`║ ✅ Successfully linked to: ${YOUR_PERSONAL_NUMBER}                   ║`);
    console.log('║ 📱 Device status: Active and receiving messages         ║');
    console.log('║ 💬 Message tracking: Enabled                            ║');
    console.log('║ 👥 Contact sync: Active                                 ║');
    console.log('║                                                          ║');
    console.log('║ 🔔 You will now receive all personal WhatsApp messages  ║');
    console.log('║ 📊 Use .mystats to see your message statistics          ║');
    console.log('║ 📨 Use .recent to see recent messages                   ║');
    console.log('║ 👥 Use .contacts to see message counts                  ║');
    console.log('║ 🔍 Use .search to find specific messages                ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Send welcome message to your personal number
    if (sock) {
      setTimeout(async () => {
        try {
          await sock.sendMessage(YOUR_PERSONAL_JID, {
            text: `✅ WHATSAPP LINKED DEVICE ACTIVE\n\n` +
                  `Your personal WhatsApp is now connected to this bot!\n\n` +
                  `📱 Linked number: ${YOUR_PERSONAL_NUMBER}\n` +
                  `🔔 You will receive all messages here\n` +
                  `💬 Group and individual chats will appear\n\n` +
                  `Available commands:\n` +
                  `.mystats - Show message statistics\n` +
                  `.recent [number] - Show recent messages\n` +
                  `.contacts - Show contact list\n` +
                  `.search [keyword] - Search messages\n` +
                  `.status - Check bot status\n\n` +
                  `🔒 Your messages are stored locally and securely.`
          });
        } catch (error) {
          console.log('Note: Could not send welcome message (may not be fully synced yet)');
        }
      }, 3000);
    }
  }

  handleReconnection() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('❌ Maximum reconnection attempts reached. Restarting...');
      this.clearAuthAndRestart();
      return;
    }

    reconnectAttempts++;
    const delayTime = Math.min(RECONNECT_INTERVAL * reconnectAttempts, 300000); // Max 5 minutes

    console.log(`🔄 Attempting reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delayTime/1000}s`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delayTime);
  }

  handleConnectionError(error) {
    console.error('❌ Connection error:', error);
    isConnected = false;
    this.handleReconnection();
  }

  clearAuthAndRestart() {
    console.log('🧹 Clearing authentication data and restarting...');

    try {
      if (fs.existsSync('auth_info_baileys')) {
        fs.rmSync('auth_info_baileys', { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }

    // Reset all state
    isConnected = false;
    reconnectAttempts = 0;
    pairingAttemptCount = 0;
    pairingMode = true;
    this.pairingCodeDisplayed = false;
    this.qrCodeGenerated = false;
    this.qrDisplayCount = 0;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.pairingCodeTimer) {
      clearTimeout(this.pairingCodeTimer);
    }

    // Restart connection after cleanup
    setTimeout(() => {
      this.connect();
    }, 5000);
  }

  getStatus() {
    return {
      isConnected,
      reconnectAttempts,
      pairingAttemptCount,
      pairingMode,
      yourPersonalNumber: YOUR_PERSONAL_NUMBER,
      messageStats: {
        received: yourMessages.received.length,
        sent: yourMessages.sent.length,
        groups: yourMessages.groups.size,
        contacts: yourMessages.contacts.size
      }
    };
  }

  async disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.pairingCodeTimer) {
      clearTimeout(this.pairingCodeTimer);
    }
    if (sock) {
      await sock.end();
    }
    isConnected = false;
  }

  async connect() {
    try {
      this.isConnecting = true;
      console.log('🔗 Connecting to WhatsApp...');
      await this.initializeFreshAuth();
    } catch (error) {
      console.error('❌ Connection error:', error);
      this.handleConnectionError(error);
    } finally {
      this.isConnecting = false;
    }
  }
}

// Initialize connection manager
const connectionManager = new ConnectionManager();

// Express server for health checks
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  const status = connectionManager.getStatus();
  res.json({
    status: 'WhatsApp Linked Device Bot',
    connected: status.isConnected,
    personalNumber: status.yourPersonalNumber,
    pairingMode: status.pairingMode,
    attempts: status.pairingAttemptCount,
    messageStats: status.messageStats,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connected: isConnected,
    uptime: process.uptime() 
  });
});

app.get('/messages/stats', (req, res) => {
  res.json({
    received: yourMessages.received.length,
    sent: yourMessages.sent.length,
    groups: yourMessages.groups.size,
    contacts: yourMessages.contacts.size,
    recentReceived: yourMessages.received.slice(-5).map(msg => ({
      timestamp: msg.timestamp,
      from: msg.from,
      preview: msg.text?.substring(0, 50) || '[Media]'
    }))
  });
});

// Start function
async function start() {
  try {
    console.log('🚀 Starting WhatsApp Linked Device Bot...');
    console.log(`📱 Personal Number: ${YOUR_PERSONAL_NUMBER}`);
    console.log(`👑 Admins: ${CONSTANT_ADMINS.length} configured`);

    await ensureDirectories();
    await initializeDatabase();
    cleanupTempFiles();

    // Start connection
    await connectionManager.connect();

    // Start web server
    app.listen(PORT, () => {
      console.log(`🌐 Web server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📨 Message stats: http://localhost:${PORT}/messages/stats`);
    });

    // Regular cleanup
    setInterval(cleanupExpiredPairingCodes, 60000); // Every minute
    setInterval(cleanupTempFiles, 3600000); // Every hour

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await connectionManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  await connectionManager.disconnect();
  process.exit(0);
});

// Start the bot
start();

module.exports = {
  connectionManager,
  yourMessages,
  isAdmin,
  hasActiveSubscription
};