const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

// Import managers
const ComedyGroupManager = require('./group-manager');
const ActivationManager = require('./activation-manager');
const MusicManager = require('./music-manager');

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

// Initialize managers
const userManager = new UserManager();
const activationManager = new ActivationManager();
const groupManager = new ComedyGroupManager();
const musicManager = new MusicManager();

// Store for connection
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 50000;

// News countries and content
const AFRICAN_COUNTRIES = [
  "Nigeria", "South Africa", "Kenya", "Ghana", "Egypt",
  "Zimbabwe", "Tanzania", "Ethiopia", "Uganda", "Morocco",
  "Algeria", "Angola", "Zambia", "Mozambique", "Cameroon"
];

// Famous Zimbabwean and South African Comedians
const AFRICAN_COMEDIANS = {
  ZIMBABWE: [
    "Carl Joshua Ncube",
    "Doc Vikela",
    "Q Dube",
    "Long John",
    "Comic Pastor",
    "Mandy",
    "Ntando Van Moyo",
    "Tiripi Padero",
    "Prophet Passion Java",
    "Mama Vee"
  ],
  SOUTH_AFRICA: [
    "Trevor Noah",
    "Loyiso Gola",
    "David Kau",
    "Kagiso Lediga",
    "Riaad Moosa",
    "Celeste Ntuli",
    "Lasizwe Dambuza",
    "Tumi Morake",
    "Schalk Bezuidenhout",
    "Ntosh Madlingozi"
  ]
};

// YouTube search queries for Wild 'N Out and comedy
const YOUTUBE_SEARCH_QUERIES = [
  "Wild N Out South Africa",
  "Wild N Out Africa",
  "Zimbabwean comedy",
  "South African comedy",
  "Trevor Noah standup",
  "Carl Joshua Ncube",
  "Loyiso Gola",
  "David Kau comedy",
  "Nigerian comedy",
  "Kenyan comedy"
];

// Function to generate news content
async function generateNewsContent(country) {
  try {
    const countryMap = {
      'Nigeria': 'ng', 'South Africa': 'za', 'Kenya': 'ke', 'Ghana': 'gh',
      'Egypt': 'eg', 'Zimbabwe': 'zw', 'Tanzania': 'tz', 'Ethiopia': 'et',
      'Uganda': 'ug', 'Morocco': 'ma', 'Algeria': 'dz', 'Angola': 'ao',
      'Zambia': 'zm', 'Mozambique': 'mz', 'Cameroon': 'cm'
    };
    
    const countryCode = countryMap[country] || 'za';
    
    // In a real implementation, you would use NewsAPI here
    // const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=${countryCode}&apiKey=${NEWS_API_KEY}`);
    
    // For now, using mock data
    const newsTemplates = [
      `Breaking news from ${country}: Major developments in the technology sector.`,
      `${country} reports significant economic growth this quarter.`,
      `Sports update: ${country} national team wins international championship.`,
      `Cultural event in ${country}: Annual festival attracts global attention.`,
      `Weather alert: ${country} experiences unusual climate patterns.`
    ];
    
    return newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
  } catch (error) {
    console.error('Error generating news:', error);
    
    // Fallback news
    const fallbackNews = [
      `Latest updates from ${country}: Positive developments across various sectors.`,
      `${country} continues to make progress in economic development.`,
      `Cultural highlights from ${country} gaining international recognition.`
    ];
    
    return fallbackNews[Math.floor(Math.random() * fallbackNews.length)];
  }
}

// African joke generator
async function getAfricanJoke() {
  try {
    // Try to get joke from API first
    // const response = await axios.get('https://v2.jokeapi.dev/joke/Any?type=single');
    // if (response.data.joke) return response.data.joke;
    
    // Fallback African jokes
    const africanJokes = [
      "Why did the African chicken cross the road? To show the zebra it was possible!",
      "African time: When 2pm means see you tomorrow!",
      "How do you know you're in Africa? When the wifi password is '12345678' and it actually works!",
      "Why did the Nigerian man bring a ladder to the bar? He heard the drinks were on the house!",
      "South African traffic: Where robots are traffic lights and nobody knows why!",
      "Kenyan marathon: Where everyone is running except the watchman!",
      "Ghanaian party: When the music is so loud, the neighbors call to complain about the quiet parts!",
      "Zimbabwean dollar: The only currency that makes you a trillionaire and broke at the same time!",
      "Egyptian pyramid scheme: Literally!",
      "Tanzanian safari: Where animals have right of way and tourists have no say!"
    ];
    
    return africanJokes[Math.floor(Math.random() * africanJokes.length)];
  } catch (error) {
    console.error('Error getting joke:', error);
    return "Why did the African chicken cross the road? To get to the other side, African style!";
  }
}

