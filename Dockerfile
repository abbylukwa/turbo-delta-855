FROM node:22-alpine

RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++

WORKDIR /app

RUN mkdir -p temp

ENV TZ=Asia/Kolkata
ENV ACTIVATION_KEY=123
ENV BOT_NAME=Abby

RUN npm install -g --force yarn pm2

RUN echo '{"name":"abby-bot","version":"1.0.0","description":"WhatsApp bot","main":"index.js","dependencies":{},"scripts":{"start":"node index.js"}}' > package.json

RUN echo 'const http = require("http");const server = http.createServer((req, res) => {if (req.method === "POST" && req.url === "/message") {let body = "";req.on("data", chunk => {body += chunk.toString();});req.on("end", () => {try {const data = JSON.parse(body);if (data.message === process.env.ACTIVATION_KEY) {console.log("Received activation code, responding: hello");res.writeHead(200, { "Content-Type": "application/json" });res.end(JSON.stringify({ response: "hello from " + process.env.BOT_NAME }));} else {res.writeHead(200, { "Content-Type": "application/json" });res.end(JSON.stringify({ response: "ignored" }));}} catch (error) {res.writeHead(400, { "Content-Type": "application/json" });res.end(JSON.stringify({ error: "Invalid JSON" }));}});} else {res.writeHead(200, { "Content-Type": "text/plain" });res.end("Abby Bot is running");}});const PORT = 3000;server.listen(PORT, () => {console.log("Abby Bot server running on port", PORT);console.log("Activation key:", process.env.ACTIVATION_KEY);console.log("Send POST to /message with: {\"message\": \"123\"}");});' > index.js

RUN yarn install

CMD ["npm", "start"]
