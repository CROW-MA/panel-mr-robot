# Bot WhatsApp
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production
RUN npm install -g typescript ts-node
RUN npm install --save-dev @types/node

COPY . .

RUN npm run build

EXPOSE 3300

CMD ["node", "dist/index.js"]
