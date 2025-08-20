FROM node:22-alpine
RUN apk add --no-cache git ffmpeg libwebp-tools python3 make g++
WORKDIR /app
ENV TZ=Asia/Kolkata
ENV ACTIVATION_KEY=123
ENV BOT_NAME=Abby
ENV PORT=4000
RUN echo '{"name":"abby-bot","version":"1.0.0","main":"index.js","dependencies":{"express":"^4.18.0"},"scripts":{"start":"node index.js"}}' > package.json
RUN echo 'const express=require("express");const app=express();const port=process.env.PORT;app.get("/",(req,res)=>{res.send("Hello from Abby Bot! Activation key: "+process.env.ACTIVATION_KEY)});app.listen(port,()=>{console.log("Abby Bot listening on port",port);console.log("Activation key:",process.env.ACTIVATION_KEY);console.log("Bot name:",process.env.BOT_NAME)})' > index.js
RUN npm install
CMD ["node", "index.js"]
