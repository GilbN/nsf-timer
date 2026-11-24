FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.js ./
USER node
# Must match internal_port in fly.toml
EXPOSE 8080
CMD ["node", "index.js"]
