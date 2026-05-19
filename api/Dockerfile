# API
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Instalar dependencias y tipos de Node/Express
RUN npm install
RUN npm install -g typescript ts-node
RUN npm install --save-dev @types/node @types/jsonwebtoken @types/bcrypt

COPY . .

# Compilar TypeScript
RUN npm run build

EXPOSE 3100

CMD ["node", "dist/index.js"]
