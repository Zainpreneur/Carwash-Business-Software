FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

# Sync the Drizzle schema to whatever DATABASE_URL points at, then boot. Safe to run on
# every start — a no-op once the schema is already in sync.
CMD ["sh", "-c", "npx drizzle-kit push --config=drizzle.config.js && node src/server.js"]
