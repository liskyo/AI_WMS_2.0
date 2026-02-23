FROM node:18-alpine

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package.json files
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies - Server
WORKDIR /app/server
# CRITICAL: Remove lockfile to force Linux-compatible install
RUN rm -f package-lock.json
RUN npm install

# Install dependencies - Client
WORKDIR /app/client
# CRITICAL: Remove lockfile to force Linux-compatible install
RUN rm -f package-lock.json
RUN npm install

# Copy source code
WORKDIR /app
COPY server/ ./server/
COPY client/ ./client/

# Build client
WORKDIR /app/client
RUN npm run build

# Expose ports
EXPOSE 3000
EXPOSE 5173

# Start command (Note: docker-compose overrides this)
WORKDIR /app/server
CMD ["npm", "start"]
