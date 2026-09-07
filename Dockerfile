FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache git

COPY package.json ./
COPY dist ./dist

CMD ["node", "dist/index.js"]
