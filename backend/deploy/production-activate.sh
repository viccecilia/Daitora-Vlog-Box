#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/ubuntu/daitora-media-library
STAGE_DIR=/home/ubuntu/daitora-vlog-release

install -d -o ubuntu -g ubuntu "$APP_DIR/migrations"
install -m 0644 "$STAGE_DIR/backend/app.py" "$APP_DIR/app.py"
install -m 0644 "$STAGE_DIR/backend/requirements.txt" "$APP_DIR/requirements.txt"
install -m 0644 "$STAGE_DIR/backend/migrations/"*.py "$APP_DIR/migrations/"

"$APP_DIR/.venv/bin/pip" install -r "$APP_DIR/requirements.txt"
"$APP_DIR/.venv/bin/python" -m py_compile "$APP_DIR/app.py" "$APP_DIR/migrations/"*.py
systemctl restart daitora-vlog-api.service
systemctl is-active daitora-vlog-api.service
nginx -t
curl -fsS https://api-vlog.daitora-jp.com/health
