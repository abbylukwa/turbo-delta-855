FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy bot source code
COPY . .

# Create session directory
RUN mkdir -p sessions

# Install procps for process monitoring
RUN apk add --no-cache procps

# Create uptime command file
RUN echo '#!/bin/sh' > /usr/local/bin/bot-uptime && \
    echo 'echo "Bot has been online for: $(ps -o etime= -p 1 | tr -d \\" \\")"' >> /usr/local/bin/bot-uptime && \
    chmod +x /usr/local/bin/bot-uptime

# Set default command
CMD ["npm", "start"]
