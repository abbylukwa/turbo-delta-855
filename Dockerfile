FROM node:18-bullseye-slim

WORKDIR /app

RUN apt-get update && apt-get install -y build-essential python3 ffmpeg git

COPY package*.json ./

RUN npm install --omit=dev --omit=optional

COPY . .

RUN mkdir -p /app/auth_info_baileys /app/downloads

RUN groupadd -r nodejs && useradd -r -g nodejs -s /bin/bash whatsappbot && chown -R whatsappbot:nodejs /app

USER whatsappbot

EXPOSE 3000

CMD ["node", "polyfill.js"]