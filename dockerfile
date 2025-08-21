FROM node:22-alpine
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++ curl
WORKDIR /app
ENV TZ=Asia/Kolkata
ENV ACTIVATION_KEY=123
ENV BOT_NAME=Abby
ENV WEBSITE_URL=https://your-website.com/images
ENV DOWNLOAD_PATH=./downloads

# Create package.json
RUN echo '{\
  "name":"abby-bot",\
  "version":"1.0.0",\
  "main":"index.js",\
  "dependencies":{\
    "@whiskeysockets/baileys":"^6.4.0",\
    "qrcode-terminal":"^0.12.0",\
    "axios":"^1.6.0",\
    "fs-extra":"^11.1.1",\
    "path":"^0.12.7"\
  },\
  "scripts":{\
    "start":"node index.js"\
  }\
}' > package.json

# Create directory structure
RUN mkdir -p downloads images temp

# Copy the bot script (we'll create this separately)
COPY index.js .
COPY downloader.js .

RUN npm install
CMD ["node", "index.js"]
