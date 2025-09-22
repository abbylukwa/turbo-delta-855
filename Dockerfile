FROM node:16-bullseye-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    git \
    curl \
    python3 \
    make \
    g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (all at once for better caching)
RUN npm install --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/data /app/auth_info_baileys /app/backups /app/downloads /app/sessions

# Create a non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs -s /bin/bash whatsappbot

# Change ownership
RUN chown -R whatsappbot:nodejs /app

# Switch to non-root user
USER whatsappbot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application with polyfill
CMD ["node", "polyfill.js"]