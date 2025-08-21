FROM node:22-alpine

# Install dependencies
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++ curl wget sqlite

# Create app directory
WORKDIR /app

# Create package.json
RUN echo '{\
  "name": "abby-bot",\
  "version": "1.0.0",\
  "main": "index.js",\
  "dependencies": {\
    "@whiskeysockets/baileys": "^6.4.0",\
    "axios": "^1.6.0",\
    "moment": "^2.29.4",\
    "qrcode-terminal": "^0.12.0",\
    "sqlite3": "^5.1.6"\
  },\
  "scripts": {\
    "start": "node index.js"\
  }\
}' > package.json

# Create config.js
RUN echo '// Activation secrets' > config.js
RUN echo 'const ACTIVATION_CODES = {' >> config.js
RUN echo '  USER: "Abby0121",' >> config.js
RUN echo '  ADMIN: "Admin0121",' >> config.js
RUN echo '  GROUP: "NICCI121"' >> config.js
RUN echo '};' >> config.js
RUN echo '' >> config.js
RUN echo '// Download limits' >> config.js
RUN echo 'const DOWNLOAD_LIMITS = {' >> config.js
RUN echo '  FREE_VIDEOS: 5,' >> config.js
RUN echo '  FREE_VIDEO_SIZE_MB: 50,' >> config.js
RUN echo '  FREE_PICTURES: 10,' >> config.js
RUN echo '  FREE_PICTURE_SIZE_MB: 80,' >> config.js
RUN echo '  RESET_HOURS: 9' >> config.js
RUN echo '};' >> config.js
RUN echo '' >> config.js
RUN echo '// Pricing configuration' >> config.js
RUN echo 'const PRICING = {' >> config.js
RUN echo '  TWO_WEEKS: 75,' >> config.js
RUN echo '  ONE_MONTH: 135,' >> config.js
RUN echo '  THREE_MONTHS: 350,' >> config.js
RUN echo '  SIX_MONTHS: 600,' >> config.js
RUN echo '  ONE_YEAR: 1000' >> config.js
RUN echo '};' >> config.js
RUN echo '' >> config.js
RUN echo 'const EXCHANGE_RATES = {' >> config.js
RUN echo '  USD_TO_ZAR: 18.5,' >> config.js
RUN echo '  USD_TO_BWP: 13.2,' >> config.js
RUN echo '  USD_TO_NAD: 18.5,' >> config.js
RUN echo '  USD_TO_ZMW: 21.0' >> config.js
RUN echo '};' >> config.js
RUN echo '' >> config.js
RUN echo 'const responses = {' >> config.js
RUN echo '  welcome: "🔒 *Welcome to Abby'\''s Secure Bot* 🔒\\n\\n📋 *Terms & Conditions:*\\n• Your data is encrypted and secure\\n• We never share your personal information\\n• Downloads are for personal use only\\n• Illegal content is strictly prohibited\\n\\n🚀 *Free Tier Limits:*\\n• 5 videos (50MB max each)\\n• 10 pictures (80MB max each)\\n• Resets every 9 hours\\n\\n💎 *Subscribe for unlimited access!*",' >> config.js
RUN echo '  activation: "✅ *Activation Successful!*\\n\\nYour account is now secure and active.\\n🔒 Data encryption enabled\\n📊 Privacy protection active\\n\\nSend any filename to start downloading!",' >> config.js
RUN echo '  notActivated: "🔒 *Account Not Activated*\\n\\nPlease activate first by sending:\\nAbby0121\\n\\nYour privacy and security are our priority!",' >> config.js
RUN echo '  downloadLimit: "⛔ *Download Limit Reached*\\n\\nYou'\''ve used all your free downloads.\\n\\n📊 *Usage:*\\n• Videos: {videosUsed}/5\\n• Pictures: {picturesUsed}/10\\n\\n💎 *Subscribe for unlimited access!*",' >> config.js
RUN echo '  terms: "📋 *Terms & Conditions*\\n\\n1. Your data is encrypted and secure\\n2. We never share personal information\\n3. Downloads for personal use only\\n4. Illegal content is prohibited\\n5. Respect copyright laws\\n6. Service may be terminated for violations\\n\\n✅ By using this service, you agree to these terms."' >> config.js
RUN echo '};' >> config.js
RUN echo '' >> config.js
RUN echo 'module.exports = { ACTIVATION_CODES, DOWNLOAD_LIMITS, PRICING, EXCHANGE_RATES, responses };' >> config.js

