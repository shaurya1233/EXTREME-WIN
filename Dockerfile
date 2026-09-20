FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend
COPY database ./database
COPY .env.example ./
RUN mkdir -p data
EXPOSE 8787
CMD ["node","backend/server.js"]
