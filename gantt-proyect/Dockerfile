FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_DRIVER=pg
EXPOSE 3000
CMD ["node", "server.js"]
