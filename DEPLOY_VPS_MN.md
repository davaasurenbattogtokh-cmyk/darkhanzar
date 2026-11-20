# darkhanzar.mn — Hostinger VPS дээр байршуулах

Бүтэц: **Ubuntu VPS → Nginx (SSL) → pm2 → server.js (Express + Next.js) → MySQL 8**.
Шинэчлэл: компьютер дээрээ засна → GitHub-д push → GitHub Actions шалгалт хийнэ →
амжилттай бол VPS руу SSH-ээр орж `deploy/deploy.sh` ажиллуулна (git pull, build, pm2 reload).

## 1. DNS (домэйн бүртгэгч дээр)

| Төрөл | Нэр | Утга |
| --- | --- | --- |
| A | @ | VPS-ийн IPv4 |
| A | www | VPS-ийн IPv4 |

## 2. VPS-ийн анхны тохиргоо (нэг удаа)

hPanel → VPS → OS: **Ubuntu 24.04** (хоосон). Терминалаас:

```sh
ssh root@VPS_IP
curl -fsSL https://raw.githubusercontent.com/OWNER/darkhanzar/main/deploy/setup-vps.sh -o setup-vps.sh
DOMAIN=darkhanzar.mn REPO=git@github.com:OWNER/darkhanzar.git ADMIN_EMAIL=you@example.mn bash setup-vps.sh
```

Repo private бол `curl`-ийн оронд файлыг `scp deploy/setup-vps.sh root@VPS_IP:` гэж хуулна.

Скрипт дунд нь:
1. **Deploy key** хэвлэнэ → GitHub → repo → Settings → Deploy keys → Add (read-only) → Enter.
2. GitHub Actions-ийн түлхүүрийн байршлыг хэвлэнэ → `cat /root/darkhanzar-actions-key` гаргаад
   GitHub → Settings → Secrets and variables → Actions-д нэмнэ:
   - `VPS_HOST` = VPS IP
   - `VPS_USER` = `darkhanzar`
   - `VPS_SSH_KEY` = файлын бүтэн агуулга
3. `SETUP_TOKEN` хэвлэнэ → `https://darkhanzar.mn/setup` дээр админ үүсгэхэд хэрэглэнэ.
   Дараа нь `/home/darkhanzar/app/.env`-ээс `SETUP_TOKEN` мөрийг устгаад `pm2 reload darkhanzar`.

## 3. Өдөр тутмын шинэчлэл

```sh
git add -A
git commit -m "Юу өөрчилснөө бичнэ"
git push
```

GitHub → Actions таб дээр **Check Darkhanzar** → **Deploy to VPS** ногоон болбол сайт шинэчлэгдсэн.
Шалгалт унавал deploy хийгдэхгүй (эвдэрсэн код production руу орохгүй).

## Google-ээр нэвтрэх

1. https://console.cloud.google.com → төсөл → **Google Auth Platform** (OAuth consent screen): External, апп нэр `Darkhanzar`, домэйн `darkhanzar.mn`, scope: `openid`, `email`, `profile`. **Publish app** (In production).
2. **Clients → Create client → Web application**:
   - Authorized JavaScript origins: `https://darkhanzar.mn`
   - Authorized redirect URIs: `https://darkhanzar.mn/api/auth/google/callback`
3. VPS дээр `nano /home/darkhanzar/app/.env`:
   ```
   GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
   дараа нь `sudo -iu darkhanzar pm2 reload darkhanzar --update-env`.

Хоёр утга тохирсон үед л товч идэвхжинэ. Ижил баталгаажсан и-мэйлтэй бүртгэл байвал түүгээр нэвтэрнэ; шинэ хэрэглэгчид энгийн (user) эрхтэй үүснэ. Админ бүртгэлийг Google-ээр шинээр үүсгэх боломжгүй (зөвхөн /setup).

## Facebook-ээр нэвтрэх

1. https://developers.facebook.com/apps → **Create app** → Use case: **Authenticate and request data from users with Facebook Login** → апп нэр `Darkhanzar`.
2. Facebook Login → Settings → **Valid OAuth Redirect URIs**: `https://darkhanzar.mn/api/auth/facebook/callback`. Permissions: `public_profile`, `email`.
3. App settings → Basic: App domains `darkhanzar.mn`, Privacy Policy URL `https://darkhanzar.mn/privacy`, Terms `https://darkhanzar.mn/terms`, User data deletion → Data deletion instructions URL `https://darkhanzar.mn/privacy#delete`, ангилал, 1024×1024 icon. Дараа нь **Publish** (Live).
4. VPS `.env`: `FACEBOOK_APP_ID=` (тоо), `FACEBOOK_APP_SECRET=` (32 тэмдэгт) → `sudo -iu darkhanzar pm2 reload darkhanzar --update-env`.

Facebook бүртгэлийг Facebook ID-аар холбоно. Тухайн и-мэйлээр өөр бүртгэл байвал Facebook-ээр түүнд нэвтрүүлэхгүй (и-мэйл/Google-ээр нэвтэрнэ).

## Хэрэгтэй командууд (VPS дээр)

```sh
sudo -iu darkhanzar
pm2 status
pm2 logs darkhanzar
bash ~/app/deploy/deploy.sh      # гараар дахин deploy
nano ~/app/.env && pm2 reload darkhanzar --update-env
```

Database backup: `mysqldump darkhanzar > backup-$(date +%F).sql` (root-оор).
