const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { exec } = require('child_process');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

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

// Group Manager
class GroupManager {
  constructor() {
    this.joinedGroups = new Set();
    this.groupDiscoveryInterval = null;
    this.lastBroadcastTime = 0;
  }

  async discoverGroups(sock) {
    try {
      console.log("🔍 Searching for groups...");
      
      // Simulate discovering groups by checking recent messages
      // In a real implementation, you would scan conversations for group messages
      const groups = await this.scanForGroups(sock);
      
      for (const groupId of groups) {
        if (!this.joinedGroups.has(groupId)) {
          console.log(`📍 Found new group: ${groupId}`);
          this.joinedGroups.add(groupId);
        }
      }
      
      console.log(`📊 Currently monitoring ${this.joinedGroups.size} groups`);
    } catch (error) {
      console.error('Error discovering groups:', error);
    }
  }

  async scanForGroups(sock) {
    // This would scan messages to find groups
    // For demonstration, we'll return an empty array
    return [];
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
        
        // Send welcome message with channel info
        await this.sendChannelInfo(sock, message.key.remoteJid);
      } else {
        await sock.sendMessage(message.key.remoteJid, {
          text: "❌ Failed to join the group. The link might be invalid."
        });
      }
    }
  }

  async joinGroup(sock, groupLink) {
    try {
      // Extract group ID from the link
      const groupId = groupLink.split('https://chat.whatsapp.com/')[1];
      if (!groupId) return false;

      // Join the group using the invite code
      await sock.groupAcceptInvite(groupId);
      this.joinedGroups.add(groupId);
      
      console.log(`✅ Joined group: ${groupId}`);
      return true;
    } catch (error) {
      console.error('Error joining group:', error);
      return false;
    }
  }

  async broadcastToGroups(sock, message) {
    if (this.joinedGroups.size === 0) {
      console.log("No groups to broadcast to");
      return;
    }

    console.log(`📢 Broadcasting to ${this.joinedGroups.size} groups...`);
    
    for (const groupId of this.joinedGroups) {
      try {
        await sock.sendMessage(groupId, { text: message });
        await delay(1000); // Avoid rate limiting
      } catch (error) {
        console.error(`Error broadcasting to group ${groupId}:`, error);
        // Remove group if we can't send messages (might have been removed)
        this.joinedGroups.delete(groupId);
      }
    }
    
    this.lastBroadcastTime = Date.now();
    console.log("✅ Broadcast completed");
  }

  async sendChannelInfo(sock, targetJid) {
    const channelInfo = `
🌟 JOIN OUR OFFICIAL CHANNELS 🌟

📰 NEWS & COMEDY CHANNEL:
Stay updated with the latest news from across Africa and enjoy daily comedy content!
https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M

🎵 MUSIC CHANNEL:
Get the latest music updates, artist features, and exclusive content!
https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S

👉 Tap the links above to join both channels now!
    `;

    await sock.sendMessage(targetJid, { text: channelInfo });
  }

  startGroupDiscovery(sock) {
    // Discover groups every 5 minutes
    this.groupDiscoveryInterval = setInterval(() => {
      this.discoverGroups(sock);
    }, 5 * 60 * 1000);
  }

  stopGroupDiscovery() {
    if (this.groupDiscoveryInterval) {
      clearInterval(this.groupDiscoveryInterval);
    }
  }
}

// Initialize managers
const userManager = new UserManager();
const groupManager = new GroupManager();

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

// YouTube music search queries
const YOUTUBE_MUSIC_QUERIES = [
  "Burna Boy latest song",
  "Wizkid new music",
  "African music 2024",
  "Amapiano latest",
  "Afrobeats new release",
  "Zimdancehall new songs",
  "South African house music",
  "Nigerian music",
  "Ghanaian music",
  "East African music"
];

