FROM node:16-bullseye-slim

WORKDIR /app

Install system dependencies including Python and build tools

RUN apt-get update && 
    apt-get install -y 
    build-essential 
    python3 
    make 
    g++ 
    libcairo2-dev 
    libpango1.0-dev 
    libjpeg-dev 
    libgif-dev 
    librsvg2-dev 
    git 
    curl && 
    rm -rf /var/lib/apt/lists/*

Copy package files

COPY package*.json ./

Install dependencies

RUN npm install --only=production RUN npm install web-streams-polyfill

Copy application code

COPY . .

Create necessary directories

RUN mkdir -p /app/data /app/auth_info_baileys /app/backups /app/downloads /app/sessions

Create a non-root user

RUN groupadd -r nodejs && useradd -r -g nodejs -s /bin/bash whatsappbot

Change ownership

RUN chown -R whatsappbot:nodejs /app

Switch to non-root user

USER whatsappbot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "polyfill.js"]