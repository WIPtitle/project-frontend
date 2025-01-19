#!/bin/sh

cd /app

npm install && npm install hls.js@1.5.19 && npm run build && npm start
