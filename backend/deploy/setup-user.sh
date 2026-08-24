#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/home/ubuntu/daitora-media-library
cd "$APP_DIR"

python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
mkdir -p data/uploads runtime
chmod 700 data data/uploads runtime

if [ ! -f .env ]; then
  umask 077
  SESSION_SECRET="$(openssl rand -hex 32)"
  ADMIN_PASSWORD="$(openssl rand -base64 24)"
  EDITOR_PASSWORD="$(openssl rand -base64 24)"
  UPLOADER_PASSWORD="$(openssl rand -base64 24)"
  printf '%s\n' \
    'DAITORA_DATA_DIR=/home/ubuntu/daitora-media-library/data' \
    'MAX_UPLOAD_BYTES=0' \
    'TOKEN_TTL_SECONDS=604800' \
    'ALLOWED_ORIGINS=https://daitora-vlog-box-prototype.pangvic9.chatgpt.site' \
    "SESSION_SECRET=$SESSION_SECRET" \
    "BOOTSTRAP_ADMIN_PASSWORD=$ADMIN_PASSWORD" \
    "BOOTSTRAP_EDITOR_PASSWORD=$EDITOR_PASSWORD" \
    "BOOTSTRAP_UPLOADER_PASSWORD=$UPLOADER_PASSWORD" > .env
fi

.venv/bin/python -m py_compile app.py
