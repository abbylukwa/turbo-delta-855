FROM node:18-bullseye-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y \
    build-essential \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    git \
    curl \
    ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install with more permissive flags
RUN npm config set legacy-peer-deps true && \
    npm install --production --no-optional

# Install web-streams-polyfill
RUN npm install web-streams-polyfill

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/data /app/auth_info_baileys /app/backups /app/downloads /app/sessions

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs -s /bin/bash whatsappbot && \
    chown -R whatsappbot:nodejs /app

USER whatsappbot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "index.js"]