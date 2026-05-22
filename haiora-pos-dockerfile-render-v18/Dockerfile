# Default Dockerfile = API service for Render v19.
# For Web service on Render, set Dockerfile Path to Dockerfile.web.
FROM node:20-alpine AS base
WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

COPY apps/api/package*.json ./
RUN npm install --legacy-peer-deps \
  && npm install prisma@6.19.0 @prisma/client@6.19.0 --save-exact --legacy-peer-deps

COPY apps/api/prisma ./prisma
COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./tsconfig.json

RUN npx prisma@6.19.0 generate

EXPOSE 4000
CMD ["sh", "-c", "npx prisma@6.19.0 db push && npm run db:seed && npx tsx src/index.ts"]
