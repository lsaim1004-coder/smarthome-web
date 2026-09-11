#!/bin/bash
set -euo pipefail
DB_PASS="$1"
mkdir -p /opt/smarthome-web
rm -rf /opt/smarthome-web/smarthome-web; tar xzf /root/smarthome-web.tgz -C /opt/smarthome-web --strip-components=1 --no-same-owner
cd /opt/smarthome-web
if [ ! -f .env ]; then printf 'DB_PASSWORD=%s\n' "$DB_PASS" > .env; chmod 600 .env; fi
# 새로 추가된 설정 키는 기본값으로 채운다 (기존 값은 건드리지 않음)
ensure_env() { grep -q "^$1=" .env || echo "$1=$2" >> .env; }
ensure_env APP_BASE_URL https://iot.kiwan.kr
ensure_env APP_MAIL_MODE log
ensure_env APP_MAIL_HOST ""
ensure_env APP_MAIL_PORT 587
ensure_env APP_MAIL_USERNAME ""
ensure_env APP_MAIL_PASSWORD ""
ensure_env APP_MAIL_FROM no-reply@kiwan.kr
ensure_env APP_MAIL_STARTTLS true
grep -q 'LANG=' /etc/default/locale 2>/dev/null || echo 'LANG=C.UTF-8' > /etc/default/locale
echo "== build start $(date)"
if ! docker compose build --progress=plain > /var/log/smarthome-build.log 2>&1; then
  echo "BUILD FAILED"; tail -n 80 /var/log/smarthome-build.log; exit 1
fi
echo "== build done $(date)"
docker compose up -d
echo "== waiting for backend health"
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1; then echo "healthy after $((i*3))s"; break; fi
  sleep 3
done
docker compose ps
echo "== health"; curl -sS http://127.0.0.1/api/health || true; echo
echo "== welcome"; curl -sS http://127.0.0.1/api/welcome || true; echo
echo "== index"; curl -sS -o /dev/null -w '%{http_code} %{size_download}B\n' http://127.0.0.1/
docker image ls --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -E 'smarthome|postgres|nginx|temurin|maven|node' || true
df -h / | tail -1
echo DEPLOY_DONE
