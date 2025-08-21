FROM node:18-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    procps \
    && npm install -g npm@latest

# Copy package files
COPY package*.json ./

# Install node dependencies
RUN npm install

# Copy bot source code
COPY . .

# Create session directory
RUN mkdir -p sessions

# Create simple WhatsApp bot that only generates QR code
RUN echo 'const { Client, LocalAuth } = require("whatsapp-web.js");' > index.js && \
    echo 'const qrcode = require("qrcode-terminal");' >> index.js && \
    echo '' >> index.js && \
    echo 'const client = new Client({' >> index.js && \
    echo '    authStrategy: new LocalAuth({ dataPath: "./sessions" }),' >> index.js && \
    echo '    puppeteer: {' >> index.js && \
    echo '        headless: true,' >> index.js && \
    echo '        args: ["--no-sandbox", "--disable-setuid-sandbox"]' >> index.js && \
    echo '    }' >> index.js && \
    echo '});' >> index.js && \
    echo '' >> index.js && \
    echo 'client.on("qr", (qr) => {' >> index.js && \
    echo '    console.log("QR Code received! Scan it with your phone:");' >> index.js && \
    echo '    qrcode.generate(qr, { small: true });' >> index.js && \
    echo '    console.log("QR code generated. Waiting for scan...");' >> index.js && \
    echo '});' >> index.js && \
    echo '' >> index.js && \
    echo 'client.on("ready", () => {' >> index.js && \
    echo '    console.log("WhatsApp bot linked successfully!");' >> index.js && \
    echo '    console.log("Bot is ready and connected");' >> index.js && \
    echo '});' >> index.js && \
    echo '' >> index.js && \
    echo 'client.on("authenticated", () => {' >> index.js && \
    echo '    console.log("Authentication successful!");' >> index.js && \
    echo '});' >> index.js && \
    echo '' >> index.js && \
    echo 'client.initialize();' >> index.js && \
    echo '' >> index.js && \
    echo '// Handle graceful shutdown' >> index.js && \
    echo 'process.on("SIGINT", () => {' >> index.js && \
    echo '    console.log("Shutting down...");' >> index.js && \
    echo '    client.destroy();' >> index.js && \
    echo '    process.exit(0);' >> index.js && \
    echo '});' >> index.js

# Create uptime command
RUN echo '#!/bin/sh' > /usr/local/bin/bot-uptime && \
    echo 'echo "Bot container has been running for: $(ps -o etime= -p 1 | tr -d " ")"' >> /usr/local/bin/bot-uptime && \
    chmod +x /usr/local/bin/bot-uptime

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Expose port if needed for web interface (optional)
# EXPOSE 3000

CMD ["node", "index.js"]
