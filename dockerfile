FROM node:22-alpine

# Install dependencies
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++ curl wget

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
    "qrcode-terminal": "^0.12.0"\
  },\
  "scripts": {\
    "start": "node index.js"\
  }\
}' > package.json

# Create config.js
RUN echo 'const SEARCH_WEBSITES = [' > config.js
RUN echo '  "https://912.com/search?q=",' >> config.js
RUN echo '  "https://012.com/search?query=",' >> config.js
RUN echo '  "https://123.com/find?q="' >> config.js
RUN echo '];' >> config.js
RUN echo '' >> config.js
RUN echo 'const responses = {' >> config.js
RUN echo '  welcome: "Welcome to Abby'\''s Bot! 🤖\\n\\nAvailable commands:\\n• Send any filename to search and download\\n• !mystatus - Check your download status\\n• !payments - Payment information\\n\\nChatting is free, downloads have limits based on your subscription.",' >> config.js
RUN echo '  activation: "Activation successful! Welcome to Abby'\''s Bot. 🤖",' >> config.js
RUN echo '  adminActivation: "Admin activation successful! Welcome to Abby'\''s Bot. 🤖",' >> config.js
RUN echo '  notActivated: "Please activate first by sending: Abby0121",' >> config.js
RUN echo '  searchStarted: "🔍 Searching for your file across multiple websites...",' >> config.js
RUN echo '  downloadLimit: "Download limit reached. Please subscribe for unlimited downloads.",' >> config.js
RUN echo '  downloadSuccess: "Download completed successfully! 🎉",' >> config.js
RUN echo '  downloadFailed: "Download failed. Please try another file.",' >> config.js
RUN echo '  fileNotFound: "File not found on any of our supported websites.",' >> config.js
RUN echo '  paymentInfo: "📧 Payment Information:\\n\\nFor unlimited downloads, please contact the admin for subscription details.\\n\\nYou can send: !payments to see this information again."' >> config.js
RUN echo '};' >> config.js
RUN echo '' >> config.js
RUN echo 'module.exports = { SEARCH_WEBSITES, responses };' >> config.js

# Create storage.js
RUN echo 'let activatedUsers = new Set();' > storage.js
RUN echo 'let adminUsers = new Set();' >> storage.js
RUN echo 'let downloadCounts = {};' >> storage.js
RUN echo 'let lastDownloadTime = {};' >> storage.js
RUN echo 'let subscribedUsers = {};' >> storage.js
RUN echo '' >> storage.js
RUN echo 'module.exports = {' >> storage.js
RUN echo '  activatedUsers,' >> storage.js
RUN echo '  adminUsers,' >> storage.js
RUN echo '  downloadCounts,' >> storage.js
RUN echo '  lastDownloadTime,' >> storage.js
RUN echo '  subscribedUsers' >> storage.js
RUN echo '};' >> storage.js

# Create utils.js
RUN echo 'const fs = require("fs");' > utils.js
RUN echo 'const axios = require("axios");' >> utils.js
RUN echo 'const { SEARCH_WEBSITES } = require("./config");' >> utils.js
RUN echo '' >> utils.js
RUN echo 'async function searchAndDownloadFile(filename, senderNumber) {' >> utils.js
RUN echo '  try {' >> utils.js
RUN echo '    const randomSite = SEARCH_WEBSITES[Math.floor(Math.random() * SEARCH_WEBSITES.length)];' >> utils.js
RUN echo '    const searchUrl = randomSite + encodeURIComponent(filename);' >> utils.js
RUN echo '    ' >> utils.js
RUN echo '    const timestamp = new Date().getTime();' >> utils.js
RUN echo '    const downloadFilename = `downloads/${senderNumber}_${timestamp}_${filename.replace(/[^a-zA-Z0-9]/g, "_")}.download`;' >> utils.js
RUN echo '    ' >> utils.js
RUN echo '    if (!fs.existsSync("downloads")) {' >> utils.js
RUN echo '      fs.mkdirSync("downloads");' >> utils.js
RUN echo '    }' >> utils.js
RUN echo '    ' >> utils.js
RUN echo '    return new Promise((resolve) => {' >> utils.js
RUN echo '      setTimeout(() => {' >> utils.js
RUN echo '        fs.writeFileSync(downloadFilename, `Simulated download of ${filename} from ${randomSite}`);' >> utils.js
RUN echo '        resolve({ success: true, filename: downloadFilename });' >> utils.js
RUN echo '      }, 2000);' >> utils.js
RUN echo '    });' >> utils.js
RUN echo '  } catch (error) {' >> utils.js
RUN echo '    return { success: false, error: error.message };' >> utils.js
RUN echo '  }' >> utils.js
RUN echo '}' >> utils.js
RUN echo '' >> utils.js
RUN echo 'module.exports = { searchAndDownloadFile };' >> utils.js

