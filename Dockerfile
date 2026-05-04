FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY public ./public
COPY src ./src
COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
