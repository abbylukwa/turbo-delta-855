FROM node:18-bullseye-slim

WORKDIR /app

# Install system dependencies (minimal set)
RUN apt-get update && \
    apt-get install -y \
    build-essential \
    python3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (skip npm update)
RUN npm install --omit=dev --omit=optional

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/auth_info_baileys /app/downloads

# Create non-root user
RUN groupadd -r nodejs && \
    useradd -r -g nodejs -s /bin/bash whatsappbot && \
    chown -R whatsappbot:nodejs /app

USER whatsappbot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "polyfill.js"]