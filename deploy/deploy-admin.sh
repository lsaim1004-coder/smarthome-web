#!/bin/bash
# 관리자 서버 배포 (LXC 112 · iot-admin.kiwan.kr).
# 공개 서버와 같은 저장소 묶음을 풀고 docker-compose.admin.yml 로만 띄운다.
set -euo pipefail
DB_PASS="$1"      # 공개 서버(LXC 111)의 PostgreSQL 비밀번호
DB_HOST="$2"      # 공개 서버 LAN 주소
INTERNAL_KEY="$3" # 사진 통로 공유 키 (공개 서버와 같은 값)

mkdir -p /opt/smarthome-admin
# 이전 배포본을 먼저 치운다. 옛 소스가 같이 빌드되면 안 된다. .env 는 보존.
find /opt/smarthome-admin -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +
tar xzf /root/smarthome-web.tgz -C /opt/smarthome-admin --strip-components=1 --no-same-owner
cd /opt/smarthome-admin

if [ ! -f .env ]; then touch .env; chmod 600 .env; fi
ensure_env() { grep -q "^$1=" .env || printf '%s=%s\n' "$1" "$2" >> .env; }
ensure_env DB_PASSWORD "$DB_PASS"
ensure_env DB_HOST "$DB_HOST"
ensure_env APP_INTERNAL_KEY "$INTERNAL_KEY"
ensure_env APP_PUBLIC_API_URL "http://$DB_HOST:8081"
ensure_env APP_BASE_URL https://iot.kiwan.kr
ensure_env APP_ADMIN_URL https://iot-admin.kiwan.kr
ensure_env APP_MAIL_MODE log
ensure_env APP_MAIL_HOST ""
ensure_env APP_MAIL_PORT 587
ensure_env APP_MAIL_USERNAME ""
ensure_env APP_MAIL_PASSWORD ""
ensure_env APP_MAIL_FROM no-reply@kiwan.kr
ensure_env APP_MAIL_STARTTLS true
# 운영자 이메일은 서버 .env 에서 직접 채운다 (공개 저장소에 주소를 넣지 않음)
ensure_env APP_ADMIN_EMAILS ""
grep -q 'LANG=' /etc/default/locale 2>/dev/null || echo 'LANG=C.UTF-8' > /etc/default/locale

echo "== build start $(date)"
if ! docker compose -f docker-compose.admin.yml build --progress=plain > /var/log/smarthome-admin-build.log 2>&1; then
  echo "BUILD FAILED"; tail -n 80 /var/log/smarthome-admin-build.log; exit 1
fi
echo "== build done $(date)"
docker compose -f docker-compose.admin.yml up -d

echo "== waiting for admin api health"
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1; then echo "healthy after $((i*3))s"; break; fi
  sleep 3
done
docker compose -f docker-compose.admin.yml ps
echo "== health"; curl -sS http://127.0.0.1/api/health || true; echo
echo "== me (미로그인이면 authenticated:false)"; curl -sS http://127.0.0.1/api/auth/me || true; echo
echo "== index"; curl -sS -o /dev/null -w '%{http_code} %{size_download}B\n' http://127.0.0.1/
df -h / | tail -1
echo DEPLOY_DONE
