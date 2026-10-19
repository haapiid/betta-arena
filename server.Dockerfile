# Game server image. Build from the repository root (the server shares game code in src/):
#   docker build -f server.Dockerfile -t betta-arena-server .
FROM node:22-slim
WORKDIR /app
# shared game code needs viem from the root package
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev
COPY src src
COPY server/src server/src
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 8787
CMD ["npx", "tsx", "src/index.ts"]
