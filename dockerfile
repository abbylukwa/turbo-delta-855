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
# Update the welcome message in config.js to include QR code info
RUN echo '  welcome: "🔒 *Welcome to Abby'\''s Secure Bot* 🔒\\n\\n' >> config.js
RUN echo '📋 *Terms & Conditions:*\\n' >> config.js
RUN echo '• Your data is encrypted and secure\\n' >> config.js
RUN echo '• We never share your personal information\\n' >> config.js
RUN echo '• Downloads are for personal use only\\n' >> config.js
RUN echo '• Illegal content is strictly prohibited\\n\\n' >> config.js
RUN echo '🚀 *Available Commands:*\\n' >> config.js
RUN echo '• Send filename - Search and download\\n' >> config.js
RUN echo '• !qrcode - Generate pairing QR code\\n' >> config.js
RUN echo '• !subscribe - View subscription plans\\n' >> config.js
RUN echo '• !terms - View terms and conditions\\n\\n' >> config.js
RUN echo '💎 *Multi-Device Support:*\\n' >> config.js
RUN echo 'Use !qrcode to generate QR code for pairing additional devices!",' >> config.js

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
# Create commands directory and index.js properly
RUN mkdir -p commands && \
    echo 'const { handleActivation, isUserActivated, isUserAdmin, isGroupManager } = require("./activation");' > commands/index.js && \
    echo 'const { handleFileDownload } = require("./download");' >> commands/index.js && \
    echo 'const { handleStatusCommand } = require("./status");' >> commands/index.js && \
    echo 'const { handleAdminCommands } = require("./admin");' >> commands/index.js && \
    echo 'const { handlePaymentsCommand } = require("./payments");' >> commands/index.js && \
    echo 'const { handleDatingCommand } = require("./dating");' >> commands/index.js && \
    echo 'const { handleGroupActivation, handleGroupCommands, handleGroupInvite, shouldReplyToIndividual } = require("./group");' >> commands/index.js && \
    echo 'const { handleSubscriptionCommand, handleAdminSubscriptionCommands } = require("./subscription");' >> commands/index.js && \
    echo '' >> commands/index.js && \
    echo 'module.exports = {' >> commands/index.js && \
    echo '  handleActivation,' >> commands/index.js && \
    echo '  isUserActivated,' >> commands/index.js && \
    echo '  isUserAdmin,' >> commands/index.js && \
    echo '  isGroupManager,' >> commands/index.js && \
    echo '  handleFileDownload,' >> commands/index.js && \
    echo '  handleStatusCommand,' >> commands/index.js && \
    echo '  handleAdminCommands,' >> commands/index.js && \
    echo '  handlePaymentsCommand,' >> commands/index.js && \
    echo '  handleDatingCommand,' >> commands/index.js && \
    echo '  handleGroupActivation,' >> commands/index.js && \
    echo '  handleGroupCommands,' >> commands/index.js && \
    echo '  handleGroupInvite,' >> commands/index.js && \
    echo '  shouldReplyToIndividual,' >> commands/index.js && \
    echo '  handleSubscriptionCommand,' >> commands/index.js && \
    echo '  handleAdminSubscriptionCommands' >> commands/index.js && \
    echo '};' >> commands/index.js
# Update commands/index.js to include QR code handler
RUN echo 'const { handleActivation, isUserActivated, isUserAdmin, isGroupManager } = require("./activation");' > commands/index.js
RUN echo 'const { handleFileDownload } = require("./download");' >> commands/index.js
RUN echo 'const { handleStatusCommand } = require("./status");' >> commands/index.js
RUN echo 'const { handleAdminCommands } = require("./admin");' >> commands/index.js
RUN echo 'const { handlePaymentsCommand } = require("./payments");' >> commands/index.js
RUN echo 'const { handleDatingCommand } = require("./dating");' >> commands/index.js
RUN echo 'const { handleGroupActivation, handleGroupCommands, handleGroupInvite, shouldReplyToIndividual } = require("./group");' >> commands/index.js
RUN echo 'const { handleSubscriptionCommand, handleAdminSubscriptionCommands } = require("./subscription");' >> commands/index.js
RUN echo 'const { handleQRCodeCommand } = require("./qrcode");' >> commands/index.js
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
RUN echo '  handleAdminSubscriptionCommands,' >> commands/index.js
RUN echo '  handleQRCodeCommand' >> commands/index.js
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
RUN echo '    // Check download limits (admins and subscribers have no limits)' >> commands/download.js && \
    echo '    const hasActiveSubscription = await db.getActiveSubscription(senderNumber);' >> commands/download.js && \
    echo '    if (!user.is_admin && !hasActiveSubscription && !canDownloadMore(user, isVideo, estimatedSize)) {' >> commands/download.js && \
    echo '        return false;' >> commands/download.js && \
    echo '    }' >> commands/download.js && \
    echo '' >> commands/download.js && \
    echo '    return true;' >> commands/download.js && \
    echo '}' >> commands/download.js && \
    echo '' >> commands/download.js && \

# Install dependencies
RUN npm install

# Start the bot
CMD ["node", "index.js"]
