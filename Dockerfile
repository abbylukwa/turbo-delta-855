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

# Create index.js in multiple steps to avoid line length issues
RUN echo 'const makeWASocket = require("@whiskeysockets/baileys").default;' > index.js
RUN echo 'const { useMultiFileAuthState } = require("@whiskeysockets/baileys");' >> index.js
RUN echo 'const qrcode = require("qrcode-terminal");' >> index.js
RUN echo 'const axios = require("axios");' >> index.js
RUN echo 'const fs = require("fs");' >> index.js
RUN echo 'const moment = require("moment");' >> index.js
RUN echo '' >> index.js
RUN echo 'const SEARCH_WEBSITES = [' >> index.js
RUN echo '  "https://WonPorn.com/search?q=",' >> index.js
RUN echo '  "https://PornPics.com/search?query=",' >> index.js
RUN echo '  "https://PornHub.com/find?q="' >> index.js
RUN echo '];' >> index.js

# Continue adding the rest of the JavaScript code in smaller chunks
RUN echo '' >> index.js
RUN echo 'let activatedUsers = new Set();' >> index.js
RUN echo 'let adminUsers = new Set();' >> index.js
RUN echo 'let downloadCounts = {};' >> index.js
RUN echo 'let lastDownloadTime = {};' >> index.js
RUN echo 'let subscribedUsers = {};' >> index.js

# Add the rest of the JavaScript file in smaller chunks
RUN echo '// Responses' >> index.js
RUN echo 'const responses = {' >> index.js
RUN echo '  welcome: "Welcome to Abby'\''s Bot! 🤖\\n\\nAvailable commands:\\n• Send any filename to search and download\\n• !mystatus - Check your download status\\n• !payments - Payment information\\n\\nChatting is free, downloads have limits based on your subscription.",' >> index.js
RUN echo '  activation: "Activation successful! Welcome to Abby'\''s Bot. 🤖",' >> index.js
RUN echo '  adminActivation: "Admin activation successful! Welcome to Abby'\''s Bot. 🤖",' >> index.js
RUN echo '  notActivated: "Please activate first by sending: Abby0121",' >> index.js
RUN echo '  searchStarted: "🔍 Searching for your file across multiple websites...",' >> index.js
RUN echo '  downloadLimit: "Download limit reached. Please subscribe for unlimited downloads.",' >> index.js
RUN echo '  downloadSuccess: "Download completed successfully! 🎉",' >> index.js
RUN echo '  downloadFailed: "Download failed. Please try another file.",' >> index.js
RUN echo '  fileNotFound: "File not found on any of our supported websites.",' >> index.js
RUN echo '  paymentInfo: "📧 Payment Information:\\n\\nFor unlimited downloads, please contact the admin for subscription details.\\n\\nYou can send: !payments to see this information again."' >> index.js
RUN echo '};' >> index.js

