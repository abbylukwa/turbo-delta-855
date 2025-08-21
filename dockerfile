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
# Add after the existing config.js content
RUN echo '// Subscription configuration' >> config.js
RUN echo 'const SUBSCRIPTION_CONFIG = {' >> config.js
RUN echo '  PLANS: {' >> config.js
RUN echo '    "2weeks": { duration: 14, price: 0.75 },' >> config.js
RUN echo '    "1month": { duration: 30, price: 1.35 },' >> config.js
RUN echo '    "3months": { duration: 90, price: 3.50 },' >> config.js
RUN echo '    "6months": { duration: 180, price: 6.00 },' >> config.js
RUN echo '    "1year": { duration: 365, price: 10.00 }' >> config.js
RUN echo '  },' >> config.js
RUN echo '  PAYMENT_NUMBERS: {' >> config.js
RUN echo '    ZIMBABWE: "+263776272102",' >> config.js
RUN echo '    SOUTH_AFRICA: "+27614159817"' >> config.js
RUN echo '  },' >> config.js
RUN echo '  CURRENCY_RATES: {' >> config.js
RUN echo '    USD_TO_ZAR: 18.5,' >> config.js
RUN echo '    USD_TO_BWP: 13.2,' >> config.js
RUN echo '    USD_TO_NAD: 18.5,' >> config.js
RUN echo '    USD_TO_ZMW: 21.0' >> config.js
RUN echo '  }' >> config.js
RUN echo '};' >> config.js
RUN echo '' >> config.js
# Add subscription responses
RUN echo '  subscriptionOptions: "💎 *Subscription Plans Available:*\\\\n\\\\n" +' >> config.js
RUN echo '  "• 2 Weeks: R13.88 / \\\\$0.75\\\\n" +' >> config.js
RUN echo '  "• 1 Month: R24.98 / \\\\$1.35\\\\n" +' >> config.js
RUN echo '  "• 3 Months: R64.75 / \\\\$3.50\\\\n" +' >> config.js
RUN echo '  "• 6 Months: R111.00 / \\\\$6.00\\\\n" +' >> config.js
RUN echo '  "• 1 Year: R185.00 / \\\\$10.00\\\\n\\\\n" +' >> config.js
RUN echo '  "📱 *Payment Numbers:*\\\\n" +' >> config.js
RUN echo '  "• Zimbabwe: +263776272102\\\\n" +' >> config.js
RUN echo '  "• South Africa: +27614159817\\\\n\\\\n" +' >> config.js
RUN echo '  "💳 *To subscribe, send:*\\\\n!subscribe [plan]\\\\n\\\\n" +' >> config.js
RUN echo '  "Example: !subscribe 2weeks",' >> config.js
RUN echo '' >> config.js
RUN echo '  paymentInstructions: "✅ *Subscription Confirmed: {plan}*\\\\n\\\\n" +' >> config.js
RUN echo '  "💰 *Amount to Pay:* {amount}\\\\n\\\\n" +' >> config.js
RUN echo '  "📱 *Send Payment to:*\\\\n" +' >> config.js
RUN echo '  "• Zimbabwe: +263776272102\\\\n" +' >> config.js
RUN echo '  "• South Africa: +27614159817\\\\n\\\\n" +' >> config.js
RUN echo '  "📋 *Payment Instructions:*\\\\n" +' >> config.js
RUN echo '  "1. Send exact amount to either number\\\\n" +' >> config.js
RUN echo '  "2. Include your number as reference\\\\n" +' >> config.js
RUN echo '  "3. Reply with: !paid [amount] [reference]\\\\n\\\\n" +' >> config.js
RUN echo '  "Example: !paid R13.88 0771234567",' >> config.js
RUN echo '' >> config.js
RUN echo '  paymentReceived: "✅ *Payment Received!*\\\\n\\\\n" +' >> config.js
RUN echo '  "We'\''ve received your payment of {amount}.\\\\n" +' >> config.js
RUN echo '  "Your subscription will be activated shortly after verification.",' >> config.js
RUN echo '' >> config.js
RUN echo '  subscriptionActive: "🎉 *Subscription Activated!*\\\\n\\\\n" +' >> config.js
RUN echo '  "Your {plan} subscription is now active!\\\\n" +' >> config.js
RUN echo '  "✅ Unlimited downloads enabled\\\\n" +' >> config.js
RUN echo '  "⏰ Expires: {expiryDate}\\\\n\\\\n" +' >> config.js
RUN echo '  "Enjoy your premium access!",' >> config.js
RUN echo '' >> config.js
RUN echo '  adminSubStats: "📊 *Subscription Statistics:*\\\\n\\\\n" +' >> config.js
RUN echo '  "• Total Subscribers: {total}\\\\n" +' >> config.js
RUN echo '  "• Active Subscriptions: {active}\\\\n" +' >> config.js
RUN echo '  "• Total Revenue: {currency}{revenue}\\\\n" +' >> config.js
RUN echo '  "• Pending Payments: {pending}"' >> config.js
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
RUN echo '        file_size INTEGER,' >> database.js
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
# Add this after the existing database tables
RUN echo '      // Subscriptions table' >> database.js
RUN echo '      this.db.run(`CREATE TABLE IF NOT EXISTS subscriptions (' >> database.js
RUN echo '        id INTEGER PRIMARY KEY AUTOINCREMENT,' >> database.js
RUN echo '        phone_number TEXT,' >> database.js
RUN echo '        plan TEXT,' >> database.js
RUN echo '        amount_paid REAL,' >> database.js
RUN echo '        start_date INTEGER,' >> database.js
RUN echo '        end_date INTEGER,' >> database.js
RUN echo '        status TEXT DEFAULT '\''active'\'',' >> database.js
RUN echo '        created_at INTEGER DEFAULT (strftime('\''%s'\'', '\''now'\'')),' >> database.js
RUN echo '        FOREIGN KEY (phone_number) REFERENCES users (phone_number)' >> database.js
RUN echo '      )`);' >> database.js
# Create commands/index.js properly
RUN echo 'const { handleActivation, isUserActivated, isUserAdmin, isGroupManager } = require("./activation");' > commands/index.js
RUN echo 'const { handleFileDownload } = require("./download");' >> commands/index.js
RUN echo 'const { handleStatusCommand } = require("./status");' >> commands/index.js
RUN echo 'const { handleAdminCommands } = require("./admin");' >> commands/index.js
RUN echo 'const { handlePaymentsCommand } = require("./payments");' >> commands/index.js
RUN echo 'const { handleDatingCommand } = require("./dating");' >> commands/index.js
RUN echo 'const { handleGroupActivation, handleGroupCommands, handleGroupInvite, shouldReplyToIndividual } = require("./group");' >> commands/index.js
RUN echo 'const { handleSubscriptionCommand, handleAdminSubscriptionCommands } = require("./subscription");' >> commands/index.js
RUN echo '' >> commands/index.js
RUN echo 'module.exports = {' >> commands/index.js
RUN echo '  handleActivation,' >> commands/index.js
RUN echo '  isUserActivated,' >> commands/index.js
RUN echo '  isUserAdmin,' >> commands/index.js
RUN echo '  isGroupManager,' >> commands/index.js
RUN echo '  handleFileDownload,' >> commands/index.js
RUN echo '  handleStatusCommand,' >> commands/index.js
RUN echo '  handleAdminCommands,' >> commands/index.js
RUN echo '  handlePaymentsCommand,' >> commands/index.js
RUN echo '  handleDatingCommand,' >> commands/index.js
RUN echo '  handleGroupActivation,' >> commands/index.js
RUN echo '  handleGroupCommands,' >> commands/index.js
RUN echo '  handleGroupInvite,' >> commands/index.js
RUN echo '  shouldReplyToIndividual,' >> commands/index.js
RUN echo '  handleSubscriptionCommand,' >> commands/index.js
RUN echo '  handleAdminSubscriptionCommands' >> commands/index.js
RUN echo '};' >> commands/index.js
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
# Add subscription import
RUN echo 'const { handleSubscriptionCommand, handleAdminSubscriptionCommands } = require("./subscription");' >> commands/index.js
RUN echo '  handleSubscriptionCommand,' >> commands/index.js
RUN echo '  handleAdminSubscriptionCommands,' >> commands/index.js

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
# Modify the download limit check to include subscription check
RUN echo '    // Check download limits (admins and subscribers have no limits)' >> commands/download.js
RUN echo '    const hasActiveSubscription = await db.getActiveSubscription(senderNumber);' >> commands/download.js
RUN echo '    if (!user.is_admin && !hasActiveSubscription && !canDownloadMore(user, isVideo, estimatedSize)) {' >> commands/download.js
RUN echo '  return false;' >> commands/download.js
RUN echo '}' >> commands/download.js
RUN echo '' >> commands/download.js
RUN echo 'module.exports = { handleFileDownload };' >> commands/download.js
# Update download.js to check for subscriptions
RUN echo 'const { searchAndDownloadFile } = require("../utils");' > commands/download.js
RUN echo 'const { responses } = require("../config");' >> commands/download.js
RUN echo 'const db = require("../database");' >> commands/download.js
RUN echo 'const { canDownloadMore, estimateFileSize, getFileType } = require("../utils");' >> commands/download.js
RUN echo '' >> commands/download.js
RUN echo 'async function handleFileDownload(sock, text, sender, senderNumber) {' >> commands/download.js
RUN echo '  if (!text.startsWith("!") && text.length > 2) {' >> commands/download.js
RUN echo '    const user = await db.getUser(senderNumber);' >> commands/download.js
RUN echo '    if (!user) {' >> commands/download.js
RUN echo '      await sock.sendMessage(sender, { text: responses.notActivated });' >> commands/download.js
RUN echo '      return true;' >> commands/download.js
RUN echo '    }' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    const fileType = getFileType(text);' >> commands/download.js
RUN echo '    const isVideo = fileType === "video";' >> commands/download.js
RUN echo '    const isImage = fileType === "image";' >> commands/download.js
RUN echo '    const estimatedSize = estimateFileSize(text);' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    // Check if user has active subscription' >> commands/download.js
RUN echo '    const hasActiveSubscription = await db.getActiveSubscription(senderNumber);' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    // Check download limits (admins and subscribers have no limits)' >> commands/download.js
RUN echo '    if (!user.is_admin && !hasActiveSubscription && !canDownloadMore(user, isVideo, estimatedSize)) {' >> commands/download.js
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
RUN echo '    // Update download stats (only for non-subscribers)' >> commands/download.js
RUN echo '    if (!hasActiveSubscription) {' >> commands/download.js
RUN echo '      await db.updateDownloadStats(senderNumber, isVideo, estimatedSize);' >> commands/download.js
RUN echo '    }' >> commands/download.js
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

