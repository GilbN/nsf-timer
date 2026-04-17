# Stage 1: Build the Svelte frontend
FROM node:25-alpine AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Final image — nginx serves static files, Node runs WS relay
FROM nginx:alpine
RUN apk add --no-cache nodejs

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN apk add --no-cache npm && npm ci --omit=dev && apk del npm
COPY server/index.js ./

COPY docker-start.sh /docker-start.sh
RUN chmod +x /docker-start.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://localhost:80/ || exit 1

CMD ["/docker-start.sh"]