# Continue with the rest of the code...
RUN echo '' >> index.js
RUN echo 'async function startBot() {' >> index.js
RUN echo '  const { state, saveCreds } = await useMultiFileAuthState("auth_info");' >> index.js
RUN echo '  const sock = makeWASocket({ ' >> index.js
RUN echo '    auth: state,' >> index.js
RUN echo '    printQRInTerminal: false' >> index.js
RUN echo '  });' >> index.js
RUN echo '' >> index.js
RUN echo '  sock.ev.on("connection.update", (update) => {' >> index.js
RUN echo '    const { connection, lastDisconnect, qr } = update;' >> index.js
RUN echo '    if (qr) {' >> index.js
RUN echo '      console.log("Scan the QR code below to connect:");' >> index.js
RUN echo '      qrcode.generate(qr, { small: true });' >> index.js
RUN echo '    }' >> index.js
RUN echo '    if (connection === "close") {' >> index.js
RUN echo '      console.log("Connection closed, reconnecting...");' >> index.js
RUN echo '      startBot();' >> index.js
RUN echo '    } else if (connection === "open") {' >> index.js
RUN echo '      console.log("Bot connected successfully to WhatsApp");' >> index.js
RUN echo '    }' >> index.js
RUN echo '  });' >> index.js
RUN echo '' >> index.js
RUN echo '  sock.ev.on("creds.update", saveCreds);' >> index.js
RUN echo '' >> index.js
RUN echo '  sock.ev.on("messages.upsert", async (m) => {' >> index.js
RUN echo '    const message = m.messages[0];' >> index.js
RUN echo '    if (!message.message) return;' >> index.js
RUN echo '    const text = message.message.conversation || message.message.extendedTextMessage?.text || "";' >> index.js
RUN echo '    const sender = message.key.remoteJid;' >> index.js
RUN echo '    const senderNumber = sender.split("@")[0];' >> index.js
RUN echo '' >> index.js
RUN echo '    // Activation commands' >> index.js
RUN echo '    if (text === "Abby0121") {' >> index.js
RUN echo '      activatedUsers.add(senderNumber);' >> index.js
RUN echo '      await sock.sendMessage(sender, { text: responses.activation });' >> index.js
RUN echo '      await sock.sendMessage(sender, { text: responses.welcome });' >> index.js
RUN echo '      return;' >> index.js
RUN echo '    }' >> index.js
RUN echo '' >> index.js
RUN echo '    if (text === "Admin0121") {' >> index.js
RUN echo '      adminUsers.add(senderNumber);' >> index.js
RUN echo '      activatedUsers.add(senderNumber);' >> index.js
RUN echo '      await sock.sendMessage(sender, { text: responses.adminActivation });' >> index.js
RUN echo '      await sock.sendMessage(sender, { text: responses.welcome });' >> index.js
RUN echo '      return;' >> index.js
RUN echo '    }' >> index.js
RUN echo '' >> index.js
RUN echo '    // Check if user is activated - if not, ignore all messages except activation codes' >> index.js
RUN echo '    if (!activatedUsers.has(senderNumber) && !adminUsers.has(senderNumber)) {' >> index.js
RUN echo '      // Only respond to activation requests, ignore all other messages' >> index.js
RUN echo '      return;' >> index.js
RUN echo '    }' >> index.js
RUN echo '' >> index.js
RUN echo '    // Admin subscription management' >> index.js
RUN echo '    if (adminUsers.has(senderNumber) && text.startsWith("addsub ")) {' >> index.js
RUN echo '      const parts = text.replace("addsub ", "").split(" ");' >> index.js
RUN echo '      if (parts.length >= 2) {' >> index.js
RUN echo '        const number = parts[0];' >> index.js
RUN echo '        const days = parseInt(parts[1]);' >> index.js
RUN echo '        ' >> index.js
RUN echo '        if (number.startsWith("+") && !isNaN(days)) {' >> index.js
RUN echo '          const expiryDate = moment().add(days, "days").toDate();' >> index.js
RUN echo '          subscribedUsers[number] = {' >> index.js
RUN echo '            expiry: expiryDate,' >> index.js
RUN echo '            downloads: 0' >> index.js
RUN echo '          };' >> index.js
RUN echo '          await sock.sendMessage(sender, { text: `Subscription added for ${number} for ${days} days` });' >> index.js
RUN echo '        }' >> index.js
RUN echo '      }' >> index.js
RUN echo '      return;' >> index.js
RUN echo '    }' >> index.js
RUN echo '' >> index.js
RUN echo '    const hasSubscription = subscribedUsers[senderNumber] && new Date() < new Date(subscribedUsers[senderNumber].expiry);' >> index.js
RUN echo '    ' >> index.js
RUN echo '    // File search and download - triggered by any message that is not a command' >> index.js
RUN echo '    if (!text.startsWith("!") && text.length > 2) {' >> index.js
RUN echo '      await sock.sendMessage(sender, { text: responses.searchStarted });' >> index.js
RUN echo '      ' >> index.js
RUN echo '      const now = Date.now();' >> index.js
RUN echo '      ' >> index.js
RUN echo '      // Check download limits for non-subscribed, non-admin users' >> index.js
RUN echo '      if (!hasSubscription && !adminUsers.has(senderNumber)) {' >> index.js
RUN echo '        if (!downloadCounts[senderNumber]) downloadCounts[senderNumber] = 0;' >> index.js
RUN echo '        if (!lastDownloadTime[senderNumber]) lastDownloadTime[senderNumber] = 0;' >> index.js
RUN echo '        ' >> index.js
RUN echo '        if (now - lastDownloadTime[senderNumber] >= 9 * 60 * 60 * 1000) {' >> index.js
RUN echo '          downloadCounts[senderNumber] = 0;' >> index.js
RUN echo '          lastDownloadTime[senderNumber] = now;' >> index.js
RUN echo '        }' >> index.js
RUN echo '        ' >> index.js
RUN echo '        if (downloadCounts[senderNumber] >= 5) {' >> index.js
RUN echo '          await sock.sendMessage(sender, { text: responses.downloadLimit });' >> index.js
RUN echo '          return;' >> index.js
RUN echo '        }' >> index.js
RUN echo '        ' >> index.js
RUN echo '        downloadCounts[senderNumber]++;' >> index.js
RUN echo '        ' >> index.js
RUN echo '        // Send payment info after the 3rd download' >> index.js
RUN echo '        if (downloadCounts[senderNumber] === 3) {' >> index.js
RUN echo '          await sock.sendMessage(sender, { text: responses.paymentInfo });' >> index.js
RUN echo '        }' >> index.js
RUN echo '      }' >> index.js
RUN echo '      ' >> index.js
RUN echo '      if (hasSubscription) {' >> index.js
RUN echo '        subscribedUsers[senderNumber].downloads++;' >> index.js
RUN echo '      }' >> index.js
RUN echo '      ' >> index.js
RUN echo '      try {' >> index.js
RUN echo '        // Search for the file across websites' >> index.js
RUN echo '        const result = await searchAndDownloadFile(text, senderNumber);' >> index.js
RUN echo '        if (result.success) {' >> index.js
RUN echo '          await sock.sendMessage(sender, { text: responses.downloadSuccess });' >> index.js
RUN echo '        } else {' >> index.js
RUN echo '          await sock.sendMessage(sender, { text: responses.fileNotFound });' >> index.js
RUN echo '        }' >> index.js
RUN echo '      } catch (error) {' >> index.js
RUN echo '        await sock.sendMessage(sender, { text: responses.downloadFailed });' >> index.js
RUN echo '      }' >> index.js
RUN echo '      return;' >> index.js
RUN echo '    }' >> index.js
RUN echo '' >> index.js
RUN echo '    // Status command' >> index.js
RUN echo '    if (text === "!mystatus") {' >> index.js
RUN echo '      if (hasSubscription) {' >> index.js
RUN echo '        const expiryDate = new Date(subscribedUsers[senderNumber].expiry);' >> index.js
RUN echo '        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));' >> index.js
RUN echo '        await sock.sendMessage(sender, { ' >> index.js
RUN echo '          text: `Your subscription is active.\\nExpiry: ${expiryDate.toDateString()}\\nDays left: ${daysLeft}\\nDownloads used: ${subscribedUsers[senderNumber].downloads || 0}` ' >> index.js
RUN echo '        });' >> index.js
RUN echo '      } else if (adminUsers.has(senderNumber)) {' >> index.js
RUN echo '        await sock.sendMessage(sender, { text: "You are an admin with unlimited access." });' >> index.js
RUN echo '      } else {' >> index.js
RUN echo '        const remaining = 5 - (downloadCounts[senderNumber] || 0);' >> index.js
RUN echo '        await sock.sendMessage(sender, { ' >> index.js
RUN echo '          text: `You are on free tier.\\nRemaining free downloads: ${remaining}` ' >> index.js
RUN echo '        });' >> index.js
RUN echo '      }' >> index.js
RUN echo '      return;' >> index.js
RUN echo '    }' >> index.js
RUN echo '' >> index.js
RUN echo '    // Admin stats command' >> index.js
RUN echo '    if (adminUsers.has(senderNumber) && text === "!stats") {' >> index.js
RUN echo '      let activeSubs = 0;' >> index.js
RUN echo '      for (const num in subscribedUsers) {' >> index.js
RUN echo '        if (new Date() < new Date(subscribedUsers[num].expiry)) activeSubs++;' >> index.js
RUN echo '      }' >> index.js
RUN echo '      ' >> index.js
RUN echo '      const stats = `Active users: ${activatedUsers.size}\\nAdmin users: ${adminUsers.size}\\nActive subscriptions: ${activeSubs}`;' >> index.js
RUN echo '      await sock.sendMessage(sender, { text: stats });' >> index.js
RUN echo '      return;' >> index.js
RUN echo '    }' >> index.js
RUN echo '' >> index.js
RUN echo '    // Admin subscriptions list command' >> index.js
RUN echo '    if (adminUsers.has(senderNumber) && text === "!subs") {' >> index.js
RUN echo '      let subsList = "Active Subscriptions:\\n";' >> index.js
RUN echo '      for (const num in subscribedUsers) {' >> index.js
RUN echo '        if (new Date() < new Date(subscribedUsers[num].expiry)) {' >> index.js
RUN echo '          const expiry = new Date(subscribedUsers[num].expiry);' >> index.js
RUN echo '          const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));' >> index.js
RUN echo '          subsList += `${num}: Expires ${expiry.toDateString()} (${daysLeft} days left), Downloads: ${subscribedUsers[num].downloads || 0}\\n`;' >> index.js
RUN echo '        }' >> index.js
RUN echo '      }' >> index.js
RUN echo '      await sock.sendMessage(sender, { text: subsList });' >> index.js
RUN echo '      return;' >> index.js
RUN echo '    }' >> index.js
RUN echo '' >> index.js
RUN echo '    // Payments command' >> index.js
RUN echo '    if (text === "!payments") {' >> index.js
RUN echo '      await sock.sendMessage(sender, { text: responses.paymentInfo });' >> index.js
RUN echo '      return;' >> index.js
RUN echo '    }' >> index.js
RUN echo '' >> index.js
RUN echo '    // Auto-reply to any other messages (free chatting)' >> index.js
RUN echo '    if (text.length > 1) {' >> index.js
RUN echo '      // Simple auto-reply for chatting' >> index.js
RUN echo '      const replies = [' >> index.js
RUN echo '        "I'\''m here to help you find files!",' >> index.js
RUN echo '        "You can send me any filename to search.",' >> index.js
RUN echo '        "Need help finding something?"' >> index.js
RUN echo '      ];' >> index.js
RUN echo '      ' >> index.js
RUN echo '      const randomReply = replies[Math.floor(Math.random() * replies.length)];' >> index.js
RUN echo '      await sock.sendMessage(sender, { text: randomReply });' >> index.js
RUN echo '    }' >> index.js
RUN echo '  });' >> index.js
RUN echo '}' >> index.js
RUN echo '' >> index.js
RUN echo 'async function searchAndDownloadFile(filename, senderNumber) {' >> index.js
RUN echo '  try {' >> index.js
RUN echo '    // Randomly select a website to search from' >> index.js
RUN echo '    const randomSite = SEARCH_WEBSITES[Math.floor(Math.random() * SEARCH_WEBSITES.length)];' >> index.js
RUN echo '    const searchUrl = randomSite + encodeURIComponent(filename);' >> index.js
RUN echo '    ' >> index.js
RUN echo '    // In a real implementation, you would parse the search results and find a download link' >> index.js
RUN echo '    // For this example, we'\''ll simulate a successful search and download' >> index.js
RUN echo '    ' >> index.js
RUN echo '    const timestamp = new Date().getTime();' >> index.js
RUN echo '    const downloadFilename = `downloads/${senderNumber}_${timestamp}_${filename.replace(/[^a-zA-Z0-9]/g, "_")}.download`;' >> index.js
RUN echo '    ' >> index.js
RUN echo '    if (!fs.existsSync("downloads")) {' >> index.js
RUN echo '      fs.mkdirSync("downloads");' >> index.js
RUN echo '    }' >> index.js
RUN echo '    ' >> index.js
RUN echo '    // Simulate download process (in real implementation, use axios to download actual file)' >> index.js
RUN echo '    return new Promise((resolve) => {' >> index.js
RUN echo '      setTimeout(() => {' >> index.js
RUN echo '        // Create a dummy file to simulate download' >> index.js
RUN echo '        fs.writeFileSync(downloadFilename, `Simulated download of ${filename} from ${randomSite}`);' >> index.js
RUN echo '        resolve({ success: true, filename: downloadFilename });' >> index.js
RUN echo '      }, 2000); // Simulate 2 second download time' >> index.js
RUN echo '    });' >> index.js
RUN echo '  } catch (error) {' >> index.js
RUN echo '    return { success: false, error: error.message };' >> index.js
RUN echo '  }' >> index.js
RUN echo '}' >> index.js
RUN echo '' >> index.js
RUN echo 'console.log("Bot started");' >> index.js
RUN echo 'startBot().catch(console.error);' >> index.js

# Create downloads directory with proper permissions
RUN mkdir -p downloads && chmod 755 downloads

# Install dependencies
RUN npm install

# Start the bot
CMD ["node", "index.js"]
