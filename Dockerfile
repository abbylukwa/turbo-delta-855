FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    ffmpeg

COPY package*.json ./

RUN npm install

COPY . .

# Create necessary directories
RUN mkdir -p downloads temp data auth_info_baileys

EXPOSE 3000

CMD ["node", "index.js"]