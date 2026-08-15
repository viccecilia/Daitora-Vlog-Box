#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/ubuntu/daitora-media-library
install -m 0644 "$APP_DIR/deploy/daitora-vlog-api.service" /etc/systemd/system/daitora-vlog-api.service
install -m 0644 "$APP_DIR/deploy/nginx-api-vlog.conf" /etc/nginx/sites-available/api-vlog.daitora-jp.com
ln -sfn /etc/nginx/sites-available/api-vlog.daitora-jp.com /etc/nginx/sites-enabled/api-vlog.daitora-jp.com

nginx -t
systemctl daemon-reload
systemctl enable --now daitora-vlog-api.service
systemctl reload nginx
sleep 2
systemctl is-active daitora-vlog-api.service
curl -fsS http://127.0.0.1:18772/health
curl -fsS -H 'Host: api-vlog.daitora-jp.com' http://127.0.0.1/health

certbot --nginx --non-interactive --agree-tos --redirect -d api-vlog.daitora-jp.com
nginx -t
systemctl reload nginx

