#!/bin/sh

rm node_modules -rf

cd /app

npm update && npm install && npm run build && npm start
