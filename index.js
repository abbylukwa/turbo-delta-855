const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

// Import managers
const ChannelManager = require('./group-manager');

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
const channelManager = new ChannelManager();

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
    // In a real implementation, you would use NewsAPI here
    // For now, using mock data with more detailed content
    const newsTemplates = [
      `📰 BREAKING NEWS from ${country}:\n\nMajor developments in the technology sector as ${country} launches new innovation hub. Industry leaders gather to discuss future technological advancements that will transform the economy. Experts predict significant growth in the tech sector over the next five years.\n\n#${country.replace(/\s+/g, '')}News #TechInnovation`,
      
      `💰 ECONOMIC UPDATE for ${country}:\n\n${country} reports significant economic growth this quarter with GDP increasing by 4.2%. The central bank attributes this growth to increased foreign investment and strong performance in the agricultural and mining sectors. Economic analysts remain optimistic about continued growth.\n\n#${country.replace(/\s+/g, '')}Economy #EconomicGrowth`,
      
      `⚽ SPORTS VICTORY for ${country}:\n\n${country} national team wins international championship after thrilling final match. The team displayed exceptional skill and determination, bringing home the trophy for the first time in a decade. Celebrations erupt across the nation as fans rejoice in this historic victory.\n\n#${country.replace(/\s+/g, '')}Sports #Champions`,
      
      `🎭 CULTURAL HIGHLIGHTS from ${country}:\n\nAnnual cultural festival attracts global attention with spectacular displays of traditional music, dance, and art. The event, now in its 15th year, showcases ${country}'s rich heritage and has become a major tourist attraction, drawing visitors from around the world.\n\n#${country.replace(/\s+/g, '')}Culture #Festival`,
      
      `🌦️ WEATHER ALERT for ${country}:\n\nMeteorological department issues alert for unusual climate patterns expected this week. Residents advised to prepare for heavy rainfall and potential flooding in low-lying areas. Emergency services are on high alert and contingency plans have been activated.\n\n#${country.replace(/\s+/g, '')}Weather #Alert`
    ];
    
    return newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
  } catch (error) {
    console.error('Error generating news:', error);
    
    // Fallback news
    const fallbackNews = [
      `Latest updates from ${country}: Positive developments across various sectors as the nation continues to make progress. #${country.replace(/\s+/g, '')}News`,
      `${country} continues to make significant strides in economic development with new infrastructure projects underway. #${country.replace(/\s+/g, '')}Development`,
      `Cultural highlights from ${country} are gaining international recognition, showcasing the nation's rich heritage. #${country.replace(/\s+/g, '')}Culture`
    ];
    
    return fallbackNews[Math.floor(Math.random() * fallbackNews.length)];
  }
}

// Function to get music content from various sources
async function getMusicContent() {
  try {
    // Array of popular artists to feature
    const popularArtists = [
      {
        name: "Burna Boy",
        song: "Last Last",
        album: "Love, Damini",
        year: "2022",
        trivia: "Sample uses Toni Braxton's 'He Wasn't Man Enough' and became a global hit"
      },
      {
        name: "Wizkid",
        song: "Essence",
        album: "Made in Lagos",
        year: "2020",
        trivia: "Featured Tems and became first Nigerian song to chart on Billboard Hot 100"
      },
      {
        name: "Black Coffee",
        song: "Drive",
        album: "Subconsciously",
        year: "2021",
        trivia: "Won Grammy Award for Best Dance/Electronic Album in 2022"
      },
      {
        name: "Sauti Sol",
        song: "Melanin",
        album: "Afrikan Sauce",
        year: "2019",
        trivia: "Kenyan band that has gained international recognition for their Afro-pop sound"
      },
      {
        name: "Fally Ipupa",
        song: "Control",
        album: "Tokooos",
        year: "2017",
        trivia: "Congolese artist known for his smooth vocals and dance moves"
      },
      {
        name: "Jah Prayzah",
        song: "Goto",
        album: "Mudhara Vachauya",
        year: "2017",
        trivia: "Zimbabwean artist blending traditional sounds with modern production"
      },
      {
        name: "Winky D",
        song: "Musarove Biggy",
        album: "Njema",
        year: "2019",
        trivia: "Zimbabwean dancehall artist known for social commentary in his music"
      },
      {
        name: "Alick Macheso",
        song: "Zvakanaka Zvakadaro",
        album: "Zvakanaka Zvakadaro",
        year: "2018",
        trivia: "Sungura legend from Zimbabwe with career spanning decades"
      }
    ];

    const artist = popularArtists[Math.floor(Math.random() * popularArtists.length)];
    
    // Try to get additional info from YouTube (in a real implementation)
    let youtubeInfo = "";
    try {
      // This would be replaced with actual YouTube API call
      youtubeInfo = `🎥 Watch on YouTube: https://youtube.com/results?search_query=${encodeURIComponent(artist.name + " " + artist.song)}`;
    } catch (error) {
      console.error('Error getting YouTube info:', error);
    }

    // Construct the music post
    const musicPost = `🎵 MUSIC SPOTLIGHT: ${artist.name} - ${artist.song}\n\n` +
                     `Album: ${artist.album} (${artist.year})\n\n` +
                     `Did you know? ${artist.trivia}\n\n` +
                     `${youtubeInfo}\n\n` +
                     `#${artist.name.replace(/\s+/g, '')} #${artist.song.replace(/\s+/g, '')} #AfricanMusic`;

    return musicPost;
  } catch (error) {
    console.error('Error getting music content:', error);
    return "🎵 Discover new African music hits! Follow our channel for daily music updates. #AfricanMusic #NewReleases";
  }
}

