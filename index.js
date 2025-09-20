const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

// Command number
const COMMAND_NUMBER = '263717457592@s.whatsapp.net';

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

// User Manager
class UserManager {
  async getUserInfo(sock, message, args) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "User info feature will be implemented here."
    });
  }
}

// Activation Manager (kept separate as requested)
class ActivationManager {
  constructor() {
    this.activationFile = path.join(__dirname, 'data', 'activation.json');
    this.ensureActivationFile();
  }
  
  ensureActivationFile() {
    if (!fs.existsSync(path.dirname(this.activationFile))) {
      fs.mkdirSync(path.dirname(this.activationFile), { recursive: true });
    }
    if (!fs.existsSync(this.activationFile)) {
      fs.writeFileSync(this.activationFile, JSON.stringify({}));
    }
  }
  
  async handleActivation(sock, message, args, sender) {
    // Activation logic here - separate from main bot
    await sock.sendMessage(message.key.remoteJid, {
      text: "Activation feature will be implemented here."
    });
  }
  
  // Method to check if a user is activated
  isUserActivated(userId) {
    try {
      const data = fs.readFileSync(this.activationFile, 'utf8');
      const activations = JSON.parse(data);
      return activations[userId] === true;
    } catch (error) {
      console.error('Error reading activation file:', error);
      return false;
    }
  }
}

// Group Manager (Updated with requested features)
class GroupManager {
  constructor() {
    this.groupsFile = path.join(__dirname, 'data', 'groups.json');
    this.schedulesFile = path.join(__dirname, 'data', 'schedules.json');
    this.groupLinksFile = path.join(__dirname, 'data', 'group_links.json');
    this.commandNumber = '263717457592@s.whatsapp.net';
    this.autoJoinEnabled = true;
    this.adminNumber = '263717457592@s.whatsapp.net';
    this.joinedGroups = new Set();
    this.channelItemsCount = new Map(); // Track items sent per channel
    this.ensureDataFiles();
    this.loadGroups();
  }

  ensureDataFiles() {
    const dir = path.dirname(this.groupsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const files = [this.groupsFile, this.schedulesFile];
    files.forEach(file => {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([]));
      }
    });
  }

  loadGroups() {
    try {
      if (fs.existsSync(this.groupsFile)) {
        const data = fs.readFileSync(this.groupsFile, 'utf8');
        const groups = JSON.parse(data);
        groups.forEach(group => this.joinedGroups.add(group.id));
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  }

  saveGroups() {
    const groups = Array.from(this.joinedGroups).map(id => ({ id }));
    fs.writeFileSync(this.groupsFile, JSON.stringify(groups, null, 2));
  }

  async joinGroup(sock, groupLink) {
    try {
      // Extract group ID from the link
      const groupId = groupLink.split('https://chat.whatsapp.com/')[1];
      if (!groupId) return false;

      // Join the group using the invite code
      await sock.groupAcceptInvite(groupId);
      this.joinedGroups.add(groupId);
      this.saveGroups();
      
      console.log(`Joined group: ${groupId}`);
      return true;
    } catch (error) {
      console.error('Error joining group:', error);
      return false;
    }
  }

  async handleGroupLink(sock, message) {
    const text = message.message.conversation || '';
    const groupLinkMatch = text.match(/https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]+/);
    
    if (groupLinkMatch) {
      const groupLink = groupLinkMatch[0];
      const joined = await this.joinGroup(sock, groupLink);
      
      if (joined) {
        await sock.sendMessage(message.key.remoteJid, {
          text: "✅ Successfully joined the group!"
        });
      } else {
        await sock.sendMessage(message.key.remoteJid, {
          text: "❌ Failed to join the group. The link might be invalid."
        });
      }
    }
  }

  async sendToChannels(sock, content) {
    // Implementation for sending content to channels
    for (const groupId of this.joinedGroups) {
      try {
        await sock.sendMessage(groupId, { text: content });
        
        // Update item count for this channel
        const count = (this.channelItemsCount.get(groupId) || 0) + 1;
        this.channelItemsCount.set(groupId, count);
        
        // If 4 items sent, share the channel link
        if (count % 4 === 0) {
          const inviteCode = await sock.groupGetInviteCode(groupId);
          const groupLink = `https://chat.whatsapp.com/${inviteCode}`;
          
          // Send to all groups
          for (const targetGroupId of this.joinedGroups) {
            if (targetGroupId !== groupId) {
              await sock.sendMessage(targetGroupId, {
                text: `Join our channel: ${groupLink}`
              });
            }
          }
        }
        
        // Delay to avoid rate limiting
        await delay(1000);
      } catch (error) {
        console.error(`Error sending to group ${groupId}:`, error);
      }
    }
  }

  // Method to get count of groups by scanning messages
  async getGroupCount(sock) {
    try {
      // This would typically scan messages to identify groups
      // For simplicity, we'll return the count of joined groups
      return this.joinedGroups.size;
    } catch (error) {
      console.error('Error getting group count:', error);
      return 0;
    }
  }
}

// Admin Commands
class AdminCommands {
  async broadcastMessage(sock, message, args, groupManager) {
    const text = args.join(' ');
    if (!text) {
      await sock.sendMessage(message.key.remoteJid, {
        text: "Please provide a message to broadcast."
      });
      return;
    }

    // Send to all groups
    for (const groupId of groupManager.joinedGroups) {
      try {
        await sock.sendMessage(groupId, { text });
        await delay(500); // Avoid rate limiting
      } catch (error) {
        console.error(`Error broadcasting to group ${groupId}:`, error);
      }
    }

    await sock.sendMessage(message.key.remoteJid, {
      text: `✅ Broadcast sent to ${groupManager.joinedGroups.size} groups.`
    });
  }
}

