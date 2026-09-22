#!/bin/bash
# 세대용 스마트홈 서버를 만든다. **집에서 미리** 돌린다 — 고객 집에서 돌리는 스크립트가 아니다.
#
#   sudo bash setup-ha.sh
#
# 끝나면 http://<이 PC IP>:8123 에 HA 온보딩 화면이 뜬다. 그 상태로 들고 가서 꽂으면 된다.
# 이미지를 미리 받아 두는 것이 이 스크립트의 핵심이다. 고객 집 인터넷이 느리면
# 컨테이너 내려받기만 20분이 걸리고, 그 시간은 전부 고객이 지켜보는 시간이다.
set -euo pipefail

ROOT=/opt/smarthome
BRANCH="${BRANCH:-main}"
RAW="https://raw.githubusercontent.com/lsaim1004-coder/smarthome-web/${BRANCH}/field"

say() { printf '\n== %s\n' "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "sudo 로 실행하세요"; exit 1; }

say "1/5 도커 설치"
if command -v docker >/dev/null 2>&1; then
  echo "   이미 있음 $(docker --version)"
else
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends ca-certificates curl gnupg avahi-daemon >/dev/null
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # dpkg 가 알려주는 아키텍처를 쓴다 — amd64 로 박아 두면 ARM 미니PC 에서 깨진다
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null 2>&1
fi

say "2/5 폴더 준비"
mkdir -p "$ROOT"/{ha,matterbridge,matterbridge-node,mosquitto/config,mosquitto/data}
cd "$ROOT"
if [ ! -f mosquitto/config/mosquitto.conf ]; then
  # 집 안에서만 쓰는 버스라 인증 없이 두되, 포트를 밖으로 열지 않는다(compose 에서 호스트 바인딩만).
  cat > mosquitto/config/mosquitto.conf <<'CONF'
listener 1883
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
CONF
fi

say "3/5 compose 파일 받기"
if [ -f docker-compose.yml ]; then
  echo "   이미 있음 — 덮어쓰지 않는다"
else
  curl -fsSL "$RAW/docker-compose.yml" -o docker-compose.yml
fi

say "4/5 이미지 내려받기 (여기서 시간이 걸린다 — 집에서 끝내는 이유)"
docker compose pull

say "5/5 기동"
docker compose up -d
sleep 5
docker compose ps --format '   {{.Name}}  {{.Image}}  {{.Status}}'

# USB 동글이 꽂혀 있으면 HA 설정에 쓸 경로를 알려 준다. 현장에서 찾으면 오래 걸린다.
say "USB 동글"
if ls /dev/serial/by-id/* >/dev/null 2>&1; then
  ls -l /dev/serial/by-id/ | sed 's/^/   /'
  echo "   ↑ HA 에서 Zigbee/Thread 설정할 때 이 경로를 쓴다"
else
  echo "   못 찾음 — Zigbee/Thread 를 쓸 세대면 동글을 꽂고 다시 확인할 것"
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
cat <<EOF

────────────────────────────────────────
준비 끝. 브라우저에서 열어 온보딩까지 해 둔다.

   http://${IP:-<이 PC IP>}:8123

이 상태로 들고 가서 고객 공유기에 랜선으로 꽂으면 된다.
현장에서는 계정 연동 · 기기 페어링 · 자동화만 하면 된다.
────────────────────────────────────────
EOF
