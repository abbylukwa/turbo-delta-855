FROM node:22-alpine
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++ curl wget
WORKDIR /app

# Create package.json
RUN echo '{"name":"abby-bot","version":"1.0.0","main":"index.js","dependencies":{"@whiskeysockets/baileys":"^6.4.0","axios":"^1.6.0","moment":"^2.29.4"},"scripts":{"start":"node index.js"}}' > package.json

# Create the index.js file
RUN echo 'let makeWASocket = require("@whiskeysockets/baileys").default;
let { useMultiFileAuthState, generatePairingCode } = require("@whiskeysockets/baileys");
let axios = require("axios");
let fs = require("fs");
let moment = require("moment");

let ALLOWED_WEBSITES = [
  "https://pornpics.com",
  "https://HD sex movies2.com", 
  "https://xVideos.com",
  "https://PornHub.com",
  "https://xHamster.com",
  "https://XNXX.com",
  "https://YouPorn.com",
  "https://Porn.com",
  "https://Tube8.com",
  "https://PornHat.com"
];

let activatedUsers = new Set();
let adminUsers = new Set();
let downloadCounts = {};
let lastDownloadTime = {};
let pairedDevices = new Set();
let subscribedUsers = {};

async function startBot() {
  let { state, saveCreds } = await useMultiFileAuthState("auth_info");
  let sock = makeWASocket({ 
    auth: state,
    printQRInTerminal: false
  });

  try {
    let pairingCode = await generatePairingCode(sock, {
      name: "Download Bot",
      phoneNumber: ""
    });
    
    console.log("Pairing Code:", pairingCode);
  } catch (error) {
    console.error("Error generating pairing code:", error);
  }

  sock.ev.on("connection.update", (update) => {
    let { connection, lastDisconnect } = update;
    if (connection === "close") {
      console.log("Connection closed, reconnecting...");
      startBot();
    } else if (connection === "open") {
      console.log("Bot connected successfully to WhatsApp");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    let message = m.messages[0];
    if (!message.message) return;
    let text = message.message.conversation || message.message.extendedTextMessage?.text || "";
    let sender = message.key.remoteJid;
    let senderNumber = sender.split("@")[0];

    if (!pairedDevices.has(senderNumber)) {
      await sock.sendMessage(sender, { text: "Device not paired." });
      return;
    }

    if (text === "Abby0121") {
      activatedUsers.add(senderNumber);
      await sock.sendMessage(sender, { text: "Activation successful!" });
      return;
    }

    if (text === "Admin0121") {
      adminUsers.add(senderNumber);
      activatedUsers.add(senderNumber);
      await sock.sendMessage(sender, { text: "Admin activation successful!" });
      return;
    }

    if (adminUsers.has(senderNumber) && text.startsWith("pair ")) {
      let newNumber = text.replace("pair ", "").trim();
      if (newNumber.startsWith("+")) {
        pairedDevices.add(newNumber);
        await sock.sendMessage(sender, { text: `Device ${newNumber} paired successfully.` });
      } else {
        await sock.sendMessage(sender, { text: "Invalid number format." });
      }
      return;
    }

    if (adminUsers.has(senderNumber) && text.startsWith("addsub ")) {
      let parts = text.replace("addsub ", "").split(" ");
      if (parts.length >= 2) {
        let number = parts[0];
        let days = parseInt(parts[1]);
        
        if (number.startsWith("+") && !isNaN(days)) {
          let expiryDate = moment().add(days, "days").toDate();
          subscribedUsers[number] = {
            expiry: expiryDate,
            downloads: 0
          };
        }
      }
      return;
    }

    if (!activatedUsers.has(senderNumber) && !adminUsers.has(senderNumber)) {
      await sock.sendMessage(sender, { text: "Please activate first." });
      return;
    }

    let hasSubscription = subscribedUsers[senderNumber] && new Date() < new Date(subscribedUsers[senderNumber].expiry);
    
    if (text.startsWith("!download ")) {
      let url = text.replace("!download ", "");
      
      let allowed = false;
      for (let site of ALLOWED_WEBSITES) {
        if (url.includes(site)) {
          allowed = true;
          break;
        }
      }
      
      if (!allowed) {
        await sock.sendMessage(sender, { text: "This website is not allowed for downloads." });
        return;
      }
      
      let now = Date.now();
      
      if (!hasSubscription && !adminUsers.has(senderNumber)) {
        if (!downloadCounts[senderNumber]) downloadCounts[senderNumber] = 0;
        if (!lastDownloadTime[senderNumber]) lastDownloadTime[senderNumber] = 0;
        
        if (now - lastDownloadTime[senderNumber] >= 9 * 60 * 60 * 1000) {
          downloadCounts[senderNumber] = 0;
          lastDownloadTime[senderNumber] = now;
        }
        
        if (downloadCounts[senderNumber] >= 5) {
          let paymentMessage = "Download limit reached.";
          await sock.sendMessage(sender, { text: paymentMessage });
          return;
        }
        
        downloadCounts[senderNumber]++;
      }
      
      if (hasSubscription) {
        subscribedUsers[senderNumber].downloads++;
      }
      
      try {
        let result = await downloadFile(url, senderNumber);
        await sock.sendMessage(sender, { text: result });
      } catch (error) {
        await sock.sendMessage(sender, { text: "Download failed: " + error.message });
      }
      return;
    }

    if (text === "!mystatus") {
      if (hasSubscription) {
        let expiryDate = new Date(subscribedUsers[senderNumber].expiry);
        let daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        await sock.sendMessage(sender, { 
          text: `Your subscription is active.\nExpiry: ${expiryDate.toDateString()}\nDays left: ${daysLeft}\nDownloads used: ${subscribedUsers[senderNumber].downloads || 0}` 
        });
      } else if (adminUsers.has(senderNumber)) {
        await sock.sendMessage(sender, { text: "You are an admin with unlimited access." });
      } else {
        let remaining = 5 - (downloadCounts[senderNumber] || 0);
        await sock.sendMessage(sender, { 
          text: `You are on free tier.\nRemaining free downloads: ${remaining}` 
        });
      }
      return;
    }

    if (adminUsers.has(senderNumber)) {
      if (text === "!stats") {
        let activeSubs = 0;
        for (let num in subscribedUsers) {
          if (new Date() < new Date(subscribedUsers[num].expiry)) activeSubs++;
        }
        
        let stats = `Active users: ${activatedUsers.size}\nAdmin users: ${adminUsers.size}\nPaired devices: ${pairedDevices.size}\nActive subscriptions: ${activeSubs}`;
        await sock.sendMessage(sender, { text: stats });
        return;
      }
      
      if (text === "!subs") {
        let subsList = "Active Subscriptions:\n";
        for (let num in subscribedUsers) {
          if (new Date() < new Date(subscribedUsers[num].expiry)) {
            let expiry = new Date(subscribedUsers[num].expiry);
            let daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
            subsList += `${num}: Expires ${expiry.toDateString()} (${daysLeft} days left), Downloads: ${subscribedUsers[num].downloads || 0}\n`;
          }
        }
        await sock.sendMessage(sender, { text: subsList });
        return;
      }
    }

    if (text === "!payments") {
      let paymentMessage = "Payment Information:";
      await sock.sendMessage(sender, { text: paymentMessage });
      return;
    }

    if (activatedUsers.has(senderNumber)) {
      await sock.sendMessage(sender, { text: "Bot is active." });
    }
  });
}

async function downloadFile(url, senderNumber) {
  try {
    let allowed = false;
    for (let site of ALLOWED_WEBSITES) {
      if (url.includes(site)) {
        allowed = true;
        break;
      }
    }
    
    if (!allowed) {
      throw new Error("Website not allowed for downloads");
    }
    
    let timestamp = new Date().getTime();
    let filename = `downloads/${senderNumber}_${timestamp}.download`;
    
    if (!fs.existsSync("downloads")) {
      fs.mkdirSync("downloads");
    }
    
    let response = await axios({
      method: "GET",
      url: url,
      responseType: "stream"
    });
    
    let writer = fs.createWriteStream(filename);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        resolve(`Download completed: ${filename}`);
      });
      writer.on("error", reject);
    });
  } catch (error) {
    throw new Error("Download failed: " + error.message);
  }
}

console.log("Bot started");
startBot().catch(console.error);' > index.js

# Create downloads directory
RUN mkdir downloads

RUN npm install

CMD ["node", "index.js"]