// General Commands
class GeneralCommands {
  async showHelp(sock, message) {
    const helpText = `
🤖 WhatsApp Bot Help 🤖

Admin Commands:
.activate [code] - Activate a user
.userinfo [number] - Get user information
.ban [number] - Ban a user
.unban [number] - Unban a user
.broadcast [message] - Broadcast message to all users
.stats - Show bot statistics
.restart - Restart the bot

Group Commands:
.creategroup [name] - Create a new group
.addtogroup [number] - Add user to group
.removefromgroup [number] - Remove user from group
.grouplink - Get group invite link
.listgroups - List all groups
.autojointoggle - Toggle auto-join feature

General Commands:
.help - Show this help message
    `;

    await sock.sendMessage(message.key.remoteJid, { text: helpText });
  }
}

// Initialize managers
const userManager = new UserManager();
const activationManager = new ActivationManager();
const groupManager = new GroupManager();
const adminCommands = new AdminCommands();
const generalCommands = new GeneralCommands();

// Store for connection
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 50000;

// News countries and content
const NEWS_COUNTRIES = [
  "USA", "UK", "Canada", "Australia", "Germany", 
  "France", "Japan", "China", "India", "Brazil",
  "South Africa", "Nigeria", "Kenya"
];

// Function to generate news content
function generateNewsContent() {
  const country = NEWS_COUNTRIES[Math.floor(Math.random() * NEWS_COUNTRIES.length)];
  const headlines = [
    `Breaking news from ${country}: Major development in technology sector.`,
    `${country} reports economic growth in latest quarter.`,
    `Sports update from ${country}: National team wins international championship.`,
    `Weather alert in ${country}: Unusual patterns expected this week.`,
    `Cultural event in ${country}: Annual festival attracts global attention.`
  ];
  
  return headlines[Math.floor(Math.random() * headlines.length)];
}

// Ensure data directories exist
async function ensureDirectories() {
  try {
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    }
    if (!fs.existsSync(path.join(__dirname, 'auth_info_baileys'))) {
      fs.mkdirSync(path.join(__dirname, 'auth_info_baileys'), { recursive: true });
    }
    console.log('✅ Data directories created successfully');
  } catch (error) {
    console.error('❌ Error creating directories:', error);
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
    console.log('No auth files to clear or error clearing:', error.message);
    return false;
  }
}

// Connection manager class
class ConnectionManager {
  constructor() {
    this.isConnecting = false;
    this.reconnectTimeout = null;
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
      const { version, isLatest } = await fetchLatestBaileysVersion();
      
      console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      sock = makeWASocket({
        version,
        logger: createSimpleLogger(),
        printQRInTerminal: true,
        auth: state.auth,
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
      });

      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
          const shouldReconnect = 
            lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
          
          console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
          
          if (shouldReconnect) {
            this.reconnect();
          }
        } else if (connection === 'open') {
          console.log('✅ Connection opened successfully');
          isConnected = true;
          reconnectAttempts = 0;
          this.isConnecting = false;
        }
      });

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
    if (sock) {
      sock.ws.close();
      sock = null;
    }
    isConnected = false;
    this.isConnecting = false;
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
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above to pair your device');
  }

  if (pairingCode) {
    console.log(`Pairing code: ${pairingCode}`);
  }

  console.log('═'.repeat(60));
}

// Function to process incoming messages
async function processMessage(sock, message) {
  try {
    if (!message.message) return;
    
    const messageType = Object.keys(message.message)[0];
    let text = '';
    
    if (messageType === 'conversation') {
      text = message.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
      text = message.message.extendedTextMessage.text;
    }
    
    if (!text) return;
    
    const sender = message.key.remoteJid;
    const isAdmin = sender === COMMAND_NUMBER;
    const args = text.trim().split(' ');
    const command = args[0].toLowerCase();
    
    // Handle group links (auto-join without saving)
    if (text.includes('https://chat.whatsapp.com/')) {
      await groupManager.handleGroupLink(sock, message);
      return;
    }
    
    // Process commands
    if (command.startsWith('.')) {
      switch (command) {
        case '.activate':
          await activationManager.handleActivation(sock, message, args.slice(1), sender);
          break;
        case '.userinfo':
          await userManager.getUserInfo(sock, message, args.slice(1));
          break;
        case '.broadcast':
          if (isAdmin) {
            await adminCommands.broadcastMessage(sock, message, args.slice(1), groupManager);
          }
          break;
        case '.help':
          await generalCommands.showHelp(sock, message);
          break;
        case '.stats':
          if (isAdmin) {
            const groupCount = await groupManager.getGroupCount(sock);
            await sock.sendMessage(sender, {
              text: `📊 Bot Statistics:\nGroups: ${groupCount}\nConnected: ${isConnected}\nUptime: ${process.uptime().toFixed(2)}s`
            });
          }
          break;
        default:
          // Unknown command
          break;
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

// News posting scheduler
function startNewsScheduler() {
  // Post news from 7 to 9 PM
  setInterval(async () => {
    const now = new Date();
    const hours = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    // Check if it's between 7 PM and 9 PM
    if (hours >= 19 && hours < 21) {
      const newsContent = generateNewsContent();
      await groupManager.sendToChannels(sock, newsContent);
    }
    
    // Weekend updates every 20 minutes
    if (isWeekend) {
      const newsContent = generateNewsContent();
      await groupManager.sendToChannels(sock, newsContent);
    }
  }, 20 * 60 * 1000); // Check every 20 minutes
}

async function startBot() {
  try {
    console.log('🚀 Starting WhatsApp Bot...');
    await ensureDirectories();
    await connectionManager.connect();
    startNewsScheduler();
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