FROM node:18-bullseye-slim

WORKDIR /app

# Install system dependencies (including git)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    ffmpeg \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with proper flags
RUN npm install --omit=dev --omit=optional --no-audit --no-fund \
    && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p /app/auth_info_baileys /app/downloads

# Create non-root user and set permissions
RUN groupadd -r nodejs && \
    useradd -r -g nodejs -s /bin/bash whatsappbot && \
    chown -R whatsappbot:nodejs /app

USER whatsappbot

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["npm", "start"]