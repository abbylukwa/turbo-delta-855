FROM node:18-bullseye-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Configure npm to avoid git dependencies issues
RUN npm config set update-notifier false && \
    npm config set fund false && \
    npm install --omit=dev --omit=optional --no-audit --no-fund

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/auth_info_baileys /app/downloads

# Set permissions
RUN groupadd -r nodejs && \
    useradd -r -g nodejs -s /bin/bash whatsappbot && \
    chown -R whatsappbot:nodejs /app

USER whatsappbot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["npm", "start"]