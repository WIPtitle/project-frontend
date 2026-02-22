FROM node:18.17.0-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
COPY ./manifest.json ./public/manifest.json
COPY ./service-worker.js ./public/service-worker.js

RUN npm run build

FROM node:18.17.0-alpine

WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.mjs ./

EXPOSE 3000

CMD ["npm", "start"]