# Create commands/activation.js
RUN mkdir -p commands
RUN echo 'const { responses } = require("../config");' > commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo 'async function handleActivation(sock, text, sender, senderNumber, activatedUsers, adminUsers) {' >> commands/activation.js
RUN echo '  if (text === "Abby0121") {' >> commands/activation.js
RUN echo '    activatedUsers.add(senderNumber);' >> commands/activation.js
RUN echo '    await sock.sendMessage(sender, { text: responses.activation });' >> commands/activation.js
RUN echo '    await sock.sendMessage(sender, { text: responses.welcome });' >> commands/activation.js
RUN echo '    return true;' >> commands/activation.js
RUN echo '  }' >> commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo '  if (text === "Admin0121") {' >> commands/activation.js
RUN echo '    adminUsers.add(senderNumber);' >> commands/activation.js
RUN echo '    activatedUsers.add(senderNumber);' >> commands/activation.js
RUN echo '    await sock.sendMessage(sender, { text: responses.adminActivation });' >> commands/activation.js
RUN echo '    await sock.sendMessage(sender, { text: responses.welcome });' >> commands/activation.js
RUN echo '    return true;' >> commands/activation.js
RUN echo '  }' >> commands/activation.js
RUN echo '  return false;' >> commands/activation.js
RUN echo '}' >> commands/activation.js
RUN echo '' >> commands/activation.js
RUN echo 'module.exports = { handleActivation };' >> commands/activation.js

