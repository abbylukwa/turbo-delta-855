# Use the official Node.js LTS image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Install system dependencies including ffmpeg for media processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    ffmpeg \
    libc6-compat

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy application source code
COPY . .

# Create necessary directories for persistence
RUN mkdir -p /app/data /app/auth_info_baileys

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PORT:-3000}/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 3000

# Create a non-root user to run the app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S whatsappbot -u 1001

# Change ownership of the app directory
RUN chown -R whatsappbot:nodejs /app

# Switch to the non-root user
USER whatsappbot

CMD ["node", "index.js"]
