FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN npx tsc

EXPOSE 10000

CMD ["node", "dist/index.js"]
