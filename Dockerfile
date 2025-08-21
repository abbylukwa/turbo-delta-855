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
RUN echo '  "https://MzanziFun.com/search?q=",' >> index.js
RUN echo '  "https://PornPics.com/search?q=",' >> index.js
RUN echo '  "https://PornDude.com/search?q=",' >> index.js
RUN echo '  "https://PornHub.com/search?q="' >> index.js
RUN echo '];' >> index.js

# Continue adding the rest of the JavaScript code in smaller chunks
RUN echo '' >> index.js
RUN echo 'let activatedUsers = new Set();' >> index.js
RUN echo 'let adminUsers = new Set();' >> index.js
RUN echo 'let downloadCounts = {};' >> index.js
RUN echo 'let lastDownloadTime = {};' >> index.js
RUN echo 'let subscribedUsers = {};' >> index.js

# Add the rest of the JavaScript file
COPY <<EOF >> index.js


async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const sock = makeWASocket({ 
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log("Scan the QR code below to connect:");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "close") {
      console.log("Connection closed, reconnecting...");
      startBot();
    } else if (connection === "open") {
      console.log("Bot connected successfully to WhatsApp");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    const message = m.messages[0];
    if (!message.message) return;
    const text = message.message.conversation || message.message.extendedTextMessage?.text || "";
    const sender = message.key.remoteJid;
    const senderNumber = sender.split("@")[0];

    // Activation commands
    if (text === "Abby0121") {
      activatedUsers.add(senderNumber);
      await sock.sendMessage(sender, { text: responses.activation });
      await sock.sendMessage(sender, { text: responses.welcome });
      return;
    }

    if (text === "Admin0121") {
      adminUsers.add(senderNumber);
      activatedUsers.add(senderNumber);
      await sock.sendMessage(sender, { text: responses.adminActivation });
      await sock.sendMessage(sender, { text: responses.welcome });
      return;
    }

    // Check if user is activated
    if (!activatedUsers.has(senderNumber) && !adminUsers.has(senderNumber)) {
      await sock.sendMessage(sender, { text: responses.notActivated });
      return;
    }

    // Admin subscription management
    if (adminUsers.has(senderNumber) && text.startsWith("addsub ")) {
      const parts = text.replace("addsub ", "").split(" ");
      if (parts.length >= 2) {
        const number = parts[0];
        const days = parseInt(parts[1]);
        
        if (number.startsWith("+") && !isNaN(days)) {
          const expiryDate = moment().add(days, "days").toDate();
          subscribedUsers[number] = {
            expiry: expiryDate,
            downloads: 0
          };
          await sock.sendMessage(sender, { text: `Subscription added for ${number} for ${days} days` });
        }
      }
      return;
    }

    const hasSubscription = subscribedUsers[senderNumber] && new Date() < new Date(subscribedUsers[senderNumber].expiry);
    
    // File search and download - triggered by any message that is not a command
    if (!text.startsWith("!") && text.length > 2) {
      await sock.sendMessage(sender, { text: responses.searchStarted });
      
      const now = Date.now();
      
      // Check download limits for non-subscribed, non-admin users
      if (!hasSubscription && !adminUsers.has(senderNumber)) {
        if (!downloadCounts[senderNumber]) downloadCounts[senderNumber] = 0;
        if (!lastDownloadTime[senderNumber]) lastDownloadTime[senderNumber] = 0;
        
        if (now - lastDownloadTime[senderNumber] >= 9 * 60 * 60 * 1000) {
          downloadCounts[senderNumber] = 0;
          lastDownloadTime[senderNumber] = now;
        }
        
        if (downloadCounts[senderNumber] >= 5) {
          await sock.sendMessage(sender, { text: responses.downloadLimit });
          return;
        }
        
        downloadCounts[senderNumber]++;
      }
      
      if (hasSubscription) {
        subscribedUsers[senderNumber].downloads++;
      }
      
      try {
        // Search for the file across websites
        const result = await searchAndDownloadFile(text, senderNumber);
        if (result.success) {
          await sock.sendMessage(sender, { text: responses.downloadSuccess });
        } else {
          await sock.sendMessage(sender, { text: responses.fileNotFound });
        }
      } catch (error) {
        await sock.sendMessage(sender, { text: responses.downloadFailed });
      }
      return;
    }

    // Status command
    if (text === "!mystatus") {
      if (hasSubscription) {
        const expiryDate = new Date(subscribedUsers[senderNumber].expiry);
        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        await sock.sendMessage(sender, { 
          text: `Your subscription is active.\\nExpiry: ${expiryDate.toDateString()}\\nDays left: ${daysLeft}\\nDownloads used: ${subscribedUsers[senderNumber].downloads || 0}` 
        });
      } else if (adminUsers.has(senderNumber)) {
        await sock.sendMessage(sender, { text: "You are an admin with unlimited access." });
      } else {
        const remaining = 5 - (downloadCounts[senderNumber] || 0);
        await sock.sendMessage(sender, { 
          text: `You are on free tier.\\nRemaining free downloads: ${remaining}` 
        });
      }
      return;
    }

    // Admin stats command
    if (adminUsers.has(senderNumber) && text === "!stats") {
      let activeSubs = 0;
      for (const num in subscribedUsers) {
        if (new Date() < new Date(subscribedUsers[num].expiry)) activeSubs++;
      }
      
      const stats = `Active users: ${activatedUsers.size}\\nAdmin users: ${adminUsers.size}\\nActive subscriptions: ${activeSubs}`;
      await sock.sendMessage(sender, { text: stats });
      return;
    }

    // Admin subscriptions list command
    if (adminUsers.has(senderNumber) && text === "!subs") {
      let subsList = "Active Subscriptions:\\n";
      for (const num in subscribedUsers) {
        if (new Date() < new Date(subscribedUsers[num].expiry)) {
          const expiry = new Date(subscribedUsers[num].expiry);
          const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
          subsList += `${num}: Expires ${expiry.toDateString()} (${daysLeft} days left), Downloads: ${subscribedUsers[num].downloads || 0}\\n`;
        }
      }
      await sock.sendMessage(sender, { text: subsList });
      return;
    }

    // Payments command
    if (text === "!payments") {
      const paymentMessage = "Payment Information: Contact admin for subscription details.";
      await sock.sendMessage(sender, { text: paymentMessage });
      return;
    }

    // Auto-reply to any other messages (free chatting)
    if (activatedUsers.has(senderNumber) && text.length > 1) {
      // Simple auto-reply for chatting
      const replies = [
        "I'm here to help you find files!",
        "You can send me any filename to search.",
        "Need help finding something?"
      ];
      
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      await sock.sendMessage(sender, { text: randomReply });
    }
  });
}

async function searchAndDownloadFile(filename, senderNumber) {
  try {
    // Randomly select a website to search from
    const randomSite = SEARCH_WEBSITES[Math.floor(Math.random() * SEARCH_WEBSITES.length)];
    const searchUrl = randomSite + encodeURIComponent(filename);
    
    // In a real implementation, you would parse the search results and find a download link
    // For this example, we'll simulate a successful search and download
    
    const timestamp = new Date().getTime();
    const downloadFilename = `downloads/${senderNumber}_${timestamp}_${filename.replace(/[^a-zA-Z0-9]/g, "_")}.download`;
    
    if (!fs.existsSync("downloads")) {
      fs.mkdirSync("downloads");
    }
    
    // Simulate download process (in real implementation, use axios to download actual file)
    return new Promise((resolve) => {
      setTimeout(() => {
        // Create a dummy file to simulate download
        fs.writeFileSync(downloadFilename, `Simulated download of ${filename} from ${randomSite}`);
        resolve({ success: true, filename: downloadFilename });
      }, 2000); // Simulate 2 second download time
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

console.log("Bot started");
startBot().catch(console.error);
EOF

# Create downloads directory
RUN mkdir downloads

# Install dependencies
RUN npm install

# Start the bot
CMD ["node", "index.js"]
