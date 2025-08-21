FROM node:22-alpine
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++ curl wget
WORKDIR /app
ENV TZ=Asia/Kolkata
ENV BOT_NAME=Abby
ENV MAIN_DEVICE=+263717457592

RUN echo '{"name":"abby-bot","version":"1.0.0","main":"index.js","dependencies":{"@whiskeysockets/baileys":"^6.4.0","qrcode-terminal":"^0.12.0","axios":"^1.6.0"},"scripts":{"start":"node index.js"}}' > package.json

RUN echo 'const makeWASocket=require("@whiskeysockets/baileys").default;' > index.js
RUN echo 'const {useMultiFileAuthState}=require("@whiskeysockets/baileys");' >> index.js
RUN echo 'const qrcode=require("qrcode-terminal");' >> index.js
RUN echo 'const axios=require("axios");' >> index.js
RUN echo 'const fs=require("fs");' >> index.js
RUN echo 'let activatedUsers=new Set();' >> index.js
RUN echo 'let adminUsers=new Set();' >> index.js
RUN echo 'let downloadCounts={};' >> index.js
RUN echo 'let lastDownloadTime={};' >> index.js
RUN echo 'let pairedDevices=new Set();' >> index.js
RUN echo 'pairedDevices.add("+263717457592");' >> index.js

RUN echo 'async function startBot(){' >> index.js
RUN echo 'const{state,saveCreds}=await useMultiFileAuthState("auth_info");' >> index.js
RUN echo 'const sock=makeWASocket({auth:state});' >> index.js

RUN echo 'sock.ev.on("connection.update",(update)=>{' >> index.js
RUN echo 'const{connection,lastDisconnect,qr}=update;' >> index.js
RUN echo 'if(qr){console.log("Scan QR code with main device +263717457592:");qrcode.generate(qr,{small:true})}' >> index.js
RUN echo 'if(connection==="close"){console.log("Connection closed, reconnecting...");startBot()}' >> index.js
RUN echo 'else if(connection==="open"){console.log("Bot connected to main device");}' >> index.js
RUN echo '});' >> index.js

RUN echo 'sock.ev.on("creds.update",saveCreds);' >> index.js

RUN echo 'sock.ev.on("messages.upsert",async(m)=>{' >> index.js
RUN echo 'const message=m.messages[0];' >> index.js
RUN echo 'if(!message.message)return;' >> index.js
RUN echo 'const text=message.message.conversation||message.message.extendedTextMessage?.text||"";' >> index.js
RUN echo 'const sender=message.key.remoteJid;' >> index.js
RUN echo 'const senderNumber=sender.split("@")[0];' >> index.js

RUN echo 'if(!pairedDevices.has(senderNumber)){' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:"Device not paired. Contact main device +263717457592 for pairing code."});' >> index.js
RUN echo 'return;' >> index.js
RUN echo '}' >> index.js

RUN echo 'if(text==="Abby0121"){' >> index.js
RUN echo 'activatedUsers.add(senderNumber);' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:"Activation successful! You can now use the bot. Commands: !download [url]"});' >> index.js
RUN echo 'return;' >> index.js
RUN echo '}' >> index.js

RUN echo 'if(text==="Admin0121"){' >> index.js
RUN echo 'adminUsers.add(senderNumber);' >> index.js
RUN echo 'activatedUsers.add(senderNumber);' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:"Admin activation successful! Full access granted."});' >> index.js
RUN echo 'return;' >> index.js
RUN echo '}' >> index.js

RUN echo 'if(senderNumber==="+263717457592"&&text.startsWith("pair ")){' >> index.js
RUN echo 'const newNumber=text.replace("pair ","").trim();' >> index.js
RUN echo 'if(newNumber.startsWith("+")){' >> index.js
RUN echo 'pairedDevices.add(newNumber);' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:`Device ${newNumber} paired successfully.`});' >> index.js
RUN echo 'await sock.sendMessage(`${newNumber}@s.whatsapp.net`,{text:"Your device has been paired. Send Abby0121 to activate."});' >> index.js
RUN echo '}else{' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:"Invalid number format. Use: pair +1234567890"});' >> index.js
RUN echo '}' >> index.js
RUN echo 'return;' >> index.js
RUN echo '}' >> index.js

# Check if user is activated
RUN echo 'if(!activatedUsers.has(senderNumber)&&!adminUsers.has(senderNumber)){' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:"Please activate first by sending: Abby0121"});' >> index.js
RUN echo 'return;' >> index.js
RUN echo '}' >> index.js

RUN echo 'if(text.startsWith("!download ")){' >> index.js
RUN echo 'const url=text.replace("!download ","");' >> index.js
RUN echo 'const now=Date.now();' >> index.js
RUN echo 'if(!adminUsers.has(senderNumber)){' >> index.js
RUN echo 'if(!downloadCounts[senderNumber])downloadCounts[senderNumber]=0;' >> index.js
RUN echo 'if(!lastDownloadTime[senderNumber])lastDownloadTime[senderNumber]=0;' >> index.js
RUN echo 'if(now-lastDownloadTime[senderNumber]>=9*60*60*1000){' >> index.js
RUN echo 'downloadCounts[senderNumber]=0;' >> index.js
RUN echo 'lastDownloadTime[senderNumber]=now;' >> index.js
RUN echo '}' >> index.js
RUN echo 'if(downloadCounts[senderNumber]>=5){' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:"Download limit reached. Wait 9 hours or contact admin for full access."});' >> index.js
RUN echo 'return;' >> index.js
RUN echo '}' >> index.js
RUN echo 'downloadCounts[senderNumber]++;' >> index.js
RUN echo '}' >> index.js
RUN echo 'try{' >> index.js
RUN echo 'const result=await downloadFile(url);' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:result});' >> index.js
RUN echo '}catch(error){' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:"Download failed"});' >> index.js
RUN echo '}' >> index.js
RUN echo 'return;' >> index.js
RUN echo '}' >> index.js

RUN echo 'if(adminUsers.has(senderNumber)){' >> index.js
RUN echo 'if(text==="!stats"){' >> index.js
RUN echo 'const stats=`Active users: ${activatedUsers.size}\nAdmin users: ${adminUsers.size}\nPaired devices: ${pairedDevices.size}`;' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:stats});' >> index.js
RUN echo 'return;' >> index.js
RUN echo '}' >> index.js
RUN echo '}' >> index.js

RUN echo 'if(activatedUsers.has(senderNumber)){' >> index.js
RUN echo 'await sock.sendMessage(sender,{text:"Bot is active. Use !download [url] to download files."});' >> index.js
RUN echo '}' >> index.js
RUN echo '});' >> index.js

RUN echo 'async function downloadFile(url){' >> index.js
RUN echo 'try{' >> index.js
RUN echo 'const response=await axios.head(url);' >> index.js
RUN echo 'return`Download ready: ${url}\nFile type: ${response.headers["content-type"]}\nSize: ${response.headers["content-length"]} bytes`;' >> index.js
RUN echo '}catch(error){' >> index.js
RUN echo 'throw new Error("Download preparation failed");' >> index.js
RUN echo '}' >> index.js
RUN echo '}' >> index.js

RUN echo 'console.log("Abby Bot started - Only responds after activation");' >> index.js
RUN echo '}' >> index.js

RUN echo 'startBot().catch(console.error);' >> index.js

RUN npm install

CMD ["node", "index.js"]
