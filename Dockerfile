FROM node:18.17.0
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
COPY ./public/icons ./public/icons
COPY ./manifest.json ./public/manifest.json
COPY ./service-worker.js ./public/service-worker.js
EXPOSE 3000
CMD ["npm", "start"]