// Comedian-specific content generator
function getComedianContent() {
  const allComedians = [...AFRICAN_COMEDIANS.ZIMBABWE, ...AFRICAN_COMEDIANS.SOUTH_AFRICA];
  const randomComedian = allComedians[Math.floor(Math.random() * allComedians.length)];
  
  const comedianQuotes = {
    "Carl Joshua Ncube": "In Zimbabwe, we don't have problems, we have opportunities to be creative!",
    "Trevor Noah": "The difference between America and Africa? In America, you have the American dream. In Africa, we have African reality!",
    "Loyiso Gola": "South African politics: Where every day is April Fool's Day!",
    "Doc Vikela": "Zimbabwean electricity: We have load shedding for your shedding load!",
    "Q Dube": "African parents: They never say 'I love you' but they'll kill for you!",
    "David Kau": "In South Africa, we have 11 official languages and still misunderstand each other!",
    "Celeste Ntuli": "Being a Zulu woman means you're born with a microphone in one hand and a wooden spoon in the other!",
    "Long John": "Zimbabwean economy: Where you need a calculator to buy bread!",
    "Riaad Moosa": "Being a doctor-comedian means I can diagnose your bad sense of humor!",
    "Tumi Morake": "African women: We don't break glass ceilings, we rebuild the whole building!"
  };
  
  return `🎤 ${randomComedian}: "${comedianQuotes[randomComedian] || 'Laughter is the best medicine, especially in Africa!'}"`;
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
            await groupManager.broadcastMessage(sock, message, args.slice(1));
          }
          break;
        case '.help':
          await showHelp(sock, message);
          break;
        case '.stats':
          if (isAdmin) {
            const groupCount = await groupManager.getGroupCount(sock);
            await sock.sendMessage(sender, {
              text: `📊 Bot Statistics:\nGroups: ${groupCount}\nConnected: ${isConnected}\nUptime: ${process.uptime().toFixed(2)}s`
            });
          }
          break;
        case '.music':
          await musicManager.handleMusicRequest(sock, message, args.slice(1));
          break;
        case '.comedy':
          await groupManager.sendComedyContent(sock, sender);
          break;
        case '.news':
          const country = args[1] || AFRICAN_COUNTRIES[Math.floor(Math.random() * AFRICAN_COUNTRIES.length)];
          const news = await generateNewsContent(country);
          await sock.sendMessage(sender, { text: `📰 News from ${country}:\n\n${news}` });
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

// Show help function
async function showHelp(sock, message) {
  const helpText = `
🤖 WhatsApp Bot Help 🤖

Admin Commands:
.activate [code] - Activate a user
.userinfo [number] - Get user information
.broadcast [message] - Broadcast message to all users
.stats - Show bot statistics

Content Commands:
.music [artist/song] - Get music information
.comedy - Get comedy content
.news [country] - Get news from African countries

Group Features:
- Auto-joins any group link received
- Posts news daily 7-9 PM from 15 African countries
- Weekend comedy updates every 20 minutes
- Music sharing with artist details
- Wild 'N Out videos every 5 hours
  `;

  await sock.sendMessage(message.key.remoteJid, { text: helpText });
}

// African content scheduler
function startAfricanContentScheduler() {
  let wildNOutCounter = 0;
  let musicShareCounter = 0;
  
  // Post content regularly
  setInterval(async () => {
    if (!isConnected) return;
    
    const now = new Date();
    const hours = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    try {
      // African news between 7 PM and 9 PM
      if (hours >= 19 && hours < 21) {
        const randomCountry = AFRICAN_COUNTRIES[Math.floor(Math.random() * AFRICAN_COUNTRIES.length)];
        const news = await generateNewsContent(randomCountry);
        await groupManager.sendToChannels(sock, `📰 ${randomCountry} News:\n\n${news}`);
      }
      
      // Weekend comedy every 20 minutes
      if (isWeekend) {
        wildNOutCounter++;
        
        // Every 5 hours (15 intervals of 20 minutes), send Wild 'N Out content
        if (wildNOutCounter >= 15) {
          await groupManager.sendToChannels(sock, "🎬 Wild 'N Out Africa Time! Check out the latest episodes on YouTube!");
          wildNOutCounter = 0;
        } else {
          // Regular comedy content
          const joke = await getAfricanJoke();
          const comedianContent = getComedianContent();
          
          await groupManager.sendToChannels(sock, `😂 African Comedy:\n\n${joke}\n\n${comedianContent}`);
        }
      }
      
      // Music sharing every 6 hours
      musicShareCounter++;
      if (musicShareCounter >= 18) { // 6 hours (18 intervals of 20 minutes)
        const musicContent = await musicManager.getRandomMusicContent();
        await groupManager.sendToChannels(sock, musicContent);
        musicShareCounter = 0;
      }
      
      // Daily comedy at specific times
      if ([12, 18, 22].includes(hours) && now.getMinutes() < 10) {
        const joke = await getAfricanJoke();
        await groupManager.sendToChannels(sock, `😄 Daily Laugh:\n\n${joke}`);
      }
      
    } catch (error) {
      console.error('Error in content scheduler:', error);
    }
  }, 20 * 60 * 1000); // Check every 20 minutes
}

async function startBot() {
  try {
    console.log('🚀 Starting WhatsApp Bot with African Content...');
    await ensureDirectories();
    await connectionManager.connect();
    startAfricanContentScheduler();
    console.log('✅ African content scheduler started');
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