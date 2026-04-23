FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p /app/data
ENV NODE_ENV=production
ENV PORT=3000
ENV JWT_SECRET=change_me_in_production
ENV DATABASE_PATH=/app/data/gantt.db
EXPOSE 3000
CMD ["node", "server.js"]
