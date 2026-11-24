# Stage 1: Build the Svelte frontend
FROM node:24-alpine AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Final image. nginx serves static files, Node runs the WS relay.
FROM nginx:alpine
# Alpine's nodejs package is the current LTS. Fail the build if it drops below 24.
RUN apk add --no-cache nodejs \
 && node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"

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
  CMD wget -qO /dev/null http://127.0.0.1:80/ && wget -qO /dev/null http://127.0.0.1:8080/healthz || exit 1

# nginx:alpine sets STOPSIGNAL SIGQUIT, which docker-start.sh does not trap
STOPSIGNAL SIGTERM
CMD ["/docker-start.sh"]
