#!/usr/bin/env bash
# vibestonks 자체 호스팅 배포 스크립트.
#
# 가정:
#   - 서버에 git clone 돼 있는 디렉토리에서 실행
#   - VIBESTONKS_DB_PATH, AUTH_SECRET, OAuth 시크릿 등은 systemd EnvironmentFile
#     (/etc/vibestonks.env)이나 .env.local에 이미 설정됨
#   - 서비스가 systemd로 관리됨 (다른 매니저 쓰면 SERVICE_RESTART 환경변수로 덮어쓰기)
#
# 사용:
#   ./deploy.sh                      # main 최신 배포
#   BRANCH=experimental ./deploy.sh  # 다른 브랜치
#   SERVICE_RESTART="pm2 restart vibestonks" ./deploy.sh
#   SKIP_PULL=1 ./deploy.sh          # git pull 건너뛰기 (이미 수동 체크아웃했을 때)

set -euo pipefail

step() { echo ""; echo "→ $*"; }

cd "$(dirname "$0")"

# systemd가 쓰는 EnvironmentFile이 있으면 VIBESTONKS_DB_PATH 등을 가져온다
# (대화형 셸에서 deploy.sh 직접 실행 시에도 같은 경로 쓰기 위해)
if [ -f /etc/vibestonks.env ]; then
  set -a
  . /etc/vibestonks.env
  set +a
fi

BRANCH="${BRANCH:-main}"
SERVICE_RESTART="${SERVICE_RESTART:-systemctl restart vibestonks}"
DB_PATH="${VIBESTONKS_DB_PATH:-./.data/db.sqlite}"

if [ "${SKIP_PULL:-0}" != "1" ]; then
  step "[1/5] Pulling latest from $BRANCH"
  git fetch origin
  git reset --hard "origin/$BRANCH"
fi

step "[2/5] Installing dependencies"
npm ci

step "[3/5] Applying DB migrations"
# drizzle-kit이 DB 파일은 만들어주지만 부모 디렉토리는 만들지 않음 — 미리 보장
mkdir -p "$(dirname "$DB_PATH")"
if [ -f "$DB_PATH" ]; then
  BACKUP="${DB_PATH}.bak-$(date +%Y%m%d-%H%M%S).gz"
  gzip -c "$DB_PATH" > "$BACKUP"
  echo "  ↳ DB backed up: $BACKUP"

  # 최근 N개만 유지, 나머지 삭제
  KEEP="${BACKUP_KEEP:-10}"
  DB_DIR=$(dirname "$DB_PATH")
  DB_NAME=$(basename "$DB_PATH")
  # shellcheck disable=SC2012
  ls -1t "$DB_DIR/$DB_NAME".bak-*.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$old"
    echo "  ↳ Pruned: $old"
  done
  # 압축 안 된 옛 백업(.bak-*) 정리
  rm -f "$DB_DIR/$DB_NAME".bak-[0-9]*[0-9]
fi
npm run db:migrate

step "[4/5] Building Next.js"
npm run build

step "[5/5] Restarting service"
$SERVICE_RESTART

echo ""
echo "✓ Deploy complete"
