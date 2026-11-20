#!/usr/bin/env bash
# VPS дээр darkhanzar хэрэглэгчээр ажиллана: шинэ кодыг татаж, build хийгээд
# сайтыг тасалдалгүй дахин ачаална. GitHub Actions push бүрт үүнийг дуудна.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> git pull"
git fetch --prune origin main
git reset --hard origin/main

echo "==> npm ci"
npm ci --no-audit --no-fund

echo "==> build"
export NEXT_TELEMETRY_DISABLED=1
npm run build

echo "==> pm2 reload"
if pm2 describe darkhanzar >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

echo "==> Шалгалт"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/; then echo "Сайт ажиллаж байна ($(git rev-parse --short HEAD))."; exit 0; fi
  sleep 2
done
echo "Сайт хариу өгсөнгүй. Лог:"; pm2 logs darkhanzar --lines 50 --nostream; exit 1
