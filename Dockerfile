# Use the official Node.js LTS image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy application source code
COPY . .

# Create data directory for persistence
RUN mkdir -p /app/data

# Create a non-root user to run the app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S whatsappbot -u 1001

# Change ownership of the app directory
RUN chown -R whatsappbot:nodejs /app

# Switch to the non-root user
USER whatsappbot

# Expose any necessary ports (if applicable)
# EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js || exit 1

# Start the application
CMD ["node", "index.js"]
