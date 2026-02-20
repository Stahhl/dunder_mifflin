FROM node:20-alpine

WORKDIR /app

COPY package.json /app/package.json
RUN npm install --omit=dev

COPY server.mjs /app/server.mjs
COPY src /app/src

ENV SERVER_PORT=8093

EXPOSE 8093

CMD ["node", "src/server.mjs"]