// African joke generator
async function getAfricanJoke() {
  try {
    // Fallback African jokes
    const africanJokes = [
      "Why did the African chicken cross the road? To show the zebra it was possible! 🐔🦓",
      "African time: When 2pm means see you tomorrow! ⏰\n\n#AfricanTime #AfricanHumor",
      "How do you know you're in Africa? When the wifi password is '12345678' and it actually works! 📶\n\n#AfricanTech #Funny",
      "Why did the Nigerian man bring a ladder to the bar? He heard the drinks were on the house! 🍹\n\n#NaijaJokes",
      "South African traffic: Where robots are traffic lights and nobody knows why! 🚦\n\n#SouthAfrica #RobotLights",
      "Kenyan marathon: Where everyone is running except the watchman! 🏃‍♂️\n\n#KenyanHumor",
      "Ghanaian party: When the music is so loud, the neighbors call to complain about the quiet parts! 🎵\n\n#GhanaJokes",
      "Zimbabwean dollar: The only currency that makes you a trillionaire and broke at the same time! 💵\n\n#ZimJokes #Currency",
      "Egyptian pyramid scheme: Literally! 🔺\n\n#EgyptHumor",
      "Tanzanian safari: Where animals have right of way and tourists have no say! 🐘\n\n#Tanzania #SafariHumor"
    ];
    
    return africanJokes[Math.floor(Math.random() * africanJokes.length)];
  } catch (error) {
    console.error('Error getting joke:', error);
    return "Why did the African chicken cross the road? To get to the other side, African style! 🐔\n\n#AfricanHumor #Jokes";
  }
}

