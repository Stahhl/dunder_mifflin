FROM node:20-alpine AS build

WORKDIR /app
COPY package.json /app/package.json
RUN npm install

COPY . /app
RUN npm run build:web

FROM node:20-alpine

WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist /app/dist

ENV APP_PORT=3004
EXPOSE 3004

CMD ["serve", "-s", "dist", "-l", "3004"]