# Add subscription handling after admin commands
RUN echo '  // Handle subscription commands' >> handlers.js
RUN echo '  const subHandled = await handleSubscriptionCommand(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (subHandled) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle admin subscription commands' >> handlers.js
RUN echo '  if (await isUserAdmin(senderNumber)) {' >> handlers.js
RUN echo '    const adminSubHandled = await handleAdminSubscriptionCommands(sock, text, sender, senderNumber, true);' >> handlers.js
RUN echo '    if (adminSubHandled) return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '}' >> handlers.js
RUN echo '' >> handlers.js
RUN echo 'module.exports = { handleMessage };' >> handlers.js

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

# Update handlers.js to include subscription commands
RUN echo 'const { ' > handlers.js
RUN echo '  handleActivation,' >> handlers.js
RUN echo '  isUserActivated,' >> handlers.js
RUN echo '  isUserAdmin,' >> handlers.js
RUN echo '  isGroupManager' >> handlers.js
RUN echo '} = require("./commands/activation");' >> handlers.js
RUN echo 'const { handleFileDownload } = require("./commands/download");' >> handlers.js
RUN echo 'const { handleStatusCommand } = require("./commands/status");' >> handlers.js
RUN echo 'const { handleAdminCommands } = require("./commands/admin");' >> handlers.js
RUN echo 'const { handlePaymentsCommand } = require("./commands/payments");' >> handlers.js
RUN echo 'const { handleDatingCommand } = require("./commands/dating");' >> handlers.js
RUN echo 'const { handleGroupActivation, handleGroupCommands, handleGroupInvite, shouldReplyToIndividual } = require("./commands/group");' >> handlers.js
RUN echo 'const { handleSubscriptionCommand, handleAdminSubscriptionCommands } = require("./commands/subscription");' >> handlers.js
RUN echo 'const { responses } = require("./config");' >> handlers.js
RUN echo '' >> handlers.js
RUN echo 'async function handleMessage(sock, text, sender, senderNumber) {' >> handlers.js
RUN echo '  // Check activation first' >> handlers.js
RUN echo '  const isActivated = await handleActivation(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (isActivated) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Only respond to activated users' >> handlers.js
RUN echo '  if (!await isUserActivated(senderNumber)) {' >> handlers.js
RUN echo '    return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle terms command' >> handlers.js
RUN echo '  if (text === "!terms") {' >> handlers.js
RUN echo '    await sock.sendMessage(sender, { text: responses.terms });' >> handlers.js
RUN echo '    return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle subscription commands' >> handlers.js
RUN echo '  const subHandled = await handleSubscriptionCommand(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (subHandled) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle admin commands' >> handlers.js
RUN echo '  if (await isUserAdmin(senderNumber)) {' >> handlers.js
RUN echo '    const adminHandled = await handleAdminCommands(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '    if (adminHandled) return;' >> handlers.js
RUN echo '    ' >> handlers.js
RUN echo '    const adminSubHandled = await handleAdminSubscriptionCommands(sock, text, sender, senderNumber, true);' >> handlers.js
RUN echo '    if (adminSubHandled) return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle group commands' >> handlers.js
RUN echo '  if (await isGroupManager(senderNumber)) {' >> handlers.js
RUN echo '    const groupHandled = await handleGroupCommands(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '    if (groupHandled) return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle dating commands' >> handlers.js
RUN echo '  const datingHandled = await handleDatingCommand(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (datingHandled) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle file downloads' >> handlers.js
RUN echo '  const downloadHandled = await handleFileDownload(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (downloadHandled) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle status command' >> handlers.js
RUN echo '  const statusHandled = await handleStatusCommand(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (statusHandled) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle payments command' >> handlers.js
RUN echo '  const paymentsHandled = await handlePaymentsCommand(sock, text, sender, senderNumber);' >> handlers.js
RUN echo '  if (paymentsHandled) return;' >> handlers.js
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