// Comedian-specific content generator
function getComedianContent() {
  const allComedians = [...AFRICAN_COMEDIANS.ZIMBABWE, ...AFRICAN_COMEDIANS.SOUTH_AFRICA];
  const randomComedian = allComedians[Math.floor(Math.random() * allComedians.length)];
  
  const comedianQuotes = {
    "Carl Joshua Ncube": "In Zimbabwe, we don't have problems, we have opportunities to be creative! 🇿🇼",
    "Trevor Noah": "The difference between America and Africa? In America, you have the American dream. In Africa, we have African reality! 🌍",
    "Loyiso Gola": "South African politics: Where every day is April Fool's Day! 🤡",
    "Doc Vikela": "Zimbabwean electricity: We have load shedding for your shedding load! 💡",
    "Q Dube": "African parents: They never say 'I love you' but they'll kill for you! ❤️",
    "David Kau": "In South Africa, we have 11 official languages and still misunderstand each other! 🗣️",
    "Celeste Ntuli": "Being a Zulu woman means you're born with a microphone in one hand and a wooden spoon in the other! 🎤",
    "Long John": "Zimbabwean economy: Where you need a calculator to buy bread! 🧮",
    "Riaad Moosa": "Being a doctor-comedian means I can diagnose your bad sense of humor! 😷",
    "Tumi Morake": "African women: We don't break glass ceilings, we rebuild the whole building! 💪"
  };
  
  return `🎤 COMEDIAN SPOTLIGHT: ${randomComedian}\n\n"${comedianQuotes[randomComedian] || 'Laughter is the best medicine, especially in Africa! 😂'}"\n\n#${randomComedian.replace(/\s+/g, '')} #AfricanComedy`;
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
    
    // Process commands
    if (command.startsWith('.')) {
      switch (command) {
        case '.help':
          await showHelp(sock, message);
          break;
        case '.stats':
          if (isAdmin) {
            await sock.sendMessage(sender, {
              text: `📊 Bot Statistics:\nConnected: ${isConnected}\nUptime: ${process.uptime().toFixed(2)}s\nChannels: News & Music`
            });
          }
          break;
        case '.testnews':
          if (isAdmin) {
            const country = AFRICAN_COUNTRIES[Math.floor(Math.random() * AFRICAN_COUNTRIES.length)];
            const news = await generateNewsContent(country);
            await sock.sendMessage(NEWS_CHANNEL_ID, { text: news });
            await sock.sendMessage(sender, { text: `✅ Test news sent to news channel` });
          }
          break;
        case '.testmusic':
          if (isAdmin) {
            const music = await getMusicContent();
            await sock.sendMessage(MUSIC_CHANNEL_ID, { text: music });
            await sock.sendMessage(sender, { text: `✅ Test music sent to music channel` });
          }
          break;
        case '.testcomedy':
          if (isAdmin) {
            const joke = await getAfricanJoke();
            await sock.sendMessage(NEWS_CHANNEL_ID, { text: joke });
            await sock.sendMessage(sender, { text: `✅ Test comedy sent to news channel` });
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

// Show help function
async function showHelp(sock, message) {
  const helpText = `
🤖 WhatsApp Bot Help 🤖

Admin Commands:
.help - Show this help message
.stats - Show bot statistics
.testnews - Send test news to news channel
.testmusic - Send test music to music channel
.testcomedy - Send test comedy to news channel

Channel Features:
- News Channel: https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M
  * African news daily 7-9 PM from 15 countries
  * Comedy content and jokes
  * Weekend updates every 20 minutes

- Music Channel: https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S
  * Music features from African artists
  * Artist details and trivia
  * YouTube links and recommendations
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
      // African news between 7 PM and 9 PM to NEWS channel
      if (hours >= 19 && hours < 21) {
        const randomCountry = AFRICAN_COUNTRIES[Math.floor(Math.random() * AFRICAN_COUNTRIES.length)];
        const news = await generateNewsContent(randomCountry);
        await sock.sendMessage(NEWS_CHANNEL_ID, { text: news });
        console.log(`Posted news to news channel: ${randomCountry}`);
      }
      
      // Weekend comedy every 20 minutes to NEWS channel
      if (isWeekend) {
        wildNOutCounter++;
        
        // Every 5 hours (15 intervals of 20 minutes), send Wild 'N Out content
        if (wildNOutCounter >= 15) {
          await sock.sendMessage(NEWS_CHANNEL_ID, { 
            text: "🎬 Wild 'N Out Africa Time!\n\nCheck out the latest episodes of Wild 'N Out featuring African comedians and celebrities. Full of laughs, improv comedy, and hilarious games!\n\n#WildNOut #AfricanComedy #Improv" 
          });
          wildNOutCounter = 0;
          console.log("Posted Wild 'N Out content to news channel");
        } else {
          // Regular comedy content to NEWS channel
          const joke = await getAfricanJoke();
          const comedianContent = getComedianContent();
          
          await sock.sendMessage(NEWS_CHANNEL_ID, { 
            text: `${comedianContent}\n\n${joke}` 
          });
          console.log("Posted comedy content to news channel");
        }
      }
      
      // Music sharing every 6 hours to MUSIC channel
      musicShareCounter++;
      if (musicShareCounter >= 18) { // 6 hours (18 intervals of 20 minutes)
        const musicContent = await getMusicContent();
        await sock.sendMessage(MUSIC_CHANNEL_ID, { text: musicContent });
        musicShareCounter = 0;
        console.log("Posted music content to music channel");
      }
      
      // Daily comedy at specific times to NEWS channel
      if ([12, 18, 22].includes(hours) && now.getMinutes() < 10) {
        const joke = await getAfricanJoke();
        await sock.sendMessage(NEWS_CHANNEL_ID, { text: `😄 DAILY LAUGH:\n\n${joke}` });
        console.log("Posted daily laugh to news channel");
      }
      
    } catch (error) {
      console.error('Error in content scheduler:', error);
    }
  }, 20 * 60 * 1000); // Check every 20 minutes
}

async function startBot() {
  try {
    console.log('🚀 Starting WhatsApp Bot with Channel Content...');
    await ensureDirectories();
    await connectionManager.connect();
    startAfricanContentScheduler();
    console.log('✅ Channel content scheduler started');
    console.log('📰 News Channel: https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M');
    console.log('🎵 Music Channel: https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S');
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
    timestamp: new Date().toISOString(),
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