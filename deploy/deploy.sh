#!/bin/bash
set -euo pipefail
DB_PASS="$1"
mkdir -p /opt/smarthome-web
# 이전 배포본을 먼저 치운다. 남겨 두면 파일을 옮기거나 지운 변경이 반영되지 않고
# 옛 소스가 같이 빌드된다 (예: 패키지를 옮긴 클래스가 빈 이름 충돌을 일으킴). .env 는 보존.
find /opt/smarthome-web -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +
tar xzf /root/smarthome-web.tgz -C /opt/smarthome-web --strip-components=1 --no-same-owner
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
# 관리자 이메일은 서버 .env 에서 직접 채운다 (공개 저장소에 주소를 넣지 않음)
ensure_env APP_ADMIN_EMAILS ""
ensure_env APP_ADMIN_URL https://iot-admin.kiwan.kr
# 관리자 컨테이너가 사진을 가져올 때 쓰는 내부 키. 없으면 여기서 한 번 만든다.
ensure_env APP_INTERNAL_KEY "$(head -c 24 /dev/urandom | base64 | tr -d '=+/')"
# 사진 판독 키는 서버 .env 에서 직접 채운다 (비어 있으면 규칙 추정만 한다)
ensure_env APP_ANALYSIS_ENABLED true
ensure_env APP_ANALYSIS_API_KEY ""
ensure_env APP_ANALYSIS_PURGE_AFTER true
grep -q 'LANG=' /etc/default/locale 2>/dev/null || echo 'LANG=C.UTF-8' > /etc/default/locale
echo "== build start $(date)"
if ! docker compose build --progress=plain > /var/log/smarthome-build.log 2>&1; then
  echo "BUILD FAILED"; tail -n 80 /var/log/smarthome-build.log; exit 1
fi
echo "== build done $(date)"
# 업로드 볼륨을 처음 만들 때 root 소유로 생기는 경우가 있다(백엔드는 app 계정으로 돈다).
# 이미 맞으면 아무 일도 하지 않는다.
docker compose run --rm --no-deps --user root --entrypoint sh backend -c 'chown -R app:app /data/uploads /data/keys' || true
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
echo "== admin health"; curl -sS http://127.0.0.1:8080/api/health || true; echo
echo "== admin index"; curl -sS -o /dev/null -w "%{http_code} %{size_download}B" http://127.0.0.1:8080/; echo
echo "== catalog"; curl -sS http://127.0.0.1/api/catalog | head -c 200; echo
docker image ls --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -E 'smarthome|postgres|nginx|temurin|maven|node' || true
df -h / | tail -1
echo DEPLOY_DONE
