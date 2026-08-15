#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/ubuntu/daitora-media-library
ALLOWED_ORIGINS_VALUE='https://daitora-vlog-box-prototype.pangvic9.chatgpt.site,https://vlog.daitora-jp.com,http://127.0.0.1:4173,http://localhost:4173'

sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${ALLOWED_ORIGINS_VALUE}|" "$APP_DIR/.env"
"$APP_DIR/.venv/bin/python" -m py_compile "$APP_DIR/app.py"
test -s "$APP_DIR/app.py"

old_pid="$(systemctl show -p MainPID --value daitora-vlog-api)"
kill "$old_pid"
sleep 4
systemctl is-active daitora-vlog-api
new_pid="$(systemctl show -p MainPID --value daitora-vlog-api)"
test "$new_pid" != "$old_pid"
ss -lnt | grep 18772
curl -fsS https://api-vlog.daitora-jp.com/health
curl -sS -o /dev/null -D - -X OPTIONS \
  https://api-vlog.daitora-jp.com/v1/auth/login \
  -H 'Origin: http://127.0.0.1:4173' \
  -H 'Access-Control-Request-Method: POST' \
  | grep -i 'access-control-allow-origin: http://127.0.0.1:4173'

if journalctl -u daitora-vlog-api -n 30 --no-pager | grep -E 'Traceback|ERROR'; then
  exit 1
fi
