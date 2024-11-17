FROM node:18.17.0
WORKDIR /app
COPY package*.json ./
COPY . .
COPY ./public/icons ./public/icons
COPY ./manifest.json ./public/manifest.json
COPY ./service-worker.js ./public/service-worker.js
COPY entrypoint.sh /entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]