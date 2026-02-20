FROM node:20-alpine

WORKDIR /app

COPY server.mjs /app/server.mjs

ENV SERVER_PORT=8093

EXPOSE 8093

CMD ["node", "server.mjs"]
