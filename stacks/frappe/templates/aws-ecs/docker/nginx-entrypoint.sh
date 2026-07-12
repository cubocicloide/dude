#!/usr/bin/env bash
# Entrypoint for the `frontend` role: render the nginx template with the
# runtime coordinates (injected as env vars by the ECS task definition) and
# run nginx in the foreground.
set -euo pipefail

export BACKEND="${BACKEND:-backend:8000}"
export SOCKETIO="${SOCKETIO:-websocket:9000}"
export FRAPPE_SITE_NAME_HEADER="${FRAPPE_SITE_NAME_HEADER:-frontend}"
export PROXY_READ_TIMEOUT="${PROXY_READ_TIMEOUT:-120}"
export CLIENT_MAX_BODY_SIZE="${CLIENT_MAX_BODY_SIZE:-50m}"

envsubst '${BACKEND} ${SOCKETIO} ${FRAPPE_SITE_NAME_HEADER} ${PROXY_READ_TIMEOUT} ${CLIENT_MAX_BODY_SIZE}' \
  </etc/nginx/nginx-template.conf >/tmp/nginx.conf

echo "nginx: proxying to backend=${BACKEND} socketio=${SOCKETIO} site=${FRAPPE_SITE_NAME_HEADER}"
exec nginx -c /tmp/nginx.conf -g 'daemon off;'
