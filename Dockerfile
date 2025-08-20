WORKDIR /app

RUN mkdir -p temp

ENV TZ=Asia/Kolkata
ENV ACTIVATION_KEY=123
ENV BOT_NAME=Abby

RUN npm install -g --force yarn pm2

RUN echo '{\
  "name": "abby-bot",\
  "version": "1.0.0",\
  "description": "WhatsApp bot that responds to activation code",\
  "main": "index.js",\
  "dependencies": {\
    "@whiskeysockets/baileys": "^6.4.0"\
  },\
  "scripts": {\
    "start": "node index.js"\
  }\
}' > package.json
RUN echo '\
const makeWASocket = require("@whiskeysockets/baileys").default;\
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");\
\
async function startBot() {\
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");\
    \
    const sock = makeWASocket({\
        auth: state,\
        printQRInTerminal: true\
    });\
\
    sock.ev.on("connection.update", (update) => {\
        const { connection, lastDisconnect } = update;\
        if (connection === "close") {\
            console.log("Connection closed, reconnecting...");\
            startBot();\
        } else if (connection === "open") {\
            console.log("Bot connected successfully!");\
        }\
    });\
\
    sock.ev.on("creds.update", saveCreds);\
\
    sock.ev.on("messages.upsert", async (m) => {\
        const message = m.messages[0];\
        if (!message.message) return;\
        \
        const text = message.message.conversation || \
                    message.message.extendedTextMessage?.text || \
                    message.message.imageMessage?.caption || "";\
        \
        const sender = message.key.remoteJid;\
        \
        if (text === process.env.ACTIVATION_KEY || text === "123") {\
            console.log("Received activation code, sending hello...");\
            await sock.sendMessage(sender, { text: "hello from " + process.env.BOT_NAME });\
        }\
    });\
}\
\
startBot().catch(console.error);\
' > index.js

RUN yarn install

CMD ["npm", "start"]
