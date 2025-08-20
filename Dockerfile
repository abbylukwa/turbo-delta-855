FROM node:22-alpine

RUN apk add --no-cache \
    git \
    ffmpeg \
    libwebp-tools \
    python3 \
    make \
    g++

ENV ACTIVATION_KEY=123
ENV BOT_NAME=Abby
ENV TZ=Asia/Kolkata

WORKDIR /abby-bot

COPY package*.json ./

COPY yarn.lock ./

RUN npm install -g --force yarn pm2

RUN yarn install
e
COPY . .

RUN mkdir -p temp

EXPOSE 3000

CMD ["npm", "start"]