# Create database.js
RUN echo 'const sqlite3 = require("sqlite3").verbose();' > database.js
RUN echo 'const fs = require("fs");' >> database.js
RUN echo '' >> database.js
RUN echo 'class Database {' >> database.js
RUN echo '  constructor() {' >> database.js
RUN echo '    this.init();' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  init() {' >> database.js
RUN echo '    if (!fs.existsSync("data")) fs.mkdirSync("data");' >> database.js
RUN echo '    ' >> database.js
RUN echo '    this.db = new sqlite3.Database("data/bot.db");' >> database.js
RUN echo '' >> database.js
RUN echo '    this.db.serialize(() => {' >> database.js
RUN echo '      // Users table' >> database.js
RUN echo '      this.db.run(`CREATE TABLE IF NOT EXISTS users (' >> database.js
RUN echo '        id INTEGER PRIMARY KEY AUTOINCREMENT,' >> database.js
RUN echo '        phone_number TEXT UNIQUE,' >> database.js
RUN echo '        is_activated INTEGER DEFAULT 0,' >> database.js
RUN echo '        is_admin INTEGER DEFAULT 0,' >> database.js
RUN echo '        is_group_manager INTEGER DEFAULT 0,' >> database.js
RUN echo '        video_downloads INTEGER DEFAULT 0,' >> database.js
RUN echo '        picture_downloads INTEGER DEFAULT 0,' >> database.js
RUN echo '        total_download_size INTEGER DEFAULT 0,' >> database.js
RUN echo '        last_download_time INTEGER,' >> database.js
RUN echo '        subscription_expiry INTEGER,' >> database.js
RUN echo '        created_at INTEGER DEFAULT (strftime('\''%s'\'', '\''now'\''))' >> database.js
RUN echo '      )`);' >> database.js
RUN echo '' >> database.js
RUN echo '      // Admin files table' >> database.js
RUN echo '      this.db.run(`CREATE TABLE IF NOT EXISTS admin_files (' >> database.js
RUN echo '        id INTEGER PRIMARY KEY AUTOINCREMENT,' >> database.js
RUN echo '        filename TEXT,' >> database.js
RUN echo '        file_url TEXT,' >> database.js
UN echo '        file_size INTEGER,' >> database.js
RUN echo '        category TEXT,' >> database.js
RUN echo '        added_by TEXT,' >> database.js
RUN echo '        added_at INTEGER' >> database.js
RUN echo '      )`);' >> database.js
RUN echo '' >> database.js
RUN echo '      // Group links table' >> database.js
RUN echo '      this.db.run(`CREATE TABLE IF NOT EXISTS group_links (' >> database.js
RUN echo '        id INTEGER PRIMARY KEY AUTOINCREMENT,' >> database.js
RUN echo '        group_url TEXT,' >> database.js
RUN echo '        group_name TEXT,' >> database.js
RUN echo '        submitted_by TEXT,' >> database.js
RUN echo '        submitted_at INTEGER,' >> database.js
RUN echo '        is_approved INTEGER DEFAULT 0' >> database.js
RUN echo '      )`);' >> database.js
RUN echo '' >> database.js
RUN echo '      // Dating availability table' >> database.js
RUN echo '      this.db.run(`CREATE TABLE IF NOT EXISTS dating_availability (' >> database.js
RUN echo '        id INTEGER PRIMARY KEY AUTOINCREMENT,' >> database.js
RUN echo '        phone_number TEXT,' >> database.js
RUN echo '        is_available INTEGER DEFAULT 0,' >> database.js
RUN echo '        available_until INTEGER,' >> database.js
RUN echo '        interests TEXT,' >> database.js
RUN echo '        location TEXT,' >> database.js
RUN echo '        created_at INTEGER' >> database.js
RUN echo '      )`);' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  // User management' >> database.js
RUN echo '  async getUser(phoneNumber) {' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.get("SELECT * FROM users WHERE phone_number = ?", [phoneNumber], (err, row) => {' >> database.js
RUN echo '        if (err) reject(err);' >> database.js
RUN echo '        else resolve(row);' >> database.js
RUN echo '      });' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  async createUser(phoneNumber, userType = "user") {' >> database.js
RUN echo '    const isAdmin = userType === "admin";' >> database.js
RUN echo '    const isGroupManager = userType === "group";' >> database.js
RUN echo '    ' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.run(' >> database.js
RUN echo '        "INSERT OR REPLACE INTO users (phone_number, is_activated, is_admin, is_group_manager) VALUES (?, 1, ?, ?)",' >> database.js
RUN echo '        [phoneNumber, isAdmin ? 1 : 0, isGroupManager ? 1 : 0],' >> database.js
RUN echo '        function(err) {' >> database.js
RUN echo '          if (err) reject(err);' >> database.js
RUN echo '          else resolve(this.lastID);' >> database.js
RUN echo '        }' >> database.js
RUN echo '      );' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  async updateDownloadStats(phoneNumber, isVideo, sizeMB) {' >> database.js
RUN echo '    const sizeBytes = sizeMB * 1024 * 1024;' >> database.js
RUN echo '    const updateField = isVideo ? "video_downloads = video_downloads + 1" : "picture_downloads = picture_downloads + 1";' >> database.js
RUN echo '    ' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.run(' >> database.js
RUN echo '        `UPDATE users SET ${updateField}, total_download_size = total_download_size + ?, last_download_time = ? WHERE phone_number = ?`,' >> database.js
RUN echo '        [sizeBytes, Date.now(), phoneNumber],' >> database.js
RUN echo '        function(err) {' >> database.js
RUN echo '          if (err) reject(err);' >> database.js
RUN echo '          else resolve(this.changes);' >> database.js
RUN echo '        }' >> database.js
RUN echo '      );' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  async resetDownloadCounts(phoneNumber) {' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.run(' >> database.js
RUN echo '        "UPDATE users SET video_downloads = 0, picture_downloads = 0, total_download_size = 0 WHERE phone_number = ?",' >> database.js
RUN echo '        [phoneNumber],' >> database.js
RUN echo '        function(err) {' >> database.js
RUN echo '          if (err) reject(err);' >> database.js
RUN echo '          else resolve(this.changes);' >> database.js
RUN echo '        }' >> database.js
RUN echo '      );' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  // Admin files management' >> database.js
RUN echo '  async addAdminFile(filename, fileUrl, fileSize, category, addedBy) {' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.run(' >> database.js
RUN echo '        "INSERT INTO admin_files (filename, file_url, file_size, category, added_by, added_at) VALUES (?, ?, ?, ?, ?, ?)",' >> database.js
RUN echo '        [filename, fileUrl, fileSize, category, addedBy, Date.now()],' >> database.js
RUN echo '        function(err) {' >> database.js
RUN echo '          if (err) reject(err);' >> database.js
RUN echo '          else resolve(this.lastID);' >> database.js
RUN echo '        }' >> database.js
RUN echo '      );' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  async searchAdminFiles(query) {' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.all(' >> database.js
RUN echo '        "SELECT * FROM admin_files WHERE filename LIKE ? OR category LIKE ? ORDER BY added_at DESC",' >> database.js
RUN echo '        [`%${query}%`, `%${query}%`],' >> database.js
RUN echo '        (err, rows) => {' >> database.js
RUN echo '          if (err) reject(err);' >> database.js
RUN echo '          else resolve(rows);' >> database.js
RUN echo '        }' >> database.js
RUN echo '      );' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  // Group links management' >> database.js
RUN echo '  async addGroupLink(groupUrl, groupName, submittedBy) {' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.run(' >> database.js
RUN echo '        "INSERT INTO group_links (group_url, group_name, submitted_by, submitted_at) VALUES (?, ?, ?, ?)",' >> database.js
RUN echo '        [groupUrl, groupName, submittedBy, Date.now()],' >> database.js
RUN echo '        function(err) {' >> database.js
RUN echo '          if (err) reject(err);' >> database.js
RUN echo '          else resolve(this.lastID);' >> database.js
RUN echo '        }' >> database.js
RUN echo '      );' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  async getGroupLinks() {' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.all("SELECT * FROM group_links ORDER BY submitted_at DESC", (err, rows) => {' >> database.js
RUN echo '        if (err) reject(err);' >> database.js
RUN echo '        else resolve(rows);' >> database.js
RUN echo '      });' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  // Dating availability' >> database.js
RUN echo '  async setDatingAvailability(phoneNumber, isAvailable, durationHours = 2, interests = "", location = "") {' >> database.js
RUN echo '    const availableUntil = Date.now() + (durationHours * 60 * 60 * 1000);' >> database.js
RUN echo '    ' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.run(' >> database.js
RUN echo '        "INSERT OR REPLACE INTO dating_availability (phone_number, is_available, available_until, interests, location, created_at) VALUES (?, ?, ?, ?, ?, ?)",' >> database.js
RUN echo '        [phoneNumber, isAvailable ? 1 : 0, availableUntil, interests, location, Date.now()],' >> database.js
RUN echo '        function(err) {' >> database.js
RUN echo '          if (err) reject(err);' >> database.js
RUN echo '          else resolve(this.changes);' >> database.js
RUN echo '        }' >> database.js
RUN echo '      );' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  async findAvailableMatches(phoneNumber, interests = "", location = "") {' >> database.js
RUN echo '    return new Promise((resolve, reject) => {' >> database.js
RUN echo '      this.db.all(' >> database.js
RUN echo '        `SELECT * FROM dating_availability WHERE phone_number != ? AND is_available = 1 AND available_until > ? AND (interests LIKE ? OR location LIKE ?) ORDER BY created_at DESC`,' >> database.js
RUN echo '        [phoneNumber, Date.now(), `%${interests}%`, `%${location}%`],' >> database.js
RUN echo '        (err, rows) => {' >> database.js
RUN echo '          if (err) reject(err);' >> database.js
RUN echo '          else resolve(rows);' >> database.js
RUN echo '        }' >> database.js
RUN echo '      );' >> database.js
RUN echo '    });' >> database.js
RUN echo '  }' >> database.js
RUN echo '' >> database.js
RUN echo '  close() {' >> database.js
RUN echo '    this.db.close();' >> database.js
RUN echo '  }' >> database.js
RUN echo '}' >> database.js
RUN echo '' >> database.js
RUN echo 'module.exports = new Database();' >> database.js

# Create utils.js
RUN echo 'const fs = require("fs");' > utils.js
RUN echo 'const { DOWNLOAD_LIMITS } = require("./config");' >> utils.js
RUN echo '' >> utils.js
RUN echo 'function canDownloadMore(user, isVideo, fileSizeMB = 0) {' >> utils.js
RUN echo '  if (!user) return false;' >> utils.js
RUN echo '  ' >> utils.js
RUN echo '  const now = Date.now();' >> utils.js
RUN echo '  const resetTime = DOWNLOAD_LIMITS.RESET_HOURS * 60 * 60 * 1000;' >> utils.js
RUN echo '  ' >> utils.js
RUN echo '  // Reset counts if enough time has passed' >> utils.js
RUN echo '  if (user.last_download_time && (now - user.last_download_time) > resetTime) {' >> utils.js
RUN echo '    return true; // Counts will be reset before download' >> utils.js
RUN echo '  }' >> utils.js
RUN echo '  ' >> utils.js
RUN echo '  if (isVideo) {' >> utils.js
RUN echo '    const wouldExceedSize = user.total_download_size + (fileSizeMB * 1024 * 1024) > (DOWNLOAD_LIMITS.FREE_VIDEO_SIZE_MB * DOWNLOAD_LIMITS.FREE_VIDEOS * 1024 * 1024);' >> utils.js
RUN echo '    return user.video_downloads < DOWNLOAD_LIMITS.FREE_VIDEOS && !wouldExceedSize;' >> utils.js
RUN echo '  } else {' >> utils.js
RUN echo '    const wouldExceedSize = user.total_download_size + (fileSizeMB * 1024 * 1024) > (DOWNLOAD_LIMITS.FREE_PICTURE_SIZE_MB * DOWNLOAD_LIMITS.FREE_PICTURES * 1024 * 1024);' >> utils.js
RUN echo '    return user.picture_downloads < DOWNLOAD_LIMITS.FREE_PICTURES && !wouldExceedSize;' >> utils.js
RUN echo '  }' >> utils.js
RUN echo '}' >> utils.js
RUN echo '' >> utils.js
RUN echo 'function getFileType(filename) {' >> utils.js
RUN echo '  const ext = filename.toLowerCase().split(".").pop();' >> utils.js
RUN echo '  const videoExts = ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"];' >> utils.js
RUN echo '  const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];' >> utils.js
RUN echo '  ' >> utils.js
RUN echo '  if (videoExts.includes(ext)) return "video";' >> utils.js
RUN echo '  if (imageExts.includes(ext)) return "image";' >> utils.js
RUN echo '  return "other";' >> utils.js
RUN echo '}' >> utils.js
RUN echo '' >> utils.js
RUN echo 'function estimateFileSize(filename) {' >> utils.js
RUN echo '  const type = getFileType(filename);' >> utils.js
RUN echo '  if (type === "video") return 45; // Average 45MB for videos' >> utils.js
RUN echo '  if (type === "image") return 5;  // Average 5MB for images' >> utils.js
RUN echo '  return 10; // Average 10MB for other files' >> utils.js
RUN echo '}' >> utils.js
RUN echo '' >> utils.js
RUN echo 'module.exports = { canDownloadMore, getFileType, estimateFileSize };' >> utils.js

# Create commands/activation.js
RUN mkdir -p commands
RUN echo 'const { responses, ACTIVATION_CODES } = require("../config");' > commands/activation.js
RUN echo 'const db = require("../database");' >> commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo 'async function handleActivation(sock, text, sender, senderNumber) {' >> commands/activation.js
RUN echo '  if (text === ACTIVATION_CODES.USER) {' >> commands/activation.js
RUN echo '    await db.createUser(senderNumber, "user");' >> commands/activation.js
RUN echo '    await sock.sendMessage(sender, { text: responses.activation });' >> commands/activation.js
RUN echo '    await sock.sendMessage(sender, { text: responses.welcome });' >> commands/activation.js
RUN echo '    return true;' >> commands/activation.js
RUN echo '  }' >> commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo '  if (text === ACTIVATION_CODES.ADMIN) {' >> commands/activation.js
RUN echo '    await db.createUser(senderNumber, "admin");' >> commands/activation.js
RUN echo '    await sock.sendMessage(sender, { text: "✅ *Admin Mode Activated!*\\n\\nYou now have access to admin commands and file management." });' >> commands/activation.js
RUN echo '    return true;' >> commands/activation.js
RUN echo '  }' >> commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo '  if (text === ACTIVATION_CODES.GROUP) {' >> commands/activation.js
RUN echo '    await db.createUser(senderNumber, "group");' >> commands/activation.js
RUN echo '    await sock.sendMessage(sender, { text: "✅ *Group Manager Mode Activated!*\\n\\nYou can now manage groups and access group links." });' >> commands/activation.js
RUN echo '    return true;' >> commands/activation.js
RUN echo '  }' >> commands/activation.js
RUN echo '  return false;' >> commands/activation.js
RUN echo '}' >> commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo 'async function isUserActivated(phoneNumber) {' >> commands/activation.js
RUN echo '  const user = await db.getUser(phoneNumber);' >> commands/activation.js
RUN echo '  return user && user.is_activated === 1;' >> commands/activation.js
RUN echo '}' >> commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo 'async function isUserAdmin(phoneNumber) {' >> commands/activation.js
RUN echo '  const user = await db.getUser(phoneNumber);' >> commands/activation.js
RUN echo '  return user && user.is_admin === 1;' >> commands/activation.js
RUN echo '}' >> commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo 'async function isGroupManager(phoneNumber) {' >> commands/activation.js
RUN echo '  const user = await db.getUser(phoneNumber);' >> commands/activation.js
RUN echo '  return user && user.is_group_manager === 1;' >> commands/activation.js
RUN echo '}' >> commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo 'module.exports = { handleActivation, isUserActivated, isUserAdmin, isGroupManager };' >> commands/activation.js

# Create commands/download.js
RUN echo 'const { searchAndDownloadFile } = require("../utils");' > commands/download.js
RUN echo 'const { responses } = require("../config");' >> commands/download.js
RUN echo 'const db = require("../database");' >> commands/download.js
RUN echo 'const { canDownloadMore, estimateFileSize, getFileType } = require("../utils");' >> commands/download.js
RUN echo '' >> commands/download.js
RUN echo 'async function handleFileDownload(sock, text, sender, senderNumber) {' >> commands/download.js
RUN echo '  if (!text.startsWith("!") && text.length > 2) {' >> commands/download.js
RUN echo '    const user = await db.getUser(senderNumber);' >> commands/download.js
RUN echo '    if (!user) {' >> commands/activation.js
RUN echo '      await sock.sendMessage(sender, { text: responses.notActivated });' >> commands/download.js
RUN echo '      return true;' >> commands/download.js
RUN echo '    }' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    const fileType = getFileType(text);' >> commands/download.js
RUN echo '    const isVideo = fileType === "video";' >> commands/download.js
RUN echo '    const isImage = fileType === "image";' >> commands/download.js
RUN echo '    const estimatedSize = estimateFileSize(text);' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    // Check download limits (admins have no limits)' >> commands/download.js
RUN echo '    if (!user.is_admin && !canDownloadMore(user, isVideo, estimatedSize)) {' >> commands/download.js
RUN echo '      const limitMessage = responses.downloadLimit' >> commands/download.js
RUN echo '        .replace("{videosUsed}", user.video_downloads)' >> commands/download.js
RUN echo '        .replace("{picturesUsed}", user.picture_downloads);' >> commands/download.js
RUN echo '      ' >> commands/download.js
RUN echo '      await sock.sendMessage(sender, { text: limitMessage });' >> commands/download.js
RUN echo '      return true;' >> commands/download.js
RUN echo '    }' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    await sock.sendMessage(sender, { text: responses.searchStarted });' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    // Reset counts if needed' >> commands/download.js
RUN echo '    const now = Date.now();' >> commands/download.js
RUN echo '    const resetTime = 9 * 60 * 60 * 1000;' >> commands/download.js
RUN echo '    if (user.last_download_time && (now - user.last_download_time) > resetTime) {' >> commands/download.js
RUN echo '      await db.resetDownloadCounts(senderNumber);' >> commands/download.js
RUN echo '    }' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    // Update download stats' >> commands/download.js
RUN echo '    await db.updateDownloadStats(senderNumber, isVideo, estimatedSize);' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    try {' >> commands/download.js
RUN echo '      const result = await searchAndDownloadFile(text, senderNumber);' >> commands/download.js
RUN echo '      if (result.success) {' >> commands/download.js
RUN echo '        await sock.sendMessage(sender, { text: responses.downloadSuccess });' >> commands/download.js
RUN echo '      } else {' >> commands/download.js
RUN echo '        await sock.sendMessage(sender, { text: responses.fileNotFound });' >> commands/download.js
RUN echo '      }' >> commands/download.js
RUN echo '    } catch (error) {' >> commands/download.js
RUN echo '      await sock.sendMessage(sender, { text: responses.downloadFailed });' >> commands/download.js
RUN echo '    }' >> commands/download.js
RUN echo '    return true;' >> commands/download.js
RUN echo '  }' >> commands/download.js
RUN echo '  return false;' >> commands/download.js
RUN echo '}' >> commands/download.js
RUN echo '' >> commands/download.js
RUN echo 'module.exports = { handleFileDownload };' >> commands/download.js

# Create commands/admin.js
RUN echo 'const db = require("../database");' > commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo 'async function handleAdminCommands(sock, text, sender, senderNumber) {' >> commands/admin.js
RUN echo '  if (!await isUserAdmin(senderNumber)) return false;' >> commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo '  if (text.startsWith("!addfile ")) {' >> commands/admin.js
RUN echo '    const parts = text.replace("!addfile ", "").split("|");' >> commands/admin.js
RUN echo '    if (parts.length >= 3) {' >> commands/admin.js
RUN echo '      const [filename, fileUrl, category] = parts;' >> commands/admin.js
RUN echo '      const fileSize = parts[3] || 0;' >> commands/admin.js
RUN echo '      ' >> commands/admin.js
RUN echo '      await db.addAdminFile(filename.trim(), fileUrl.trim(), parseInt(fileSize), category.trim(), senderNumber);' >> commands/admin.js
RUN echo '      await sock.sendMessage(sender, { text: `✅ File "${filename}" added to admin database!` });' >> commands/admin.js
RUN echo '      return true;' >> commands/admin.js
RUN echo '    }' >> commands/admin.js
RUN echo '  }' >> commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo '  if (text.startsWith("!searchfiles ")) {' >> commands/admin.js
RUN echo '    const query = text.replace("!searchfiles ", "");' >> commands/admin.js
RUN echo '    const files = await db.searchAdminFiles(query);' >> commands/admin.js
RUN echo '    ' >> commands/admin.js
RUN echo '    if (files.length === 0) {' >> commands/admin.js
RUN echo '      await sock.sendMessage(sender, { text: "No files found matching your search." });' >> commands/admin.js
RUN echo '    } else {' >> commands/admin.js
RUN echo '      let fileList = "📁 *Admin Files Found:*\\n\\n";' >> commands/admin.js
RUN echo '      files.slice(0, 10).forEach((file, index) => {' >> commands/admin.js
RUN echo '        fileList += `${index + 1}. ${file.filename}\\n   📂 ${file.category}\\n   📊 ${Math.round(file.file_size / 1024 / 1024)}MB\\n   🔗 ${file.file_url}\\n\\n`;' >> commands/admin.js
RUN echo '      });' >> commands/admin.js
RUN echo '      await sock.sendMessage(sender, { text: fileList });' >> commands/admin.js
RUN echo '    }' >> commands/admin.js
RUN echo '    return true;' >> commands/admin.js
RUN echo '  }' >> commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo '  return false;' >> commands/admin.js
RUN echo '}' >> commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo 'module.exports = { handleAdminCommands };' >> commands/admin.js

# Create commands/group.js
RUN echo 'const db = require("../database");' > commands/group.js
RUN echo '' >> commands/group.js
RUN echo 'async function handleGroupCommands(sock, text, sender, senderNumber) {' >> commands/group.js
RUN echo '  if (!await isGroupManager(senderNumber)) return false;' >> commands/group.js
RUN echo '' >> commands/group.js
RUN echo '  if (text === "!grouplinks") {' >> commands/group.js
RUN echo '    const links = await db.getGroupLinks();' >> commands/group.js
RUN echo '    ' >> commands/group.js
RUN echo '    if (links.length === 0) {' >> commands/group.js
RUN echo '      await sock.sendMessage(sender, { text: "No group links submitted yet." });' >> commands/group.js
RUN echo '    } else {' >> commands/group.js
RUN echo '      let linkList = "📋 *Group Links Submitted:*\\n\\n";' >> commands/group.js
RUN echo '      links.forEach((link, index) => {' >> commands/group.js
RUN echo '        linkList += `${index + 1}. ${link.group_name || "Unnamed"}\\n   🔗 ${link.group_url}\\n   👤 By: ${link.submitted_by}\\n   ⏰ ${new Date(link.submitted_at).toLocaleDateString()}\\n\\n`;' >> commands/group.js
RUN echo '      });' >> commands/group.js
RUN echo '      await sock.sendMessage(sender, { text: linkList });' >> commands/group.js
RUN echo '    }' >> commands/group.js
RUN echo '    return true;' >> commands/group.js
RUN echo '  }' >> commands/group.js
RUN echo '' >> commands/group.js
RUN echo '  return false;' >> commands/group.js
RUN echo '}' >> commands/group.js
RUN echo '' >> commands/group.js
RUN echo 'module.exports = { handleGroupCommands };' >> commands/group.js

# Create commands/dating.js
RUN echo 'const db = require("../database");' > commands/dating.js
RUN echo '' >> commands/dating.js
RUN echo 'async function handleDatingCommands(sock, text, sender, senderNumber) {' >> commands/dating.js
RUN echo '  if (text === "!iamfree") {' >> commands/dating.js
RUN echo '    await db.setDatingAvailability(senderNumber, true, 2, "", "");' >> commands/dating.js
RUN echo '    await sock.sendMessage(sender, { text: "✅ You'\''re now marked as available for dating!\\n\\nWe'\''ll look for someone compatible and connect you within 2 hours." });' >> commands/dating.js
RUN echo '    ' >> commands/dating.js
RUN echo '    // Try to find a match immediately' >> commands/dating.js
RUN echo '    const matches = await db.findAvailableMatches(senderNumber);' >> commands/dating.js
RUN echo '    if (matches.length > 0) {' >> commands/dating.js
RUN echo '      const match = matches[0];' >> commands/dating.js
RUN echo '      await sock.sendMessage(sender, { text: `🎉 Match found! Connecting you with someone available now...` });' >> commands/dating.js
RUN echo '      // Here you would actually connect the users by exchanging contact info' >> commands/dating.js
RUN echo '    }' >> commands/dating.js
RUN echo '    return true;' >> commands/dating.js
RUN echo '  }' >> commands/dating.js
RUN echo '' >> commands/dating.js
RUN echo '  if (text === "!notfree") {' >> commands/dating.js
RUN echo '    await db.setDatingAvailability(senderNumber, false);' >> commands/dating.js
RUN echo '    await sock.sendMessage(sender, { text: "✅ You'\''re no longer marked as available for dating." });' >> commands/dating.js
RUN echo '    return true;' >> commands/dating.js
RUN echo '  }' >> commands/dating.js
RUN echo '' >> commands/dating.js
RUN echo '  return false;' >> commands/dating.js
RUN echo '}' >> commands/dating.js
RUN echo '' >> commands/dating.js
RUN echo 'module.exports = { handleDatingCommands };' >> commands/dating.js

# Create handlers.js
RUN echo 'const { ' > handlers.js
RUN echo '  handleActivation,' >> handlers.js
RUN echo '  isUserActivated,' >> handlers.js
RUN echo '  isUserAdmin,' >> handlers.js
RUN echo '  isGroupManager' >> handlers.js
RUN echo '} = require("./commands/activation");' >> handlers.js
RUN echo 'const { handleFileDownload } = require("./commands/download");' >> handlers.js
RUN echo 'const { handleAdminCommands } = require("./commands/admin");' >> handlers.js
RUN echo 'const { handleGroupCommands } = require("./commands/group");' >> handlers.js
RUN echo 'const { handleDatingCommands } = require("./commands/dating");' >> handlers.js
RUN echo 'const { responses } = require("./config");' >> handlers.js
RUN echo '' >> handlers.js
RUN echo 'async function handleMessage(sock, text, sender, senderNumber) {' >> handlers.js
RUN echo '  // Check activation first' >> handlers.js
RUN echo '  const isActivated = await handleActivation(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (isActivated) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Only respond to activated users' >> handlers.js
RUN echo '  if (!await isUserActivated(senderNumber)) {' >> handlers.js
RUN echo '    // Only respond to activation attempts, ignore other messages' >> handlers.js
RUN echo '    return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle terms command' >> handlers.js
RUN echo '  if (text === "!terms") {' >> handlers.js
RUN echo '    await sock.sendMessage(sender, { text: responses.terms });' >> handlers.js
RUN echo '    return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle admin commands' >> handlers.js
RUN echo '  if (await isUserAdmin(senderNumber)) {' >> handlers.js
RUN echo '    const adminHandled = await handleAdminCommands(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '    if (adminHandled) return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle group commands' >> handlers.js
RUN echo '  if (await isGroupManager(senderNumber)) {' >> handlers.js
RUN echo '    const groupHandled = await handleGroupCommands(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '    if (groupHandled) return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle dating commands' >> handlers.js
RUN echo '  const datingHandled = await handleDatingCommands(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (datingHandled) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle file downloads' >> handlers.js
RUN echo '  const downloadHandled = await handleFileDownload(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (downloadHandled) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Auto-reply for other messages' >> handlers.js
RUN echo '  if (text.length > 1) {' >> handlers.js
RUN echo '    const replies = [' >> handlers.js
RUN echo '      "I'\''m here to help you find files!",' >> handlers.js
RUN echo '      "You can send me any filename to search.",' >> handlers.js
RUN echo '      "Need help finding something?"' >> handlers.js
RUN echo '    ];' >> handlers.js
RUN echo '    ' >> handlers.js
RUN echo '    const randomReply = replies[Math.floor(Math.random() * replies.length)];' >> handlers.js
RUN echo '    await sock.sendMessage(sender, { text: randomReply });' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '}' >> handlers.js
RUN echo '' >> handlers.js
RUN echo 'module.exports = { handleMessage };' >> handlers.js

# Create index.js
RUN echo 'const makeWASocket = require("@whiskeysockets/baileys").default;' > index.js
RUN echo 'const { useMultiFileAuthState } = require("@whiskeysockets/baileys");' >> index.js
RUN echo 'const qrcode = require("qrcode-terminal");' >> index.js
RUN echo 'const { handleMessage } = require("./handlers");' >> index.js
RUN echo '' >> index.js
RUN echo 'let sock = null;' >> index.js
RUN echo 'let isConnected = false;' >> index.js
RUN echo '' >> index.js
RUN echo 'async function startBot() {' >> index.js
RUN echo '  try {' >> index.js
RUN echo '    const { state, saveCreds } = await useMultiFileAuthState("auth_info");' >> index.js
RUN echo '    sock = makeWASocket({ ' >> index.js
RUN echo '      auth: state,' >> index.js
RUN echo '      printQRInTerminal: true,' >> index.js
RUN echo '      browser: ["Ubuntu", "Chrome", "20.0.04"]' >> index.js
RUN echo '    });' >> index.js
RUN echo '' >> index.js
RUN echo '    sock.ev.on("connection.update", (update) => {' >> index.js
RUN echo '      const { connection, lastDisconnect, qr } = update;' >> index.js
RUN echo '      if (qr) {' >> index.js
RUN echo '        console.log("Scan the QR code below to connect to WhatsApp:");' >> index.js
RUN echo '        qrcode.generate(qr, { small: true });' >> index.js
RUN echo '        isConnected = false;' >> index.js
RUN echo '      }' >> index.js
RUN echo '      if (connection === "close") {' >> index.js
RUN echo '        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;' >> index.js
RUN echo '        console.log("Connection closed, reconnecting...", shouldReconnect);' >> index.js
RUN echo '        isConnected = false;' >> index.js
RUN echo '        if (shouldReconnect) {' >> index.js
RUN echo '          setTimeout(startBot, 3000);' >> index.js
RUN echo '        }' >> index.js
RUN echo '      } else if (connection === "open") {' >> index.js
RUN echo '        console.log("Bot connected successfully to WhatsApp");' >> index.js
RUN echo '        isConnected = true;' >> index.js
RUN echo '      }' >> index.js
RUN echo '    });' >> index.js
RUN echo '' >> index.js
RUN echo '    sock.ev.on("creds.update", saveCreds);' >> index.js
RUN echo '' >> index.js
RUN echo '    sock.ev.on("messages.upsert", async (m) => {' >> index.js
RUN echo '      if (!isConnected) return;' >> index.js
RUN echo '      const message = m.messages[0];' >> index.js
RUN echo '      if (!message.message) return;' >> index.js
RUN echo '      const text = message.message.conversation || message.message.extendedTextMessage?.text || "";' >> index.js
RUN echo '      const sender = message.key.remoteJid;' >> index.js
RUN echo '      const senderNumber = sender.split("@")[0];' >> index.js
RUN echo '' >> index.js
RUN echo '      await handleMessage(sock, text, sender, senderNumber);' >> index.js
RUN echo '    });' >> index.js
RUN echo '  } catch (error) {' >> index.js
RUN echo '    console.error("Error starting bot:", error);' >> index.js
RUN echo '    setTimeout(startBot, 5000);' >> index.js
RUN echo '  }' >> database.js
RUN echo '}' >> index.js
RUN echo '' >> index.js
RUN echo '// Keep the bot always alive' >> index.js
RUN echo 'process.on("uncaughtException", (error) => {' >> index.js
RUN echo '  console.error("Uncaught Exception:", error);' >> index.js
RUN echo '  setTimeout(startBot, 5000);' >> index.js
RUN echo '});' >> index.js
RUN echo '' >> index.js
RUN echo 'process.on("unhandledRejection", (reason, promise) => {' >> index.js
RUN echo '  console.error("Unhandled Rejection at:", promise, "reason:", reason);' >> index.js
RUN echo '  setTimeout(startBot, 5000);' >> index.js
RUN echo '});' >> index.js
RUN echo '' >> index.js
RUN echo 'console.log("Starting Abby Bot...");' >> index.js
RUN echo 'console.log("If this is your first time running, scan the QR code to connect to WhatsApp");' >> index.js
RUN echo 'startBot().catch(console.error);' >> index.js

# Create downloads directory with proper permissions
RUN mkdir -p downloads && chmod 755 downloads
RUN mkdir -p data && chmod 755 data

# Install dependencies
RUN npm install

# Start the bot
CMD ["node", "index.js"]
