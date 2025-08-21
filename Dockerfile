FROM node:22-alpine
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++ curl wget
WORKDIR /app
ENV TZ=Africa/Harare
ENV BOT_NAME=Abby
ENV MAIN_DEVICE=+263717457592


RUN echo '{"name":"abby-bot","version":"1.0.0","main":"index.js","dependencies":{"@whiskeysockets/baileys":"^6.4.0","axios":"^1.6.0","moment":"^2.29.4"},"scripts":{"start":"node index.js"}}' > package.json


RUN echo 'const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, generatePairingCode } = require("@whiskeysockets/baileys");
const axios = require("axios");
const fs = require("fs");
const moment = require("moment");

const ALLOWED_WEBSITES = [
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
let subscribedUsers = {}; // { number: { expiry: Date, downloads: number } }

pairedDevices.add("+263717457592");
adminUsers.add("+263717457592");


const paymentInfo = {
  zimbabwe: {
    number: "0777627210",
    methods: ["EcoCash", "innbucks"]
  },
  southAfrica: {
    number: "+27614159817", 
    methods: ["CashApp", "PayPal", "Bank Transfer", "ZAR Mobile Money"]
  },
  charges: {
    "10_days": { price: 3, currency: "USD", days: 10 },
    "2_days": { price: 1, currency: "USD", days: 2 },
    "1_day": { price: 0.5, currency: "USD", days: 1 }
  }
};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const sock = makeWASocket({ 
    auth: state,
    printQRInTerminal: false // Disable QR code generation
  });

  
  try {
    const pairingCode = await generatePairingCode(sock, {
      name: "Abby Download Bot",
      phoneNumber: "+263717457592"
    });
    
    console.log("Pairing Code:", pairingCode);
    console.log("To pair with WhatsApp:");
    console.log("1. Open WhatsApp on your phone");
    console.log("2. Go to Linked Devices > Link a Device");
    console.log("3. Enter this code:", pairingCode);
  } catch (error) {
    console.error("Error generating pairing code:", error);
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
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

    if (!pairedDevices.has(senderNumber)) {
      await sock.sendMessage(sender, { text: "Device not paired. Contact main device +263717457592 for pairing code." });
      return;
    }

    if (text === "Abby0121") {
      activatedUsers.add(senderNumber);
      await sock.sendMessage(sender, { text: "Activation successful! You can now use the bot. Commands: !download [url]\nYou have 5 free downloads. After that, subscription is required." });
      return;
    }

    if (text === "Admin0121") {
      adminUsers.add(senderNumber);
      activatedUsers.add(senderNumber);
      await sock.sendMessage(sender, { text: "Admin activation successful! Full access granted." });
      return;
    }

    if (adminUsers.has(senderNumber) && text.startsWith("pair ")) {
      const newNumber = text.replace("pair ", "").trim();
      if (newNumber.startsWith("+")) {
        pairedDevices.add(newNumber);
        await sock.sendMessage(sender, { text: `Device ${newNumber} paired successfully.` });
        await sock.sendMessage(`${newNumber}@s.whatsapp.net`, { text: "Your device has been paired. Send Abby0121 to activate." });
      } else {
        await sock.sendMessage(sender, { text: "Invalid number format. Use: pair +1234567890" });
      }
      return;
    }

    
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
          
          await sock.sendMessage(sender, { text: `Subscription added for ${number} for ${days} days. Expiry: ${expiryDate.toDateString()}` });
          
          
          if (pairedDevices.has(number)) {
            await sock.sendMessage(`${number}@s.whatsapp.net`, { 
              text: `Your subscription has been activated for ${days} days. You can now download files using !download [url]` 
            });
          }
        } else {
          await sock.sendMessage(sender, { text: "Invalid format. Use: addsub +1234567890 10" });
        }
      } else {
        await sock.sendMessage(sender, { text: "Invalid format. Use: addsub +1234567890 10" });
      }
      return;
    }

    if (!activatedUsers.has(senderNumber) && !adminUsers.has(senderNumber)) {
      await sock.sendMessage(sender, { text: "Please activate first by sending: Abby0121" });
      return;
    }

    
    const hasSubscription = subscribedUsers[senderNumber] && new Date() < new Date(subscribedUsers[senderNumber].expiry);
    
    if (text.startsWith("!download ")) {
      const url = text.replace("!download ", "");
      
      
      let allowed = false;
      for (const site of ALLOWED_WEBSITES) {
        if (url.includes(site)) {
          allowed = true;
          break;
        }
      }
      
      if (!allowed) {
        await sock.sendMessage(sender, { text: "This website is not allowed for downloads." });
        return;
      }
      
      const now = Date.now();
      
      
      if (!hasSubscription && !adminUsers.has(senderNumber)) {
        if (!downloadCounts[senderNumber]) downloadCounts[senderNumber] = 0;
        if (!lastDownloadTime[senderNumber]) lastDownloadTime[senderNumber] = 0;
        
        if (now - lastDownloadTime[senderNumber] >= 9 * 60 * 60 * 1000) {
          downloadCounts[senderNumber] = 0;
          lastDownloadTime[senderNumber] = now;
        }
        
        if (downloadCounts[senderNumber] >= 5) {
          let paymentMessage = "Download limit reached. To continue downloading, please subscribe:\n\n";
          paymentMessage += "Subscription Options:\n";
          paymentMessage += "1. 10 days - 3 USD\n";
          paymentMessage += "2. 2 days - 1 USD\n";
          paymentMessage += "3. 1 day - 0.5 USD\n\n";
          
          paymentMessage += "For Zimbabwe, send payment to " + paymentInfo.zimbabwe.number + " via: " + 
                            paymentInfo.zimbabwe.methods.join(", ") + "\n";
          paymentMessage += "For South Africa, send payment to " + paymentInfo.southAfrica.number + " via: " + 
                            paymentInfo.southAfrica.methods.join(", ") + "\n\n";
          paymentMessage += "After payment, send your number to the admin for activation.";
          
          await sock.sendMessage(sender, { text: paymentMessage });
          return;
        }
        
        downloadCounts[senderNumber]++;
      }
      
      
      if (hasSubscription) {
        subscribedUsers[senderNumber].downloads++;
      }
      
      try {
        const result = await downloadFile(url, senderNumber);
        await sock.sendMessage(sender, { text: result });
      } catch (error) {
        await sock.sendMessage(sender, { text: "Download failed: " + error.message });
      }
      return;
    }

    if (text === "!mystatus") {
      if (hasSubscription) {
        const expiryDate = new Date(subscribedUsers[senderNumber].expiry);
        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        await sock.sendMessage(sender, { 
          text: `Your subscription is active.\nExpiry: ${expiryDate.toDateString()}\nDays left: ${daysLeft}\nDownloads used: ${subscribedUsers[senderNumber].downloads || 0}` 
        });
      } else if (adminUsers.has(senderNumber)) {
        await sock.sendMessage(sender, { text: "You are an admin with unlimited access." });
      } else {
        const remaining = 5 - (downloadCounts[senderNumber] || 0);
        await sock.sendMessage(sender, { 
          text: `You are on free tier.\nRemaining free downloads: ${remaining}\nSubscribe for uninterrupted access.` 
        });
      }
      return;
    }

    if (adminUsers.has(senderNumber)) {
      if (text === "!stats") {
        let activeSubs = 0;
        for (const num in subscribedUsers) {
          if (new Date() < new Date(subscribedUsers[num].expiry)) activeSubs++;
        }
        
        const stats = `Active users: ${activatedUsers.size}\nAdmin users: ${adminUsers.size}\nPaired devices: ${pairedDevices.size}\nActive subscriptions: ${activeSubs}`;
        await sock.sendMessage(sender, { text: stats });
        return;
      }
      
      if (text === "!subs") {
        let subsList = "Active Subscriptions:\n";
        for (const num in subscribedUsers) {
          if (new Date() < new Date(subscribedUsers[num].expiry)) {
            const expiry = new Date(subscribedUsers[num].expiry);
            const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
            subsList += `${num}: Expires ${expiry.toDateString()} (${daysLeft} days left), Downloads: ${subscribedUsers[num].downloads || 0}\n`;
          }
        }
        await sock.sendMessage(sender, { text: subsList });
        return;
      }
    }

    if (text === "!payments") {
      let paymentMessage = "Payment Information:\n\n";
      paymentMessage += "Subscription Options:\n";
      paymentMessage += "1. 10 days - 3 USD\n";
      paymentMessage += "2. 2 days - 1 USD\n";
      paymentMessage += "3. 1 day - 0.5 USD\n\n";
      
      paymentMessage += "For Zimbabwe, send payment to " + paymentInfo.zimbabwe.number + " via: " + 
                        paymentInfo.zimbabwe.methods.join(", ") + "\n";
      paymentMessage += "For South Africa, send payment to " + paymentInfo.southAfrica.number + " via: " + 
                        paymentInfo.southAfrica.methods.join(", ") + "\n\n";
      paymentMessage += "After payment, send your number to the admin for activation.";
      
      await sock.sendMessage(sender, { text: paymentMessage });
      return;
    }

    if (activatedUsers.has(senderNumber)) {
      await sock.sendMessage(sender, { text: "Bot is active. Commands:\n!download [url] - Download file\n!mystatus - Check your status\n!payments - Payment information" });
    }
  });
}

async function downloadFile(url, senderNumber) {
  try {
    
    let allowed = false;
    for (const site of ALLOWED_WEBSITES) {
      if (url.includes(site)) {
        allowed = true;
        break;
      }
    }
    
    if (!allowed) {
      throw new Error("Website not allowed for downloads");
    }
    
    
    const timestamp = new Date().getTime();
    const filename = `downloads/${senderNumber}_${timestamp}.download`;
    
    
    if (!fs.existsSync("downloads")) {
      fs.mkdirSync("downloads");
    }
    
    
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream"
    });
    
    const writer = fs.createWriteStream(filename);
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

console.log("Abby Bot started - Using pairing code authentication");
startBot().catch(console.error);' > index.js


RUN mkdir downloads

RUN npm install

CMD ["node", "index.js"]
