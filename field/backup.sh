#!/bin/bash
# 세대 HA 설정을 통째로 묶는다. 방문이 끝날 때마다 돌리고, 맥북으로 가져와 보관한다.
#
#   bash backup.sh                    # 미니PC 에서
#   ssh <미니PC> 'bash -s' < backup.sh && scp <미니PC>:/tmp/ha-backup-*.tgz ~/   # 맥북에서
#
# HAOS 의 원클릭 백업을 Docker 구성에서 대신하는 것이다. 자동화·대시보드·기기 등록 정보가
# 전부 /opt/smarthome/ha 안에 있으므로, 미니PC 가 죽어도 새 기계에 풀어 넣으면 그대로 산다.
set -euo pipefail

ROOT=/opt/smarthome
STAMP=$(date +%Y%m%d-%H%M)
OUT="/tmp/ha-backup-$(hostname)-$STAMP.tgz"

[ -d "$ROOT" ] || { echo "$ROOT 가 없다 — setup-ha.sh 를 먼저 돌릴 것"; exit 1; }
cd "$ROOT"

# 컨테이너를 멈추고 뜬다. SQLite 를 쓰는 중에 복사하면 깨진 파일이 나온다.
echo "== 잠시 멈춤"
docker compose stop >/dev/null 2>&1 || true

echo "== 묶는 중"
# 데이터베이스 기록(이력)은 뺀다. 수백 MB 이고 복구에 필요한 것도 아니다.
# 설정·자동화·기기 등록은 .storage 와 *.yaml 에 있다.
tar czf "$OUT" \
  --exclude='ha/home-assistant_v2.db*' \
  --exclude='ha/*.log*' \
  --exclude='ha/tts' \
  --exclude='mosquitto/data' \
  ha matterbridge matterbridge-node docker-compose.yml 2>/dev/null || true

echo "== 다시 기동"
docker compose start >/dev/null 2>&1 || docker compose up -d >/dev/null 2>&1

SIZE=$(du -h "$OUT" | cut -f1)
cat <<EOF

백업 완료
   $OUT  ($SIZE)

맥북으로 가져가기
   scp $(whoami)@$(hostname -I 2>/dev/null | awk '{print $1}'):$OUT ~/Downloads/

새 미니PC 에 복구
   setup-ha.sh 를 먼저 돌린 뒤
   docker compose down && tar xzf <파일> -C /opt/smarthome && docker compose up -d
EOF