# Create the subscription commands file
RUN echo 'const { responses, SUBSCRIPTION_CONFIG } = require("../config");' > commands/subscription.js
RUN echo 'const db = require("../database");' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo 'class SubscriptionManager {' >> commands/subscription.js
RUN echo '    constructor() {' >> commands/subscription.js
RUN echo '        this.pendingSubscriptions = new Map();' >> commands/subscription.js
RUN echo '    }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '    async handleSubscriptionCommand(sock, text, sender, senderNumber) {' >> commands/subscription.js
RUN echo '        if (text === "!subscribe" || text === "!subscription") {' >> commands/subscription.js
RUN echo '            await sock.sendMessage(sender, { text: responses.subscriptionOptions });' >> commands/subscription.js
RUN echo '            return true;' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        if (text.startsWith("!subscribe ")) {' >> commands/subscription.js
RUN echo '            const plan = text.replace("!subscribe ", "").toLowerCase();' >> commands/subscription.js
RUN echo '            return await this.handlePlanSelection(sock, sender, senderNumber, plan);' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        if (text.startsWith("!paid ")) {' >> commands/subscription.js
RUN echo '            return await this.handlePaymentConfirmation(sock, text, sender, senderNumber);' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        if (text === "!mysubscription") {' >> commands/subscription.js
RUN echo '            return await this.handleSubscriptionStatus(sock, sender, senderNumber);' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        return false;' >> commands/subscription.js
RUN echo '    }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '    async handlePlanSelection(sock, sender, senderNumber, plan) {' >> commands/subscription.js
RUN echo '        if (!SUBSCRIPTION_CONFIG.PLANS[plan]) {' >> commands/subscription.js
RUN echo '            await sock.sendMessage(sender, { text: "Invalid plan. Available plans: 2weeks, 1month, 3months, 6months, 1year" });' >> commands/subscription.js
RUN echo '            return true;' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        const planInfo = SUBSCRIPTION_CONFIG.PLANS[plan];' >> commands/subscription.js
RUN echo '        const amountZAR = (planInfo.price * SUBSCRIPTION_CONFIG.CURRENCY_RATES.USD_TO_ZAR).toFixed(2);' >> commands/subscription.js
RUN echo '        ' >> commands/subscription.js
RUN echo '        const message = responses.paymentInstructions' >> commands/subscription.js
RUN echo '            .replace("{plan}", plan)' >> commands/subscription.js
RUN echo '            .replace("{amount}", `R${amountZAR} / \\\\$${planInfo.price}`);' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        this.pendingSubscriptions.set(senderNumber, {' >> commands/subscription.js
RUN echo '            plan,' >> commands/subscription.js
RUN echo '            amount: planInfo.price,' >> commands/subscription.js
RUN echo '            duration: planInfo.duration' >> commands/subscription.js
RUN echo '        });' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        await sock.sendMessage(sender, { text: message });' >> commands/subscription.js
RUN echo '        return true;' >> commands/subscription.js
RUN echo '    }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '    async handlePaymentConfirmation(sock, text, sender, senderNumber) {' >> commands/subscription.js
RUN echo '        const parts = text.replace("!paid ", "").split(" ");' >> commands/subscription.js
RUN echo '        if (parts.length < 2) {' >> commands/subscription.js
RUN echo '            await sock.sendMessage(sender, { text: "Usage: !paid [amount] [reference]" });' >> commands/subscription.js
RUN echo '            return true;' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        const pendingSub = this.pendingSubscriptions.get(senderNumber);' >> commands/subscription.js
RUN echo '        if (!pendingSub) {' >> commands/subscription.js
RUN echo '            await sock.sendMessage(sender, { text: "No pending subscription. Use !subscribe first." });' >> commands/subscription.js
RUN echo '            return true;' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        await db.createSubscription(senderNumber, pendingSub.plan, pendingSub.amount, pendingSub.duration);' >> commands/subscription.js
RUN echo '        this.pendingSubscriptions.delete(senderNumber);' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        const expiryDate = new Date(Date.now() + pendingSub.duration * 24 * 60 * 60 * 1000);' >> commands/subscription.js
RUN echo '        const successMessage = responses.subscriptionActive' >> commands/subscription.js
RUN echo '            .replace("{plan}", pendingSub.plan)' >> commands/subscription.js
RUN echo '            .replace("{expiryDate}", expiryDate.toLocaleDateString());' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        await sock.sendMessage(sender, { text: successMessage });' >> commands/subscription.js
RUN echo '        return true;' >> commands/subscription.js
RUN echo '    }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '    async handleSubscriptionStatus(sock, sender, senderNumber) {' >> commands/subscription.js
RUN echo '        const subscription = await db.getActiveSubscription(senderNumber);' >> commands/subscription.js
RUN echo '        ' >> commands/subscription.js
RUN echo '        if (!subscription) {' >> commands/subscription.js
RUN echo '            await sock.sendMessage(sender, { text: "No active subscription found." });' >> commands/subscription.js
RUN echo '            return true;' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        const expiryDate = new Date(subscription.end_date);' >> commands/subscription.js
RUN echo '        const daysLeft = Math.ceil((expiryDate - Date.now()) / (1000 * 60 * 60 * 24));' >> commands/subscription.js
RUN echo '        const amountZAR = (subscription.amount_paid * SUBSCRIPTION_CONFIG.CURRENCY_RATES.USD_TO_ZAR).toFixed(2);' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        const statusMessage = `📋 *Your Subscription:*\\\\n\\\\n` +' >> commands/subscription.js
RUN echo '            `• Plan: ${subscription.plan}\\\\n` +' >> commands/subscription.js
RUN echo '            `• Status: Active ✅\\\\n` +' >> commands/subscription.js
RUN echo '            `• Expires: ${expiryDate.toLocaleDateString()}\\\\n` +' >> commands/subscription.js
RUN echo '            `• Days left: ${daysLeft}\\\\n` +' >> commands/subscription.js
RUN echo '            `• Amount paid: R${amountZAR}`;' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        await sock.sendMessage(sender, { text: statusMessage });' >> commands/subscription.js
RUN echo '        return true;' >> commands/subscription.js
RUN echo '    }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '    async handleAdminSubscriptionCommands(sock, text, sender, senderNumber, isAdmin) {' >> commands/subscription.js
RUN echo '        if (!isAdmin) return false;' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        if (text === "!substats") {' >> commands/subscription.js
RUN echo '            const stats = await db.getSubscriptionStats();' >> commands/subscription.js
RUN echo '            const revenueZAR = (stats.revenue * SUBSCRIPTION_CONFIG.CURRENCY_RATES.USD_TO_ZAR).toFixed(2);' >> commands/subscription.js
RUN echo '            ' >> commands/subscription.js
RUN echo '            const message = responses.adminSubStats' >> commands/subscription.js
RUN echo '                .replace("{total}", stats.total)' >> commands/subscription.js
RUN echo '                .replace("{active}", stats.active)' >> commands/subscription.js
RUN echo '                .replace("{revenue}", revenueZAR)' >> commands/subscription.js
RUN echo '                .replace("{pending}", stats.pending)' >> commands/subscription.js
RUN echo '                .replace("{currency}", "R");' >> commands/subscription.js
RUN echo '            ' >> commands/subscription.js
RUN echo '            await sock.sendMessage(sender, { text: message });' >> commands/subscription.js
RUN echo '            return true;' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        if (text === "!subscribers") {' >> commands/subscription.js
RUN echo '            const subscribers = await db.getAllSubscribers();' >> commands/subscription.js
RUN echo '            let message = "📋 *Active Subscribers:*\\\\n\\\\n";' >> commands/subscription.js
RUN echo '            subscribers.forEach((sub, index) => {' >> commands/subscription.js
RUN echo '                const expiry = new Date(sub.end_date);' >> commands/subscription.js
RUN echo '                message += `${index + 1}. ${sub.phone_number}\\\\n   Plan: ${sub.plan}\\\\n   Expires: ${expiry.toLocaleDateString()}\\\\n\\\\n`;' >> commands/subscription.js
RUN echo '            });' >> commands/subscription.js
RUN echo '            await sock.sendMessage(sender, { text: message });' >> commands/subscription.js
RUN echo '            return true;' >> commands/subscription.js
RUN echo '        }' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo '        return false;' >> commands/subscription.js
RUN echo '    }' >> commands/subscription.js
RUN echo '}' >> commands/subscription.js
RUN echo '' >> commands/subscription.js
RUN echo 'module.exports = new SubscriptionManager();' >> commands/subscription.js

# Create basic structure for missing command files
RUN echo 'module.exports = { handleStatusCommand: async () => false };' > commands/status.js
RUN echo 'module.exports = { handlePaymentsCommand: async () => false };' > commands/payments.js
RUN echo 'module.exports = { handleDatingCommand: async () => false };' > commands/dating.js

# Create group.js with basic structure
RUN echo 'module.exports = {' > commands/group.js
RUN echo '  handleGroupActivation: async () => false,' >> commands/group.js
RUN echo '  handleGroupCommands: async () => false,' >> commands/group.js
RUN echo '  handleGroupInvite: async () => false,' >> commands/group.js
RUN echo '  shouldReplyToIndividual: () => true' >> commands/group.js
RUN echo '};' >> commands/group.js

# Create admin.js with basic structure
RUN echo 'module.exports = { handleAdminCommands: async () => false };' > commands/admin.js
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
