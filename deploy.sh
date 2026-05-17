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

BRANCH="${BRANCH:-main}"
SERVICE_RESTART="${SERVICE_RESTART:-systemctl restart vibestonks}"
DB_PATH="${VIBESTONKS_DB_PATH:-./.data/db.sqlite}"

step() { echo ""; echo "→ $*"; }

cd "$(dirname "$0")"

if [ "${SKIP_PULL:-0}" != "1" ]; then
  step "[1/5] Pulling latest from $BRANCH"
  git fetch origin
  git reset --hard "origin/$BRANCH"
fi

step "[2/5] Installing dependencies"
npm ci

if [ -f "$DB_PATH" ]; then
  BACKUP="${DB_PATH}.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$DB_PATH" "$BACKUP"
  echo "  ↳ DB backed up: $BACKUP"
fi

step "[3/5] Applying DB migrations"
npm run db:migrate

step "[4/5] Building Next.js"
npm run build

step "[5/5] Restarting service"
$SERVICE_RESTART

echo ""
echo "✓ Deploy complete"
