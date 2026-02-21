FROM node:20-alpine AS build

WORKDIR /app
COPY package.json /app/package.json
RUN npm install

COPY . /app
RUN npm run build

FROM node:20-alpine

WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist /app/dist

ENV APP_PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "serve -s dist -l ${APP_PORT:-3000}"]
