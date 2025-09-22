FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    build-base \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    git \
    curl \
    ffmpeg

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/data /app/auth_info_baileys /app/backups /app/downloads /app/sessions

# Create a non-root user
RUN addgroup -S nodejs && adduser -S whatsappbot -G nodejs

# Change ownership
RUN chown -R whatsappbot:nodejs /app

# Switch to non-root user
USER whatsappbot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "index.js"]