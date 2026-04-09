#!/bin/sh

node /app/server/index.js &
NODE_PID=$!

_term() {
    nginx -s quit 2>/dev/null
    kill "$NODE_PID" 2>/dev/null
    wait "$NODE_PID" 2>/dev/null
    exit 0
}
trap _term TERM INT

sleep 0.5
nginx -g 'daemon off;' &
NGINX_PID=$!

wait "$NGINX_PID" "$NODE_PID"
