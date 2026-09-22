#!/bin/bash
# 현장에서 막혔을 때 상태를 한 장으로 요약한다. 이 출력을 Claude 에게 그대로 보여주면 된다.
#
#   bash collect.sh              # 미니PC 에서 직접
#   ssh <미니PC> 'bash -s' < collect.sh   # 맥북에서
#
# 로그를 통째로 붙여넣는 것보다 이게 빠르다 — 무엇을 봐야 하는지 이미 골라 놨다.
set -uo pipefail

ROOT=/opt/smarthome
line() { printf '\n── %s\n' "$1"; }

echo "현장 상태 요약  $(date '+%Y-%m-%d %H:%M')"

line "이 PC"
echo "   호스트  $(hostname)"
echo "   IP      $(hostname -I 2>/dev/null | tr ' ' '\n' | grep -v '^$' | paste -sd' ')"
echo "   메모리  $(free -m | awk '/^Mem:/{printf "%dMB 중 %dMB 사용", $2, $3}')"
echo "   디스크  $(df -h / | awk 'NR==2{print $3" / "$2" ("$5")"}')"
echo "   가동    $(uptime -p 2>/dev/null || uptime)"

line "컨테이너"
if command -v docker >/dev/null 2>&1; then
  docker ps -a --format '   {{.Names}}  {{.Image}}  {{.Status}}' 2>/dev/null || echo "   docker 응답 없음"
else
  echo "   도커가 없다 — setup-ha.sh 를 먼저 돌릴 것"
fi

line "HA 응답"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8123/ 2>/dev/null)
case "$code" in
  200|302) echo "   $code — 정상" ;;
  000)     echo "   응답 없음 — 컨테이너가 죽었거나 아직 뜨는 중" ;;
  *)       echo "   $code" ;;
esac

line "인터넷·이름 해석"
ping -c1 -W2 1.1.1.1 >/dev/null 2>&1 && echo "   외부 연결 OK" || echo "   외부 연결 실패 — 공유기 랜선 확인"
getent hosts github.com >/dev/null 2>&1 && echo "   DNS OK" || echo "   DNS 실패"

line "USB 동글 (Zigbee/Thread)"
if ls /dev/serial/by-id/* >/dev/null 2>&1; then
  ls /dev/serial/by-id/ | sed 's/^/   /'
else
  echo "   없음"
fi

line "Wi-Fi 대역 (2.4GHz 가 보이는지)"
# Matter·Zigbee 온보딩은 2.4GHz 를 요구한다. 통신사 공유기가 대역 통합이면 여기서 막힌다.
if command -v iwlist >/dev/null 2>&1; then
  iwlist scan 2>/dev/null | grep -E 'ESSID|Frequency' | paste - - | grep -i '2\.4\|2412\|2437\|2462' | head -5 | sed 's/^/   /' || echo "   스캔 결과 없음(유선 연결이면 정상)"
else
  echo "   iwlist 없음 — 유선으로 붙였으면 확인 불필요"
fi

line "최근 오류 (HA)"
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q homeassistant; then
  hits=$(docker logs --tail 400 homeassistant 2>&1 \
    | grep -iE '\b(error|critical|failed|refused|timeout)\b' \
    | tail -12 | cut -c1-160 || true)
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits" | sed 's/^/   /'
  else
    echo "   오류 없음"
  fi
else
  echo "   homeassistant 컨테이너가 없다"
fi

line "다음에 할 일"
cat <<'EOF'
   컨테이너가 죽어 있으면   cd /opt/smarthome && docker compose up -d
   HA 만 다시 띄우려면      docker compose restart homeassistant
   그래도 안 되면 위 내용을 Claude 에게 그대로 보여줄 것
EOF
