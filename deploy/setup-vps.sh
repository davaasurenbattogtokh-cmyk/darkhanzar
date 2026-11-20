#!/usr/bin/env bash
# Darkhanzar — Hostinger VPS (Ubuntu 22.04/24.04) анхны тохиргоо.
# root эрхээр НЭГ УДАА ажиллуулна:
#   curl -fsSL https://raw.githubusercontent.com/<OWNER>/darkhanzar/main/deploy/setup-vps.sh -o setup-vps.sh
#   sudo DOMAIN=darkhanzar.mn REPO=https://github.com/<OWNER>/darkhanzar.git ADMIN_EMAIL=you@example.mn bash setup-vps.sh
#   (private repo бол REPO=git@github.com:<OWNER>/darkhanzar.git — deploy key үүсгэнэ)
set -euo pipefail

DOMAIN="${DOMAIN:-darkhanzar.mn}"
REPO="${REPO:?REPO=git@github.com:OWNER/darkhanzar.git гэж өгнө үү}"
ADMIN_EMAIL="${ADMIN_EMAIL:?ADMIN_EMAIL өгнө үү}"
APP_USER="darkhanzar"
APP_DIR="/home/${APP_USER}/app"
DB_NAME="darkhanzar"
DB_USER="darkhanzar"

echo "==> Систем шинэчлэх, багцууд суулгах"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git nginx mysql-server certbot python3-certbot-nginx ufw ca-certificates gnupg openssl

echo "==> Node.js 24"
if ! command -v node >/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "==> Swap (Next.js build-д санах ой хүрэлцүүлэх)"
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Апп хэрэглэгч"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
sudo -H -u "$APP_USER" mkdir -p "/home/${APP_USER}/.ssh"
chmod 700 "/home/${APP_USER}/.ssh"

if [[ "$REPO" == git@* ]]; then
echo "==> GitHub deploy key (private repo-оос татахад)"
KEY="/home/${APP_USER}/.ssh/github_deploy"
if [ ! -f "$KEY" ]; then
  sudo -H -u "$APP_USER" ssh-keygen -t ed25519 -N "" -C "darkhanzar-vps-deploy" -f "$KEY"
  sudo -H -u "$APP_USER" tee "/home/${APP_USER}/.ssh/config" >/dev/null <<EOF
Host github.com
  IdentityFile ${KEY}
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
fi
echo
echo "------------------------------------------------------------------"
echo "GitHub → repo → Settings → Deploy keys → Add deploy key (read-only):"
cat "${KEY}.pub"
echo "------------------------------------------------------------------"
read -r -p "Түлхүүрийг GitHub-д нэмсний дараа Enter дарна уу..." _ </dev/tty
fi

echo "==> GitHub Actions-д зориулсан SSH түлхүүр (push бүрт автомат deploy)"
ACTIONS_KEY="/root/darkhanzar-actions-key"
if [ ! -f "$ACTIONS_KEY" ]; then
  ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f "$ACTIONS_KEY"
  cat "${ACTIONS_KEY}.pub" >> "/home/${APP_USER}/.ssh/authorized_keys"
  chown "${APP_USER}:${APP_USER}" "/home/${APP_USER}/.ssh/authorized_keys"
  chmod 600 "/home/${APP_USER}/.ssh/authorized_keys"
fi
echo "GitHub → repo → Settings → Secrets and variables → Actions:"
echo "  VPS_HOST    = энэ серверийн IP"
echo "  VPS_USER    = ${APP_USER}"
echo "  VPS_SSH_KEY = доорх файлын бүтэн агуулга:  cat ${ACTIONS_KEY}"

echo "==> MySQL database"
DB_PASSWORD_FILE="/root/.darkhanzar-db-password"
[ -f "$DB_PASSWORD_FILE" ] || openssl rand -hex 24 > "$DB_PASSWORD_FILE"
DB_PASSWORD="$(cat "$DB_PASSWORD_FILE")"
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
# Зураг MySQL-д хадгалагддаг тул packet хэмжээг өсгөнө
if ! grep -q max_allowed_packet /etc/mysql/mysql.conf.d/mysqld.cnf; then
  echo "max_allowed_packet = 64M" >> /etc/mysql/mysql.conf.d/mysqld.cnf
  systemctl restart mysql
fi

echo "==> Код татах"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -H -u "$APP_USER" git clone "$REPO" "$APP_DIR"
fi

echo "==> .env үүсгэх"
ENV_FILE="${APP_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
  SETUP_TOKEN="$(openssl rand -hex 24)"
  sudo -H -u "$APP_USER" tee "$ENV_FILE" >/dev/null <<EOF
NODE_ENV=production
PORT=3000
APP_ORIGIN=https://${DOMAIN}
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
ADMIN_EMAIL=${ADMIN_EMAIL}
SETUP_TOKEN=${SETUP_TOKEN}
UNEGUI_SYNC_ENABLED=true
QPAY_ENABLED=false
QPAY_BASE_URL=https://merchant.qpay.mn
QPAY_USERNAME=
QPAY_PASSWORD=
QPAY_INVOICE_CODE=
QPAY_SITE_ORIGIN=https://${DOMAIN}
NEXT_TELEMETRY_DISABLED=1
EOF
  chmod 600 "$ENV_FILE"
  echo "SETUP_TOKEN (/setup хуудсанд оруулна): ${SETUP_TOKEN}"
fi

echo "==> Nginx"
sed "s/__DOMAIN__/${DOMAIN}/g" "${APP_DIR}/deploy/nginx-darkhanzar.conf" > /etc/nginx/sites-available/darkhanzar
ln -sf /etc/nginx/sites-available/darkhanzar /etc/nginx/sites-enabled/darkhanzar
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> deploy хэрэглэгчид pm2-г systemd-д бүртгэх"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" >/dev/null

echo "==> Build + эхлүүлэх"
sudo -H -u "$APP_USER" bash "${APP_DIR}/deploy/deploy.sh"

echo "==> SSL (DNS darkhanzar.mn → энэ VPS-ийн IP болсон байх ёстой)"
if certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
  echo "SSL амжилттай."
else
  echo "SSL одоохондоо амжилтгүй. DNS тархсаны дараа дахин ажиллуулна:"
  echo "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --redirect"
fi

echo
echo "БЭЛЭН. https://${DOMAIN}/setup хаягаар админаа үүсгэнэ."