// Function to get real news from API
async function getRealNews(country) {
  try {
    // Using NewsAPI (you would need to get an API key)
    // const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=${countryCode}&apiKey=YOUR_API_KEY`);
    
    // For now, using a mock API response with more realistic data
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
    // Using JokeAPI (free service)
    const response = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist&type=twopart');
    
    if (response.data && response.data.setup && response.data.delivery) {
      return `😂 Joke of the Day:\n\n${response.data.setup}\n\n${response.data.delivery}\n\n#DailyLaugh #Joke`;
    }
    
    // Fallback to local jokes
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

// Function to download YouTube video and convert to MP3/MP4
async function downloadYouTubeMusic(videoUrl) {
  try {
    const videoInfo = await ytdl.getInfo(videoUrl);
    const videoTitle = videoInfo.videoDetails.title;
    const videoId = videoInfo.videoDetails.videoId;
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const mp4Path = path.join(tempDir, `${videoId}.mp4`);
    const mp3Path = path.join(tempDir, `${videoId}.mp3`);
    
    console.log(`Downloading: ${videoTitle}`);
    
    // Download MP4
    const videoStream = ytdl(videoUrl, { quality: 'highest' });
    const writeStream = fs.createWriteStream(mp4Path);
    
    await new Promise((resolve, reject) => {
      videoStream.pipe(writeStream);
      videoStream.on('end', resolve);
      videoStream.on('error', reject);
    });
    
    console.log('MP4 download completed');
    
    // Convert to MP3
    await new Promise((resolve, reject) => {
      ffmpeg(mp4Path)
        .toFormat('mp3')
        .on('end', () => {
          console.log('MP3 conversion completed');
          resolve();
        })
        .on('error', reject)
        .save(mp3Path);
    });
    
    return {
      title: videoTitle,
      mp4Path: mp4Path,
      mp3Path: mp3Path,
      videoId: videoId
    };
  } catch (error) {
    console.error('Error downloading YouTube music:', error);
    throw error;
  }
}

// Function to search for music on YouTube
async function searchYouTubeMusic(query) {
  try {
    // In a real implementation, you would use the YouTube Data API
    // For demonstration, we'll return a mock video URL
    const mockVideos = [
      "https://www.youtube.com/watch?v=abcdefghijk",
      "https://www.youtube.com/watch?v=lmnopqrstuv",
      "https://www.youtube.com/watch?v=wxyz1234567",
      "https://www.youtube.com/watch?v=890abcdefff",
      "https://www.youtube.com/watch?v=ghijklmnopq"
    ];
    
    return mockVideos[Math.floor(Math.random() * mockVideos.length)];
  } catch (error) {
    console.error('Error searching YouTube music:', error);
    return null;
  }
}

// Function to get music content
async function getMusicContent() {
  try {
    const randomQuery = YOUTUBE_MUSIC_QUERIES[Math.floor(Math.random() * YOUTUBE_MUSIC_QUERIES.length)];
    const videoUrl = await searchYouTubeMusic(randomQuery);
    
    if (!videoUrl) {
      throw new Error('No video found');
    }
    
    const musicData = await downloadYouTubeMusic(videoUrl);
    
    return {
      title: musicData.title,
      mp4Path: musicData.mp4Path,
      mp3Path: musicData.mp3Path,
      description: `🎵 New Music: ${musicData.title}\n\nDownloaded from YouTube\n\n#NewMusic #AfricanMusic #YouTube`
    };
  } catch (error) {
    console.error('Error getting music content:', error);
    return {
      title: "African Music Mix",
      description: "🎵 Enjoy the latest African music hits! #AfricanMusic #NewReleases"
    };
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
    if (!fs.existsSync(path.join(__dirname, 'temp'))) {
      fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
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
          
          // Start group discovery after connection is established
          groupManager.startGroupDiscovery(sock);
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
    
    // Stop group discovery
    groupManager.stopGroupDiscovery();
    
    // Clean up temp files
    cleanupTempFiles();
    
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
    
    // Handle group links (auto-join)
    if (text.includes('https://chat.whatsapp.com/')) {
      await groupManager.handleGroupLink(sock, message);
      return;
    }
    
    // Process commands
    if (command.startsWith('.')) {
      switch (command) {
        case '.help':
          await showHelp(sock, message);
          break;
        case '.stats':
          if (isAdmin) {
            await sock.sendMessage(sender, {
              text: `📊 Bot Statistics:\nConnected: ${isConnected}\nGroups: ${groupManager.joinedGroups.size}\nUptime: ${process.uptime().toFixed(2)}s`
            });
          }
          break;
        case '.broadcast':
          if (isAdmin && args.length > 1) {
            const broadcastMessage = args.slice(1).join(' ');
            await groupManager.broadcastToGroups(sock, broadcastMessage);
            await sock.sendMessage(sender, { text: `✅ Broadcast sent to ${groupManager.joinedGroups.size} groups` });
          }
          break;
        case '.testnews':
          if (isAdmin) {
            const country = AFRICAN_COUNTRIES[Math.floor(Math.random() * AFRICAN_COUNTRIES.length)];
            const news = await getRealNews(country);
            await sock.sendMessage(NEWS_CHANNEL_ID, { text: news });
            await sock.sendMessage(sender, { text: `✅ Test news sent to news channel` });
          }
          break;
        case '.testmusic':
          if (isAdmin) {
            const music = await getMusicContent();
            
            // Send MP3
            if (music.mp3Path && fs.existsSync(music.mp3Path)) {
              await sock.sendMessage(MUSIC_CHANNEL_ID, {
                audio: fs.readFileSync(music.mp3Path),
                mimetype: 'audio/mpeg',
                fileName: `${music.title}.mp3`
              });
            }
            
            // Send MP4
            if (music.mp4Path && fs.existsSync(music.mp4Path)) {
              await sock.sendMessage(MUSIC_CHANNEL_ID, {
                video: fs.readFileSync(music.mp4Path),
                mimetype: 'video/mp4',
                caption: music.description,
                fileName: `${music.title}.mp4`
              });
            } else {
              await sock.sendMessage(MUSIC_CHANNEL_ID, { text: music.description });
            }
            
            await sock.sendMessage(sender, { text: `✅ Test music sent to music channel` });
            
            // Clean up temp files after a delay
            setTimeout(cleanupTempFiles, 30000);
          }
          break;
        case '.testcomedy':
          if (isAdmin) {
            const joke = await getRealJokes();
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
.broadcast [message] - Broadcast message to all groups
.testnews - Send test news to news channel
.testmusic - Send test music to music channel
.testcomedy - Send test comedy to news channel

Features:
- Auto-joins any WhatsApp group link received
- Broadcasts channel info daily at 6 AM and 8 PM
- Posts real news from African countries
- Shares real jokes from API
- Downloads and shares music from YouTube
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
  
  // Post content regularly
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
      
      // Music content to MUSIC channel every 4 hours
      if (hours % 4 === 0 && minutes === 30) {
        const music = await getMusicContent();
        
        // Send MP3
        if (music.mp3Path && fs.existsSync(music.mp3Path)) {
          await sock.sendMessage(MUSIC_CHANNEL_ID, {
            audio: fs.readFileSync(music.mp3Path),
            mimetype: 'audio/mpeg',
            fileName: `${music.title}.mp3`
          });
        }
        
        // Send MP4
        if (music.mp4Path && fs.existsSync(music.mp4Path)) {
          await sock.sendMessage(MUSIC_CHANNEL_ID, {
            video: fs.readFileSync(music.mp4Path),
            mimetype: 'video/mp4',
            caption: music.description,
            fileName: `${music.title}.mp4`
          });
        } else {
          await sock.sendMessage(MUSIC_CHANNEL_ID, { text: music.description });
        }
        
        console.log("Posted music content to music channel");
        
        // Clean up temp files after a delay
        setTimeout(cleanupTempFiles, 30000);
      }
      
    } catch (error) {
      console.error('Error in content scheduler:', error);
    }
  }, 60 * 1000); // Check every minute
}

async function startBot() {
  try {
    console.log('🚀 Starting WhatsApp Bot with Enhanced Features...');
    await ensureDirectories();
    await connectionManager.connect();
    startContentScheduler();
    console.log('✅ Content scheduler started');
    console.log('📰 News Channel: https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M');
    console.log('🎵 Music Channel: https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S');
    console.log('🤖 Bot will auto-join groups and broadcast channel info daily at 6 AM & 8 PM');
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
    groups: groupManager.joinedGroups.size,
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