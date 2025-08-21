FROM node:22-alpine
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++ curl
WORKDIR /app
ENV TZ=Asia/Kolkata
ENV BOT_NAME=MultiBot
ENV WEBSITE_URL=https://Pornpics.com
ENV DOWNLOAD_PATH=./downloads

# Create package.json
RUN echo '{\
  "name":"multibot",\
  "version":"1.0.0",\
  "main":"index.js",\
  "dependencies":{\
    "@whiskeysockets/baileys":"^6.4.0",\
    "qrcode-terminal":"^0.12.0",\
    "axios":"^1.6.0",\
    "fs-extra":"^11.1.1",\
    "path":"^0.12.7",\
    "cheerio":"^1.0.0-rc.12",\
    "image-size":"^1.0.2",\
    "fluent-ffmpeg":"^2.1.2",\
    "yt-search":"^2.10.3",\
    "google-it":"^1.6.0"\
  },\
  "scripts":{\
    "start":"node index.js"\
  }\
}' > package.json

# Create directory structure
RUN mkdir -p downloads media temp

# Copy the bot scripts
COPY index.js .
COPY downloader.js .
COPY website-scraper.js .
COPY group-manager.js .
COPY web-searcher.js .

RUN npm install
CMD ["node", "index.js"]
