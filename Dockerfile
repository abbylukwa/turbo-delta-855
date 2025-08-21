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
    "qrcode-terminal": "^0.12.0",\
    "translate-google": "^1.5.0"\
  },\
  "scripts": {\
    "start": "node index.js"\
  }\
}' > package.json

# Create index.js with the new functionality
RUN echo 'const makeWASocket = require("@whiskeysockets/baileys").default;' > index.js && \
    echo 'const { useMultiFileAuthState } = require("@whiskeysockets/baileys");' >> index.js && \
    echo 'const qrcode = require("qrcode-terminal");' >> index.js && \
    echo 'const axios = require("axios");' >> index.js && \
    echo 'const fs = require("fs");' >> index.js && \
    echo 'const moment = require("moment");' >> index.js && \
    echo 'const translate = require("translate-google");' >> index.js && \
    echo '' >> index.js && \
    echo 'const SEARCH_WEBSITES = [' >> index.js && \
    echo '  "https://MzansiFun.com",' >> index.js && \
    echo '  "https://XNXX.com",' >> index.js && \
    echo '  "https://PornPics.com",' >> index.js && \
    echo '  "https://PornHat.com"' >> index.js && \
    echo '];' >> index.js && \\
    echo '' >> index.js && \
    echo 'let activatedUsers = new Set();' >> index.js && \
    echo 'let adminUsers = new Set();' >> index.js && \
    echo 'let downloadCounts = {};' >> index.js && \
    echo 'let lastDownloadTime = {};' >> index.js && \
    echo 'let subscribedUsers = {};' >> index.js && \
    echo 'let userLanguages = {};' >> index.js && \
    echo '' >> index.js && \
    echo '// Multi-language responses' >> index.js && \
    echo 'const responses = {' >> index.js && \
    echo '  welcome: {' >> index.js && \
    echo '    en: "Welcome to Abby'\''s Bot! 🤖\\n\\nAvailable commands:\\n• Send any filename to search and download\\n• !mystatus - Check your download status\\n• !payments - Payment information\\n\\nChatting is free, downloads have limits based on your subscription.",' >> index.js && \
    echo '    es: "¡Bienvenido al Bot de Abby! 🤖\\n\\nComandos disponibles:\\n• Envía cualquier nombre de archivo para buscar y descargar\\n• !mystatus - Consulta tu estado de descarga\\n• !payments - Información de pago\\n\\nChatear es gratis, las descargas tienen límites según tu suscripción.",' >> index.js && \
    echo '    fr: "Bienvenue sur le Bot d'\''Abby ! 🤖\\n\\nCommandes disponibles:\\n• Envoyez n'\''importe quel nom de fichier pour rechercher et télécharger\\n• !mystatus - Vérifiez votre statut de téléchargement\\n• !payments - Informations de paiement\\n\\nDiscuter est gratuit, les téléchargements ont des limites selon votre abonnement.",' >> index.js && \
    echo '    de: "Willkommen bei Abbys Bot! 🤖\\n\\nVerfügbare Befehle:\\n• Senden Sie einen beliebigen Dateinamen zum Suchen und Herunterladen\\n• !mystatus - Überprüfen Sie Ihren Download-Status\\n• !payments - Zahlungsinformationen\\n\\nChatten ist kostenlos, Downloads haben Limits basierend auf Ihrem Abonnement."' >> index.js && \
    echo '  },' >> index.js && \
    echo '  activation: {' >> index.js && \
    echo '    en: "Activation successful! Welcome to Abby'\''s Bot. 🤖",' >> index.js && \
    echo '    es: "¡Activación exitosa! Bienvenido al Bot de Abby. 🤖",' >> index.js && \
    echo '    fr: "Activation réussie ! Bienvenue sur le Bot d'\''Abby. 🤖",' >> index.js && \
    echo '    de: "Aktivierung erfolgreich! Willkommen bei Abbys Bot. 🤖"' >> index.js && \
    echo '  },' >> index.js && \
    echo '  adminActivation: {' >> index.js && \
    echo '    en: "Admin activation successful! Welcome to Abby'\''s Bot. 🤖",' >> index.js && \
    echo '    es: "¡Activación de administrador exitosa! Bienvenido al Bot de Abby. 🤖",' >> index.js && \
    echo '    fr: "Activation administrateur réussie ! Bienvenue sur le Bot d'\''Abby. 🤖",' >> index.js && \
    echo '    de: "Admin-Aktivierung erfolgreich! Willkommen bei Abbys Bot. 🤖"' >> index.js && \
    echo '  },' >> index.js && \
    echo '  notActivated: {' >> index.js && \
    echo '    en: "Please activate first by sending: Abby0121",' >> index.js && \
    echo '    es: "Por favor, active primero enviando: Abby0121",' >> index.js && \
    echo '    fr: "Veuillez d'\''abord activer en envoyant: Abby0121",' >> index.js && \
    echo '    de: "Bitte aktivieren Sie zuerst durch Senden von: Abby0121"' >> index.js && \
    echo '  },' >> index.js && \
    echo '  searchStarted: {' >> index.js && \
    echo '    en: "🔍 Searching for your file across multiple websites...",' >> index.js && \
    echo '    es: "🔍 Buscando tu archivo en múltiples sitios web...",' >> index.js && \
    echo '    fr: "🔍 Recherche de votre fichier sur plusieurs sites web...",' >> index.js && \
    echo '    de: "🔍 Durchsuche mehrere Websites nach Ihrer Datei..."' >> index.js && \
    echo '  },' >> index.js && \
    echo '  downloadLimit: {' >> index.js && \
    echo '    en: "Download limit reached. Please subscribe for unlimited downloads.",' >> index.js && \
    echo '    es: "Límite de descarga alcanzado. Suscríbete para descargas ilimitadas.",' >> index.js && \
    echo '    fr: "Limite de téléchargement atteinte. Veuillez vous abonner pour des téléchargements illimités.",' >> index.js && \
    echo '    de: "Download-Limit erreicht. Bitte abonnieren Sie für unbegrenzte Downloads."' >> index.js && \
    echo '  },' >> index.js && \
    echo '  downloadSuccess: {' >> index.js && \
    echo '    en: "Download completed successfully! 🎉",' >> index.js && \
    echo '    es: "¡Descarga completada con éxito! 🎉",' >> index.js && \
    echo '    fr: "Téléchargement terminé avec succès ! 🎉",' >> index.js && \
    echo '    de: "Download erfolgreich abgeschlossen! 🎉"' >> index.js && \
    echo '  },' >> index.js && \
    echo '  downloadFailed: {' >> index.js && \
    echo '    en: "Download failed. Please try another file.",' >> index.js && \
    echo '    es: "Descarga fallida. Por favor, intenta con otro archivo.",' >> index.js && \
    echo '    fr: "Échec du téléchargement. Veuillez essayer un autre fichier.",' >> index.js && \
    echo '    de: "Download fehlgeschlagen. Bitte versuchen Sie eine andere Datei."' >> index.js && \
    echo '  },' >> index.js && \
    echo '  fileNotFound: {' >> index.js && \
    echo '    en: "File not found on any of our supported websites.",' >> index.js && \
    echo '    es: "Archivo no encontrado en ninguno de nuestros sitios web compatibles.",' >> index.js && \
    echo '    fr: "Fichier non trouvé sur aucun de nos sites web pris en charge.",' >> index.js && \
    echo '    de: "Datei auf keiner unserer unterstützten Websites gefunden."' >> index.js && \
    echo '  }' >> index.js && \
    echo '};' >> index.js && \
    echo '' >> index.js && \
    echo 'async function getResponse(key, lang = "en") {' >> index.js && \
    echo '  return responses[key][lang] || responses[key]["en"];' >> index.js && \
    echo '}' >> index.js && \
    echo '' >> index.js && \
    echo 'async function detectLanguage(text) {' >> index.js && \
    echo '  try {' >> index.js && \
    echo '    // Simple language detection based on common words' >> index.js && \
    echo '    if (/hola|gracias|por favor|buenos/i.test(text)) return "es";' >> index.js && \
    echo '    if (/bonjour|merci|s'\''il vous|je voudrais/i.test(text)) return "fr";' >> index.js && \
    echo '    if (/hallo|danke|bitte|guten tag/i.test(text)) return "de";' >> index.js && \
    echo '    return "en";' >> index.js && \
    echo '  } catch (error) {' >> index.js && \
    echo '    return "en";' >> index.js && \
    echo '  }' >> index.js && \
    echo '}' >> index.js && \
    echo '' >> index.js && \
    echo 'async function startBot() {' >> index.js && \
    echo '  const { state, saveCreds } = await useMultiFileAuthState("auth_info");' >> index.js && \
    echo '  const sock = makeWASocket({ ' >> index.js && \
    echo '    auth: state,' >> index.js && \
    echo '    printQRInTerminal: false' >> index.js && \
    echo '  });' >> index.js && \
    echo '' >> index.js && \
    echo '  sock.ev.on("connection.update", (update) => {' >> index.js && \
    echo '    const { connection, lastDisconnect, qr } = update;' >> index.js && \
    echo '    if (qr) {' >> index.js && \
    echo '      console.log("Scan the QR code below to connect:");' >> index.js && \
    echo '      qrcode.generate(qr, { small: true });' >> index.js && \
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
    echo '    const message = m.messages[0];' >> index.js && \
    echo '    if (!message.message) return;' >> index.js && \
    echo '    const text = message.message.conversation || message.message.extendedTextMessage?.text || "";' >> index.js && \
    echo '    const sender = message.key.remoteJid;' >> index.js && \
    echo '    const senderNumber = sender.split("@")[0];' >> index.js && \
    echo '' >> index.js && \
    echo '    // Detect user language if not already set' >> index.js && \
    echo '    if (!userLanguages[senderNumber]) {' >> index.js && \
    echo '      userLanguages[senderNumber] = await detectLanguage(text);' >> index.js && \
    echo '    }' >> index.js && \
    echo '    const userLang = userLanguages[senderNumber];' >> index.js && \
    echo '' >> index.js && \
    echo '    // Activation commands' >> index.js && \
    echo '    if (text === "Abby0121") {' >> index.js && \
    echo '      activatedUsers.add(senderNumber);' >> index.js && \
    echo '      const welcomeMsg = await getResponse("welcome", userLang);' >> index.js && \
    echo '      const activationMsg = await getResponse("activation", userLang);' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: activationMsg });' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: welcomeMsg });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    if (text === "Admin0121") {' >> index.js && \
    echo '      adminUsers.add(senderNumber);' >> index.js && \
    echo '      activatedUsers.add(senderNumber);' >> index.js && \
    echo '      const welcomeMsg = await getResponse("welcome", userLang);' >> index.js && \
    echo '      const adminMsg = await getResponse("adminActivation", userLang);' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: adminMsg });' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: welcomeMsg });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    // Check if user is activated' >> index.js && \
    echo '    if (!activatedUsers.has(senderNumber) && !adminUsers.has(senderNumber)) {' >> index.js && \
    echo '      const notActivatedMsg = await getResponse("notActivated", userLang);' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: notActivatedMsg });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    // Admin subscription management' >> index.js && \
    echo '    if (adminUsers.has(senderNumber) && text.startsWith("addsub ")) {' >> index.js && \
    echo '      const parts = text.replace("addsub ", "").split(" ");' >> index.js && \
    echo '      if (parts.length >= 2) {' >> index.js && \
    echo '        const number = parts[0];' >> index.js && \
    echo '        const days = parseInt(parts[1]);' >> index.js && \
    echo '        ' >> index.js && \
    echo '        if (number.startsWith("+") && !isNaN(days)) {' >> index.js && \
    echo '          const expiryDate = moment().add(days, "days").toDate();' >> index.js && \
    echo '          subscribedUsers[number] = {' >> index.js && \
    echo '            expiry: expiryDate,' >> index.js && \
    echo '            downloads: 0' >> index.js && \
    echo '          };' >> index.js && \
    echo '          await sock.sendMessage(sender, { text: `Subscription added for ${number} for ${days} days` });' >> index.js && \
    echo '        }' >> index.js && \
    echo '      }' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    const hasSubscription = subscribedUsers[senderNumber] && new Date() < new Date(subscribedUsers[senderNumber].expiry);' >> index.js && \
    echo '    ' >> index.js && \
    echo '    // File search and download - triggered by any message that is not a command' >> index.js && \
    echo '    if (!text.startsWith("!") && text.length > 2) {' >> index.js && \
    echo '      const searchMsg = await getResponse("searchStarted", userLang);' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: searchMsg });' >> index.js && \
    echo '      ' >> index.js && \
    echo '      const now = Date.now();' >> index.js && \
    echo '      ' >> index.js && \
    echo '      // Check download limits for non-subscribed, non-admin users' >> index.js && \
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
    echo '          const limitMsg = await getResponse("downloadLimit", userLang);' >> index.js && \
    echo '          await sock.sendMessage(sender, { text: limitMsg });' >> index.js && \
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
    echo '        // Search for the file across websites' >> index.js && \
    echo '        const result = await searchAndDownloadFile(text, senderNumber);' >> index.js && \
    echo '        if (result.success) {' >> index.js && \
    echo '          const successMsg = await getResponse("downloadSuccess", userLang);' >> index.js && \
    echo '          await sock.sendMessage(sender, { text: successMsg });' >> index.js && \
    echo '        } else {' >> index.js && \
    echo '          const notFoundMsg = await getResponse("fileNotFound", userLang);' >> index.js && \
    echo '          await sock.sendMessage(sender, { text: notFoundMsg });' >> index.js && \
    echo '        }' >> index.js && \
    echo '      } catch (error) {' >> index.js && \
    echo '        const failedMsg = await getResponse("downloadFailed", userLang);' >> index.js && \
    echo '        await sock.sendMessage(sender, { text: failedMsg });' >> index.js && \
    echo '      }' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    // Status command' >> index.js && \
    echo '    if (text === "!mystatus") {' >> index.js && \
    echo '      if (hasSubscription) {' >> index.js && \
    echo '        const expiryDate = new Date(subscribedUsers[senderNumber].expiry);' >> index.js && \
    echo '        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));' >> index.js && \
    echo '        await sock.sendMessage(sender, { ' >> index.js && \
    echo '          text: `Your subscription is active.\\nExpiry: ${expiryDate.toDateString()}\\nDays left: ${daysLeft}\\nDownloads used: ${subscribedUsers[senderNumber].downloads || 0}` ' >> index.js && \
    echo '        });' >> index.js && \
    echo '      } else if (adminUsers.has(senderNumber)) {' >> index.js && \
    echo '        await sock.sendMessage(sender, { text: "You are an admin with unlimited access." });' >> index.js && \
    echo '      } else {' >> index.js && \
    echo '        const remaining = 5 - (downloadCounts[senderNumber] || 0);' >> index.js && \
    echo '        await sock.sendMessage(sender, { ' >> index.js && \
    echo '          text: `You are on free tier.\\nRemaining free downloads: ${remaining}` ' >> index.js && \
    echo '        });' >> index.js && \
    echo '      }' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    // Admin stats command' >> index.js && \
    echo '    if (adminUsers.has(senderNumber) && text === "!stats") {' >> index.js && \
    echo '      let activeSubs = 0;' >> index.js && \
    echo '      for (const num in subscribedUsers) {' >> index.js && \
    echo '        if (new Date() < new Date(subscribedUsers[num].expiry)) activeSubs++;' >> index.js && \
    echo '      }' >> index.js && \
    echo '      ' >> index.js && \
    echo '      const stats = `Active users: ${activatedUsers.size}\\nAdmin users: ${adminUsers.size}\\nActive subscriptions: ${activeSubs}`;' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: stats });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    // Admin subscriptions list command' >> index.js && \
    echo '    if (adminUsers.has(senderNumber) && text === "!subs") {' >> index.js && \
    echo '      let subsList = "Active Subscriptions:\\n";' >> index.js && \
    echo '      for (const num in subscribedUsers) {' >> index.js && \
    echo '        if (new Date() < new Date(subscribedUsers[num].expiry)) {' >> index.js && \
    echo '          const expiry = new Date(subscribedUsers[num].expiry);' >> index.js && \
    echo '          const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));' >> index.js && \
    echo '          subsList += `${num}: Expires ${expiry.toDateString()} (${daysLeft} days left), Downloads: ${subscribedUsers[num].downloads || 0}\\n`;' >> index.js && \
    echo '        }' >> index.js && \
    echo '      }' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: subsList });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    // Payments command' >> index.js && \
    echo '    if (text === "!payments") {' >> index.js && \
    echo '      const paymentMessage = "Payment Information: Contact admin for subscription details.";' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: paymentMessage });' >> index.js && \
    echo '      return;' >> index.js && \
    echo '    }' >> index.js && \
    echo '' >> index.js && \
    echo '    // Auto-reply to any other messages (free chatting)' >> index.js && \
    echo '    if (activatedUsers.has(senderNumber) && text.length > 1) {' >> index.js && \
    echo '      // Simple auto-reply for chatting' >> index.js && \
    echo '      const replies = {' >> index.js && \
    echo '        en: ["I'\''m here to help you find files!", "You can send me any filename to search.", "Need help finding something?"],' >> index.js && \
    echo '        es: ["¡Estoy aquí para ayudarte a encontrar archivos!", "Puedes enviarme cualquier nombre de archivo para buscar.", "¿Necesitas ayuda para encontrar algo?"],' >> index.js && \
    echo '        fr: ["Je suis là pour vous aider à trouver des fichiers !", "Vous pouvez m'\''envoyer n'\''importe quel nom de fichier à rechercher.", "Besoin d'\''aide pour trouver quelque chose ?"],' >> index.js && \
    echo '        de: ["Ich bin hier, um Ihnen bei der Dateisuche zu helfen!", "Sie können mir jeden Dateinamen zum Suchen senden.", "Brauchen Sie Hilfe bei der Suche?"]' >> index.js && \
    echo '      };' >> index.js && \
    echo '      ' >> index.js && \
    echo '      const randomReply = replies[userLang][Math.floor(Math.random() * replies[userLang].length)];' >> index.js && \
    echo '      await sock.sendMessage(sender, { text: randomReply });' >> index.js && \
    echo '    }' >> index.js && \
    echo '  });' >> index.js && \
    echo '}' >> index.js && \
    echo '' >> index.js && \
    echo 'async function searchAndDownloadFile(filename, senderNumber) {' >> index.js && \
    echo '  try {' >> index.js && \
    echo '    // Randomly select a website to search from' >> index.js && \
    echo '    const randomSite = SEARCH_WEBSITES[Math.floor(Math.random() * SEARCH_WEBSITES.length)];' >> index.js && \
    echo '    const searchUrl = randomSite + encodeURIComponent(filename);' >> index.js && \
    echo '    ' >> index.js && \
    echo '    // In a real implementation, you would parse the search results and find a download link' >> index.js && \
    echo '    // For this example, we'\''ll simulate a successful search and download' >> index.js && \
    echo '    ' >> index.js && \
    echo '    const timestamp = new Date().getTime();' >> index.js && \
    echo '    const downloadFilename = `downloads/${senderNumber}_${timestamp}_${filename.replace(/[^a-zA-Z0-9]/g, "_")}.download`;' >> index.js && \
    echo '    ' >> index.js && \
    echo '    if (!fs.existsSync("downloads")) {' >> index.js && \
    echo '      fs.mkdirSync("downloads");' >> index.js && \
    echo '    }' >> index.js && \
    echo '    ' >> index.js && \
    echo '    // Simulate download process (in real implementation, use axios to download actual file)' >> index.js && \
    echo '    return new Promise((resolve) => {' >> index.js && \
    echo '      setTimeout(() => {' >> index.js && \
    echo '        // Create a dummy file to simulate download' >> index.js && \
    echo '        fs.writeFileSync(downloadFilename, `Simulated download of ${filename} from ${randomSite}`);' >> index.js && \
    echo '        resolve({ success: true, filename: downloadFilename });' >> index.js && \
    echo '      }, 2000); // Simulate 2 second download time' >> index.js && \
    echo '    });' >> index.js && \
    echo '  } catch (error) {' >> index.js && \
    echo '    return { success: false, error: error.message };' >> index.js && \
    echo '  }' >> index.js && \
    echo '}' >> index.js && \
    echo '' >> index.js && \
    echo 'console.log("Bot started");' >> index.js && \
    echo 'startBot().catch(console.error);' >> index.js

# Create downloads directory
RUN mkdir downloads

# Install dependencies
RUN npm install

# Start the bot
CMD ["node", "index.js"]
