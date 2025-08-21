FROM node:22-alpine

# Install system dependencies
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++ curl

# Set working directory and timezone
WORKDIR /app
ENV TZ=Asia/Kolkata
ENV ACTIVATION_KEY=123
ENV BOT_NAME=Abby
ENV WEBSITE_URL=https://your-website.com/media
ENV DOWNLOAD_PATH=./downloads

# Create basic package.json (will be enhanced with additional dependencies)
RUN echo '{\
  "name":"abby-bot",\
  "version":"1.0.0",\
  "main":"index.js",\
  "dependencies":{\
    "@whiskeysockets/baileys":"^6.4.0",\
    "qrcode-terminal":"^0.12.0",\
    "axios":"^1.6.0",\
    "fs-extra":"^11.1.1",\
    "path":"^0.12.7",\
    "cheerio":"^1.0.0-rc.12",\
    "image-size":"^1.0.2",\
    "fluent-ffmpeg":"^2.1.2",\
    "yt-search":"^2.10.3",\
    "google-it":"^1.6.0",\
    "validator":"^13.11.0",\
    "moment":"^2.29.4",\
    "lodash":"^4.17.21"\
  },\
  "scripts":{\
    "start":"node index.js"\
  }\
}' > package.json

# Create directory structure
RUN mkdir -p downloads media temp data auth_info

# Create basic index.js (will be replaced with enhanced version)
RUN echo 'const makeWASocket=require("@whiskeysockets/baileys").default;const {useMultiFileAuthState}=require("@whiskeysockets/baileys");const qrcode=require("qrcode-terminal");async function startBot(){const{state,saveCreds}=await useMultiFileAuthState("auth_info");const sock=makeWASocket({auth:state});sock.ev.on("connection.update",(update)=>{const{connection,lastDisconnect,qr}=update;if(qr){console.log("Scan QR code to connect:");qrcode.generate(qr,{small:true})}if(connection==="close"){console.log("Connection closed, reconnecting...");startBot()}else if(connection==="open"){console.log("Bot connected successfully!")}});sock.ev.on("creds.update",saveCreds);sock.ev.on("messages.upsert",async(m)=>{const message=m.messages[0];if(!message.message)return;const text=message.message.conversation||message.message.extendedTextMessage?.text||message.message.imageMessage?.caption||"";const sender=message.key.remoteJid;if(text===process.env.ACTIVATION_KEY){console.log("Received activation code, responding...");await sock.sendMessage(sender,{text:"Hello from Abby Bot! Your device is paired and ready."})}})}startBot().catch(console.error)' > index.js

# Copy all enhanced bot scripts (will overwrite the basic index.js)
COPY *.js ./

# Install dependencies
RUN npm install

# Set the startup command
CMD ["node", "index.js"]