# Create commands/download.js
RUN echo 'const { searchAndDownloadFile } = require("../utils");' > commands/download.js
RUN echo 'const { responses } = require("../config");' >> commands/download.js
RUN echo '' >> commands/download.js
RUN echo 'async function handleFileDownload(sock, text, sender, senderNumber, activatedUsers, adminUsers, downloadCounts, lastDownloadTime, subscribedUsers) {' >> commands/download.js
RUN echo '  if (!text.startsWith("!") && text.length > 2) {' >> commands/download.js
RUN echo '    await sock.sendMessage(sender, { text: responses.searchStarted });' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    const now = Date.now();' >> commands/download.js
RUN echo '    const hasSubscription = subscribedUsers[senderNumber] && new Date() < new Date(subscribedUsers[senderNumber].expiry);' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    if (!hasSubscription && !adminUsers.has(senderNumber)) {' >> commands/download.js
RUN echo '      if (!downloadCounts[senderNumber]) downloadCounts[senderNumber] = 0;' >> commands/download.js
RUN echo '      if (!lastDownloadTime[senderNumber]) lastDownloadTime[senderNumber] = 0;' >> commands/download.js
RUN echo '      ' >> commands/download.js
RUN echo '      if (now - lastDownloadTime[senderNumber] >= 9 * 60 * 60 * 1000) {' >> commands/download.js
RUN echo '        downloadCounts[senderNumber] = 0;' >> commands/download.js
RUN echo '        lastDownloadTime[senderNumber] = now;' >> commands/download.js
RUN echo '      }' >> commands/download.js
RUN echo '      ' >> commands/download.js
RUN echo '      if (downloadCounts[senderNumber] >= 5) {' >> commands/download.js
RUN echo '        await sock.sendMessage(sender, { text: responses.downloadLimit });' >> commands/download.js
RUN echo '        return true;' >> commands/download.js
RUN echo '      }' >> commands/download.js
RUN echo '      ' >> commands/download.js
RUN echo '      downloadCounts[senderNumber]++;' >> commands/download.js
RUN echo '      ' >> commands/download.js
RUN echo '      if (downloadCounts[senderNumber] === 3) {' >> commands/download.js
RUN echo '        await sock.sendMessage(sender, { text: responses.paymentInfo });' >> commands/download.js
RUN echo '      }' >> commands/download.js
RUN echo '    }' >> commands/download.js
RUN echo '    ' >> commands/download.js
RUN echo '    if (hasSubscription) {' >> commands/download.js
RUN echo '      subscribedUsers[senderNumber].downloads++;' >> commands/download.js
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

# Create commands/status.js
RUN echo 'const { responses } = require("../config");' > commands/status.js
RUN echo '' >> commands/status.js
RUN echo 'async function handleStatusCommand(sock, text, sender, senderNumber, downloadCounts, subscribedUsers, adminUsers) {' >> commands/status.js
RUN echo '  if (text === "!mystatus") {' >> commands/status.js
RUN echo '    const hasSubscription = subscribedUsers[senderNumber] && new Date() < new Date(subscribedUsers[senderNumber].expiry);' >> commands/status.js
RUN echo '    ' >> commands/status.js
RUN echo '    if (hasSubscription) {' >> commands/status.js
RUN echo '      const expiryDate = new Date(subscribedUsers[senderNumber].expiry);' >> commands/status.js
RUN echo '      const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));' >> commands/status.js
RUN echo '      await sock.sendMessage(sender, { ' >> commands/status.js
RUN echo '        text: `Your subscription is active.\\nExpiry: ${expiryDate.toDateString()}\\nDays left: ${daysLeft}\\nDownloads used: ${subscribedUsers[senderNumber].downloads || 0}` ' >> commands/status.js
RUN echo '      });' >> commands/status.js
RUN echo '    } else if (adminUsers.has(senderNumber)) {' >> commands/status.js
RUN echo '      await sock.sendMessage(sender, { text: "You are an admin with unlimited access." });' >> commands/status.js
RUN echo '    } else {' >> commands/status.js
RUN echo '      const remaining = 5 - (downloadCounts[senderNumber] || 0);' >> commands/status.js
RUN echo '      await sock.sendMessage(sender, { ' >> commands/status.js
RUN echo '        text: `You are on free tier.\\nRemaining free downloads: ${remaining}` ' >> commands/status.js
RUN echo '      });' >> commands/status.js
RUN echo '    }' >> commands/status.js
RUN echo '    return true;' >> commands/status.js
RUN echo '  }' >> commands/status.js
RUN echo '  return false;' >> commands/status.js
RUN echo '}' >> commands/status.js
RUN echo '' >> commands/status.js
RUN echo 'module.exports = { handleStatusCommand };' >> commands/status.js

# Create commands/admin.js
RUN echo 'const { responses } = require("../config");' > commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo 'async function handleAdminCommands(sock, text, sender, senderNumber, adminUsers, subscribedUsers) {' >> commands/admin.js
RUN echo '  if (!adminUsers.has(senderNumber)) return false;' >> commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo '  if (text.startsWith("addsub ")) {' >> commands/admin.js
RUN echo '    const parts = text.replace("addsub ", "").split(" ");' >> commands/admin.js
RUN echo '    if (parts.length >= 2) {' >> commands/admin.js
RUN echo '      const number = parts[0];' >> commands/admin.js
RUN echo '      const days = parseInt(parts[1]);' >> commands/admin.js
RUN echo '      ' >> commands/admin.js
RUN echo '      if (number.startsWith("+") && !isNaN(days)) {' >> commands/admin.js
RUN echo '        const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);' >> commands/admin.js
RUN echo '        subscribedUsers[number] = {' >> commands/admin.js
RUN echo '          expiry: expiryDate,' >> commands/admin.js
RUN echo '          downloads: 0' >> commands/admin.js
RUN echo '        };' >> commands/admin.js
RUN echo '        await sock.sendMessage(sender, { text: `Subscription added for ${number} for ${days} days` });' >> commands/admin.js
RUN echo '      }' >> commands/admin.js
RUN echo '    }' >> commands/admin.js
RUN echo '    return true;' >> commands/admin.js
RUN echo '  }' >> commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo '  if (text === "!stats") {' >> commands/admin.js
RUN echo '    let activeSubs = 0;' >> commands/admin.js
RUN echo '    for (const num in subscribedUsers) {' >> commands/admin.js
RUN echo '      if (new Date() < new Date(subscribedUsers[num].expiry)) activeSubs++;' >> commands/admin.js
RUN echo '    }' >> commands/admin.js
RUN echo '    ' >> commands/admin.js
RUN echo '    const stats = `Active users: ${activatedUsers.size}\\nAdmin users: ${adminUsers.size}\\nActive subscriptions: ${activeSubs}`;' >> commands/admin.js
RUN echo '    await sock.sendMessage(sender, { text: stats });' >> commands/admin.js
RUN echo '    return true;' >> commands/admin.js
RUN echo '  }' >> commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo '  if (text === "!subs") {' >> commands/admin.js
RUN echo '    let subsList = "Active Subscriptions:\\n";' >> commands/admin.js
RUN echo '    for (const num in subscribedUsers) {' >> commands/admin.js
RUN echo '      if (new Date() < new Date(subscribedUsers[num].expiry)) {' >> commands/admin.js
RUN echo '        const expiry = new Date(subscribedUsers[num].expiry);' >> commands/admin.js
RUN echo '        const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));' >> commands/admin.js
RUN echo '        subsList += `${num}: Expires ${expiry.toDateString()} (${daysLeft} days left), Downloads: ${subscribedUsers[num].downloads || 0}\\n`;' >> commands/admin.js
RUN echo '      }' >> commands/admin.js
RUN echo '    }' >> commands/admin.js
RUN echo '    await sock.sendMessage(sender, { text: subsList });' >> commands/admin.js
RUN echo '    return true;' >> commands/admin.js
RUN echo '  }' >> commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo '  return false;' >> commands/admin.js
RUN echo '}' >> commands/admin.js
RUN echo '' >> commands/admin.js
RUN echo 'module.exports = { handleAdminCommands };' >> commands/admin.js

# Create commands/payments.js
RUN echo 'const { responses } = require("../config");' > commands/payments.js
RUN echo '' >> commands/payments.js
RUN echo 'async function handlePaymentsCommand(sock, text, sender) {' >> commands/payments.js
RUN echo '  if (text === "!payments") {' >> commands/payments.js
RUN echo '    await sock.sendMessage(sender, { text: responses.paymentInfo });' >> commands/payments.js
RUN echo '    return true;' >> commands/payments.js
RUN echo '  }' >> commands/payments.js
RUN echo '  return false;' >> commands/payments.js
RUN echo '}' >> commands/payments.js
RUN echo '' >> commands/payments.js
RUN echo 'module.exports = { handlePaymentsCommand };' >> commands/payments.js

# Create commands/index.js
RUN echo 'const { handleActivation } = require("./activation");' > commands/index.js
RUN echo 'const { handleFileDownload } = require("./download");' >> commands/index.js
RUN echo 'const { handleStatusCommand } = require("./status");' >> commands/index.js
RUN echo 'const { handleAdminCommands } = require("./admin");' >> commands/index.js
RUN echo 'const { handlePaymentsCommand } = require("./payments");' >> commands/index.js
RUN echo '' >> commands/index.js
RUN echo 'module.exports = {' >> commands/index.js
RUN echo '  handleActivation,' >> commands/index.js
RUN echo '  handleFileDownload,' >> commands/index.js
RUN echo '  handleStatusCommand,' >> commands/index.js
RUN echo '  handleAdminCommands,' >> commands/index.js
RUN echo '  handlePaymentsCommand' >> commands/index.js
RUN echo '};' >> commands/index.js

# Create handlers.js
RUN echo 'const { ' > handlers.js
RUN echo '  handleActivation,' >> handlers.js
RUN echo '  handleFileDownload,' >> handlers.js
RUN echo '  handleStatusCommand,' >> handlers.js
RUN echo '  handleAdminCommands,' >> handlers.js
RUN echo '  handlePaymentsCommand' >> handlers.js
RUN echo '} = require("./commands");' >> handlers.js
RUN echo '' >> handlers.js
RUN echo 'const { activatedUsers, adminUsers, downloadCounts, lastDownloadTime, subscribedUsers } = require("./storage");' >> handlers.js
RUN echo 'const { responses } = require("./config");' >> handlers.js
RUN echo '' >> handlers.js
RUN echo 'async function handleMessage(sock, text, sender, senderNumber) {' >> handlers.js
RUN echo '  // Check activation first' >> handlers.js
RUN echo '  const isActivated = await handleActivation(sock, text, sender, senderNumber, activatedUsers, adminUsers);' >> handlers.js
RUN echo '  if (isActivated) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Check if user is activated' >> handlers.js
RUN echo '  if (!activatedUsers.has(senderNumber) && !adminUsers.has(senderNumber)) {' >> handlers.js
RUN echo '    return;' >> handlers.js
RUN echo '  }' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Handle commands in order' >> handlers.js
RUN echo '  const commandsHandled = await Promise.all([' >> handlers.js
RUN echo '    handleFileDownload(sock, text, sender, senderNumber, activatedUsers, adminUsers, downloadCounts, lastDownloadTime, subscribedUsers),' >> handlers.js
RUN echo '    handleStatusCommand(sock, text, sender, senderNumber, downloadCounts, subscribedUsers, adminUsers),' >> handlers.js
RUN echo '    handleAdminCommands(sock, text, sender, senderNumber, adminUsers, subscribedUsers),' >> handlers.js
RUN echo '    handlePaymentsCommand(sock, text, sender)' >> handlers.js
RUN echo '  ]);' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // If any command was handled, return' >> handlers.js
RUN echo '  if (commandsHandled.some(handled => handled)) return;' >> handlers.js
RUN echo '' >> handlers.js
RUN echo '  // Auto-reply to any other messages (free chatting)' >> handlers.js
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
RUN echo 'module.exports = { handleMessage, responses };' >> handlers.js

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
RUN echo '  }' >> index.js
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

# Install dependencies
RUN npm install

# Start the bot
CMD ["node", "index.js"]
