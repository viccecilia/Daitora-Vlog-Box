#!/usr/bin/env bash
set -euo pipefail

SERVICE=daitora-vlog-api.service
cleanup_restart() {
  sudo systemctl start "$SERVICE" || true
}
trap cleanup_restart EXIT

echo "Stopping the Daitora API for a controlled database cleanup..."
sudo systemctl stop "$SERVICE"
python3 /tmp/production-business-cleanup.py --execute
echo "Starting the Daitora API..."
sudo systemctl start "$SERVICE"
trap - EXIT
systemctl is-active "$SERVICE"
curl -fsS https://api-vlog.daitora-jp.com/health
echo
sudo journalctl -u "$SERVICE" -n 30 --no-pager
echo "Controlled business-data cleanup completed."
