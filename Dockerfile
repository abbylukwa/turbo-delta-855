FROM node:20-alpine

WORKDIR /app

# Install system dependencies including canvas requirements
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    ffmpeg \
    libc6-compat \
    libtool \
    autoconf \
    automake \
    nasm \
    zlib-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    pango-dev \
    cairo-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    librsvg-dev

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]