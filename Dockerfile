FROM node:22-alpine
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++ curl wget
WORKDIR /app

# Create package.json
RUN echo '{"name":"abby-bot","version":"1.0.0","main":"index.js","dependencies":{"@whiskeysockets/baileys":"^6.4.0","axios":"^1.6.0","moment":"^2.29.4"},"scripts":{"start":"node index.js"}}' > package.json

# Create the index.js file using a heredoc or multiple echo statements
RUN echo 'let makeWASocket = require("@whiskeysockets/baileys").default;' > index.js && \
    echo 'let { useMultiFileAuthState } = require("@whiskeysockets/baileys");' >> index.js && \
    echo 'let axios = require("axios");' >> index.js && \
    echo 'let fs = require("fs");' >> index.js && \
    echo 'let moment = require("moment");' >> index.js && \
    echo '' >> index.js && \
    echo 'let ALLOWED_WEBSITES = [' >> index.js && \
    echo '  "https://XNXX.com",' >> index.js && \
    echo '  "https://YouPorn.com",' >> index.js && \
    echo '  "https://Tube8.com",' >> index.js && \
    echo '  "https://PornHat.com"' >> index.js && \
    echo '];' >> index.js && \
    echo '' >> index.js && \
    echo 'let activatedUsers = new Set();' >> index.js && \
    echo 'let adminUsers = new Set();' >> index.js && \
    echo 'let downloadCounts = {};' >> index.js && \
    echo 'let lastDownloadTime = {};' >> index.js && \
    echo 'let pairedDevices = new Set();' >> index.js && \
    echo 'let subscribedUsers = {};' >> index.js && \
    echo '' >> index.js && \
    echo 'async function startBot() {' >> index.js && \
    echo '  let { state, saveCreds } = await useMultiFileAuthState("auth_info");' >> index.js && \
    echo '  let sock = makeWASocket({ ' >> index.js && \
    echo '    auth: state,' >> index.js && \
    echo '    printQRInTerminal: true' >> index.js && \
    echo '  });' >> index.js && \
    echo '' >> index.js && \
    echo '  sock.ev.on("connection.update", (update) => {' >> index.js && \
    echo '    let { connection, lastDisconnect, qr } = update;' >> index.js && \
    echo '    if (qr) {' >> index.js && \
    echo '      console.log("Scan the QR code above to connect");' >> index.js && \
    echo '    }' >> index.js && \
    echo '    if (connection === "close") {' >> index.js && \
    echo '      console.log("Connection closed, reconnecting...");' >> index.js && \
    echo '      startBot();' >> index.js && \
    echo '    } else if (connection === "open") {' >> index.js && \
    echo '      console.log("Bot connected successfully to WhatsApp");' >> index.js && \
    echo '    }' >> index.js && \
    echo '  });' >> index.js && \
    echo '' >> index.js && \
    echo '  sock.ev.on("creds.update", saveCreds);' >> index.js && \
    echo '' >> index.js && \
    echo '  sock.ev.on("messages.upsert", async (m) => {' >> index.js && \
    echo '    let message = m.messages[0];' >> index.js && \
    echo '    if (!message.message) return;' >> index.js && \
    echo '    let text = message.message.conversation || message.message.extendedTextMessage?.text || "";' >> index.js && \
    echo '    let sender = message.key.remoteJid;' >> index.js && \
    echo '    let senderNumber = sender.split("@")[0];' >> index.js && \
    echo '' >> index.js && \
    echo '    if (text === "Abby0121") {' >> index.js && \
    echo '      activatedUsers.add(senderNumber);' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: "Activation successful!" });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    if (text === "Admin0121") {' >> index.js && \
    echo '      adminUsers.add(senderNumber);' >> index.js && \
    echo '      activatedUsers.add(senderNumber);' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: "Admin activation successful!" });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    if (adminUsers.has(senderNumber) && text.startsWith("addsub ")) {' >> index.js && \
    echo '      let parts = text.replace("addsub ", "").split(" ");' >> index.js && \
    echo '      if (parts.length >= 2) {' >> index.js && \
    echo '        let number = parts[0];' >> index.js && \
    echo '        let days = parseInt(parts[1]);' >> index.js && \
    echo '        ' >> index.js && \
    echo '        if (number.startsWith("+") && !isNaN(days)) {' >> index.js && \
    echo '          let expiryDate = moment().add(days, "days").toDate();' >> index.js && \
    echo '          subscribedUsers[number] = {' >> index.js && \
    echo '            expiry: expiryDate,' >> index.js && \
    echo '            downloads: 0' >> index.js && \
    echo '          };' >> index.js && \
    echo '        }' >> index.js && \
    echo '      }' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    if (!activatedUsers.has(senderNumber) && !adminUsers.has(senderNumber)) {' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: "Please activate first." });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    let hasSubscription = subscribedUsers[senderNumber] && new Date() < new Date(subscribedUsers[senderNumber].expiry);' >> index.js && \
    echo '    ' >> index.js && \
    echo '    if (text.startsWith("!download ")) {' >> index.js && \
    echo '      let url = text.replace("!download ", "");' >> index.js && \
    echo '      ' >> index.js && \
    echo '      let allowed = false;' >> index.js && \
    echo '      for (let site of ALLOWED_WEBSITES) {' >> index.js && \
    echo '        if (url.includes(site)) {' >> index.js && \
    echo '          allowed = true;' >> index.js && \
    echo '          break;' >> index.js && \
    echo '        }' >> index.js && \
    echo '      }' >> index.js && \
    echo '      ' >> index.js && \
    echo '      if (!allowed) {' >> index.js && \
    echo '        await sock.sendMessage(sender, { text: "This website is not allowed for downloads." });' >> index.js && \
    echo '        return;' >> index.js && \
    echo '      }' >> index.js && \
    echo '      ' >> index.js && \
    echo '      let now = Date.now();' >> index.js && \
    echo '      ' >> index.js && \
    echo '      if (!hasSubscription && !adminUsers.has(senderNumber)) {' >> index.js && \
    echo '        if (!downloadCounts[senderNumber]) downloadCounts[senderNumber] = 0;' >> index.js && \
    echo '        if (!lastDownloadTime[senderNumber]) lastDownloadTime[senderNumber] = 0;' >> index.js && \
    echo '        ' >> index.js && \
    echo '        if (now - lastDownloadTime[senderNumber] >= 9 * 60 * 60 * 1000) {' >> index.js && \
    echo '          downloadCounts[senderNumber] = 0;' >> index.js && \
    echo '          lastDownloadTime[senderNumber] = now;' >> index.js && \
    echo '        }' >> index.js && \
    echo '        ' >> index.js && \
    echo '        if (downloadCounts[senderNumber] >= 5) {' >> index.js && \
    echo '          let paymentMessage = "Download limit reached.";' >> index.js && \
    echo '          await sock.sendMessage(sender, { text: paymentMessage });' >> index.js && \
    echo '          return;' >> index.js && \
    echo '        }' >> index.js && \
    echo '        ' >> index.js && \
    echo '        downloadCounts[senderNumber]++;' >> index.js && \
    echo '      }' >> index.js && \
    echo '      ' >> index.js && \
    echo '      if (hasSubscription) {' >> index.js && \
    echo '        subscribedUsers[senderNumber].downloads++;' >> index.js && \
    echo '      }' >> index.js && \
    echo '      ' >> index.js && \
    echo '      try {' >> index.js && \
    echo '        let result = await downloadFile(url, senderNumber);' >> index.js && \
    echo '        await sock.sendMessage(sender, { text: result });' >> index.js && \
    echo '      } catch (error) {' >> index.js && \
    echo '        await sock.sendMessage(sender, { text: "Download failed: " + error.message });' >> index.js && \
    echo '      }' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    if (text === "!mystatus") {' >> index.js && \
    echo '      if (hasSubscription) {' >> index.js && \
    echo '        let expiryDate = new Date(subscribedUsers[senderNumber].expiry);' >> index.js && \
    echo '        let daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));' >> index.js && \
    echo '        await sock.sendMessage(sender, { ' >> index.js && \
    echo '          text: `Your subscription is active.\\nExpiry: ${expiryDate.toDateString()}\\nDays left: ${daysLeft}\\nDownloads used: ${subscribedUsers[senderNumber].downloads || 0}` ' >> index.js && \
    echo '        });' >> index.js && \
    echo '      } else if (adminUsers.has(senderNumber)) {' >> index.js && \
    echo '        await sock.sendMessage(sender, { text: "You are an admin with unlimited access." });' >> index.js && \
    echo '      } else {' >> index.js && \
    echo '        let remaining = 5 - (downloadCounts[senderNumber] || 0);' >> index.js && \
    echo '        await sock.sendMessage(sender, { ' >> index.js && \
    echo '          text: `You are on free tier.\\nRemaining free downloads: ${remaining}` ' >> index.js && \
    echo '        });' >> index.js && \
    echo '      }' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    if (adminUsers.has(senderNumber)) {' >> index.js && \
    echo '      if (text === "!stats") {' >> index.js && \
    echo '        let activeSubs = 0;' >> index.js && \
    echo '        for (let num in subscribedUsers) {' >> index.js && \
    echo '          if (new Date() < new Date(subscribedUsers[num].expiry)) activeSubs++;' >> index.js && \
    echo '        }' >> index.js && \
    echo '        ' >> index.js && \
    echo '        let stats = `Active users: ${activatedUsers.size}\\nAdmin users: ${adminUsers.size}\\nActive subscriptions: ${activeSubs}`;' >> index.js && \
    echo '        await sock.sendMessage(sender, { text: stats });' >> index.js && \
    echo '        return;' >> index.js && \
    echo '      }' >> index.js && \
    echo '      ' >> index.js && \
    echo '      if (text === "!subs") {' >> index.js && \
    echo '        let subsList = "Active Subscriptions:\\n";' >> index.js && \
    echo '        for (let num in subscribedUsers) {' >> index.js && \
    echo '          if (new Date() < new Date(subscribedUsers[num].expiry)) {' >> index.js && \
    echo '            let expiry = new Date(subscribedUsers[num].expiry);' >> index.js && \
    echo '            let daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));' >> index.js && \
    echo '            subsList += `${num}: Expires ${expiry.toDateString()} (${daysLeft} days left), Downloads: ${subscribedUsers[num].downloads || 0}\\n`;' >> index.js && \
    echo '          }' >> index.js && \
    echo '        }' >> index.js && \
    echo '        await sock.sendMessage(sender, { text: subsList });' >> index.js && \
    echo '        return;' >> index.js && \
    echo '      }' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    if (text === "!payments") {' >> index.js && \
    echo '      let paymentMessage = "Payment Information:";' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: paymentMessage });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    if (activatedUsers.has(senderNumber)) {' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: "Bot is active." });' >> index.js && \
    echo '    }' >> index.js && \
    echo '  });' >> index.js && \
    echo '}' >> index.js && \
    echo '' >> index.js && \
    echo 'async function downloadFile(url, senderNumber) {' >> index.js && \
    echo '  try {' >> index.js && \
    echo '    let allowed = false;' >> index.js && \
    echo '    for (let site of ALLOWED_WEBSITES) {' >> index.js && \
    echo '      if (url.includes(site)) {' >> index.js && \
    echo '        allowed = true;' >> index.js && \
    echo '        break;' >> index.js && \
    echo '      }' >> index.js && \
    echo '    }' >> index.js && \
    echo '    ' >> index.js && \
    echo '    if (!allowed) {' >> index.js && \
    echo '      throw new Error("Website not allowed for downloads");' >> index.js && \
    echo '    }' >> index.js && \
    echo '    ' >> index.js && \
    echo '    let timestamp = new Date().getTime();' >> index.js && \
    echo '    let filename = `downloads/${senderNumber}_${timestamp}.download`;' >> index.js && \
    echo '    ' >> index.js && \
    echo '    if (!fs.existsSync("downloads")) {' >> index.js && \
    echo '      fs.mkdirSync("downloads");' >> index.js && \
    echo '    }' >> index.js && \
    echo '    ' >> index.js && \
    echo '    let response = await axios({' >> index.js && \
    echo '      method: "GET",' >> index.js && \
    echo '      url: url,' >> index.js && \
    echo '      responseType: "stream"' >> index.js && \
    echo '    });' >> index.js && \
    echo '    ' >> index.js && \
    echo '    let writer = fs.createWriteStream(filename);' >> index.js && \
    echo '    response.data.pipe(writer);' >> index.js && \
    echo '    ' >> index.js && \
    echo '    return new Promise((resolve, reject) => {' >> index.js && \
    echo '      writer.on("finish", () => {' >> index.js && \
    echo '        resolve(`Download completed: ${filename}`);' >> index.js && \
    echo '      });' >> index.js && \
    echo '      writer.on("error", reject);' >> index.js && \
    echo '    });' >> index.js && \
    echo '  } catch (error) {' >> index.js && \
    echo '    throw new Error("Download failed: " + error.message);' >> index.js && \
    echo '  }' >> index.js && \
    echo '}' >> index.js && \
    echo '' >> index.js && \
    echo 'console.log("Bot started");' >> index.js && \
    echo 'startBot().catch(console.error);' >> index.js

# Create downloads directory
RUN mkdir downloads

RUN npm install

CMD ["node", "index.js"]
