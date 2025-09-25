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
    ffmpeg \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Update npm to latest version
RUN npm install -g npm@latest

# Clean npm cache and install with proper flags
RUN npm cache clean --force && \
    npm install --production --omit=dev --omit=optional --legacy-peer-deps

# Install updated versions of problematic packages
RUN npm install \
    glob@^10.0.0 \
    rimraf@^5.0.0 \
    web-streams-polyfill@^3.3.0 \
    --no-save

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/data /app/auth_info_baileys /app/backups /app/downloads /app/sessions

# Fix permissions and create non-root user
RUN groupadd -r nodejs && \
    useradd -r -g nodejs -s /bin/bash whatsappbot && \
    chown -R whatsappbot:nodejs /app && \
    chmod -R 755 /app

USER whatsappbot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "index.js"]