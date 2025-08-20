FROM node:22-alpine

RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++

WORKDIR /app

ENV TZ=Asia/Kolkata
ENV ACTIVATION_KEY=123
ENV BOT_NAME=Abby

RUN echo '{"name":"abby-bot","version":"1.0.0","main":"index.js","dependencies":{},"scripts":{"start":"node index.js"}}' > package.json

RUN echo 'console.log("Abby Bot started with activation key:", process.env.ACTIVATION_KEY);' > index.js
RUN echo 'console.log("Bot name:", process.env.BOT_NAME);' >> index.js
RUN echo 'console.log("Bot is ready and waiting...");' >> index.js
RUN echo 'setInterval(() => {}, 1000);' >> index.js

CMD ["node", "index.js"]
