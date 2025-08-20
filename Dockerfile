FROM node:22-alpine
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++
WORKDIR /app
ENV TZ=Asia/Kolkata
ENV ACTIVATION_KEY=123
ENV BOT_NAME=Abby
ENV ALLOWED_NUMBER=+263717457592
RUN echo '{"name":"abby-bot","version":"1.0.0","main":"index.js","dependencies":{"@whiskeysockets/baileys":"^6.4.0","qrcode-terminal":"^0.12.0"},"scripts":{"start":"node index.js"}}' > package.json
RUN echo 'const makeWASocket=require("@whiskeysockets/baileys").default;const {useMultiFileAuthState}=require("@whiskeysockets/baileys");const qrcode=require("qrcode-terminal");async function startBot(){const{state,saveCreds}=await useMultiFileAuthState("auth_info");const sock=makeWASocket({auth:state});sock.ev.on("connection.update",(update)=>{const{connection,lastDisconnect,qr}=update;if(qr){console.log("Scan QR code with +263717457592 to connect:");qrcode.generate(qr,{small:true})}if(connection==="close"){console.log("Connection closed, reconnecting...");startBot()}else if(connection==="open"){console.log("Bot connected successfully to +263717457592")}});sock.ev.on("creds.update",saveCreds);sock.ev.on("messages.upsert",async(m)=>{const message=m.messages[0];if(!message.message)return;const text=message.message.conversation||message.message.extendedTextMessage?.text||message.message.imageMessage?.caption||"";const sender=message.key.remoteJid;const senderNumber=sender.split("@")[0];if(senderNumber!==process.env.ALLOWED_NUMBER){console.log("Blocked message from unauthorized number:",senderNumber);return}if(text===process.env.ACTIVATION_KEY){console.log("Received activation code from authorized number, responding...");await sock.sendMessage(sender,{text:"Hello from Abby Bot! Your device +263717457592 is paired and ready."})}})}startBot().catch(console.error)' > index.js
RUN npm install
CMD ["node", "index.js"]
