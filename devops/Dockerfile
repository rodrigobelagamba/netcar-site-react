# syntax=docker/dockerfile:1

FROM node:20-alpine AS client-builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY client ./client
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache git openssh-client tar
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=client-builder /app/client/dist ./client/dist

RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3090
ENV WORKSPACE_ROOT=/workspace

EXPOSE 3090
ENTRYPOINT ["/app/docker-entrypoint.sh"]
