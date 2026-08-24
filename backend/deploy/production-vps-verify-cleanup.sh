#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/ubuntu/daitora-media-library
WRONG_WEB_ROOT=/var/www/daitora-vlog-box
WRONG_WEB_SITE=/etc/nginx/sites-available/vlog.daitora-jp.com
WRONG_WEB_LINK=/etc/nginx/sites-enabled/vlog.daitora-jp.com

echo "Checking deployed backend..."
"$APP_DIR/.venv/bin/python" -m py_compile "$APP_DIR/app.py" "$APP_DIR/migrations/"*.py
systemctl is-active daitora-vlog-api.service
curl -fsS https://api-vlog.daitora-jp.com/health
echo

echo "Removing the inactive Web copy mistakenly staged on this VPS..."
rm -f -- "$WRONG_WEB_LINK" "$WRONG_WEB_SITE"
if [[ -d "$WRONG_WEB_ROOT" && "$(realpath "$WRONG_WEB_ROOT")" == "$WRONG_WEB_ROOT" ]]; then
    rm -rf -- "$WRONG_WEB_ROOT"
fi

echo "Checking API Nginx and certificate configuration..."
nginx -t
systemctl reload nginx
test -e /etc/nginx/sites-enabled/api-vlog.daitora-jp.com
test -e /etc/letsencrypt/live/api-vlog.daitora-jp.com/fullchain.pem
openssl x509 -in /etc/letsencrypt/live/api-vlog.daitora-jp.com/fullchain.pem -noout -subject -issuer -dates
curl -fsS https://api-vlog.daitora-jp.com/health
echo
echo "VPS backend verification and cleanup completed."
