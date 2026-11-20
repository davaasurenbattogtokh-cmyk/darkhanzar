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

## Хэрэгтэй командууд (VPS дээр)

```sh
sudo -iu darkhanzar
pm2 status
pm2 logs darkhanzar
bash ~/app/deploy/deploy.sh      # гараар дахин deploy
nano ~/app/.env && pm2 reload darkhanzar --update-env
```

Database backup: `mysqldump darkhanzar > backup-$(date +%F).sql` (root-оор).
