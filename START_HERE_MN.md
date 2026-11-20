# DARKHANZAR — Бүтэн сайтын эх багц

2026-11-18-нд бэлтгэв.

Энэ ZIP-д frontend, backend, MySQL бүтэц, тохиргооны загвар, тестүүд,
зарын эхний snapshot болон лого, фонт, зураг зэрэг 1,715 asset багтсан.
Зургууд public/ дотор шууд нээгдэх байдлаар, build-д хэрэгтэй эх багц
asset-bundle/ дотор давхар хадгалагдсан.

## Hostinger Business-д байршуулах

Дэлгэрэнгүй заавар: README.md.

- Node.js 22.13 буюу түүнээс шинэ хувилбар (24.x тохиромжтой).
- Framework: Express / Other. Үндсэн хавтас: package.json байгаа хавтас.
- Install: npm ci
- Build: npm run build
- Entry file: server.js
- Start: npm run start
- MySQL database үүсгэж .env.example дахь хувьсагчуудыг hosting дээр тохируулна.
- Анхны админ үүсгэх: /setup. Дараа нь /login → /admin.

Эхлээд darkhanzar/ хавтсыг задлана. Hosting-ийн үндсэн хавтас дотор
package.json, server.js, server/, src/, public/ зэрэг шууд байрлах ёстой.

## Багцын тухай

node_modules, .next, Git-ийн дотоод түүх болон жинхэнэ нууц түлхүүрүүд
багтаагүй. npm ci, npm run build ажиллуулахад dependencies болон build
шинээр үүснэ. Хувийн хэрэглэгч/session/шууд ажиллаж буй сайтын database
энэ багцад экспортлогдоогүй; эхний зарын snapshot болон анхны тохиргоо бий.

Нэвтрэлт, зарын удирдлага, админ, баннер, үнэ болон төлбөрийн backend
MySQL тохируулсны дараа ажиллана. QPay бодит merchant мэдээлэл шаардана.
Google/Facebook нэвтрэлт, SMS, и-мэйл баталгаажуулалт, нууц үг сэргээх,
бодит хэрэглэгч хоорондын чат хараахан холбогдоогүй. Бусад хязгаарыг README.md-ээс үзнэ.

SHA256SUMS.txt нь багцын файлуудын бүрэн бүтэн байдлыг шалгахад зориулагдсан.
