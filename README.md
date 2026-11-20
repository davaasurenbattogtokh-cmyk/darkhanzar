# Darkhanzar

Дархан-Уул, Сүхбаатар хот, Хөтөлийн зарын платформ. **Hostinger Business-д зориулсан Next.js + Express + MySQL хувилбар.**

## Боломжууд

- 15 үндсэн ангилал, 830 ангиллын зангилаа, ангиллаас хамаарах дэлгэрэнгүй үзүүлэлт, хайлт, байршил болон үнийн шүүлтүүр.
- Зургийн галерей, хадгалсан зар, гар утасны таван товчтой навигац.
- И-мэйл, нууц үгээр бүртгүүлэх/нэвтрэх, серверийн session; зар нэмэх, засах, хаах, админы хяналт.
- Баннерын 3 байрлал, 15 зар тутмын солигдох баннер, онцгой зарын ангилал тус бүрийн үнэ.
- QPay нэхэмжлэх, серверийн төлбөр баталгаажуулалт, онцгой хугацааны автомат дуусалт. Давхардсан хүсэлт нэг нэхэмжлэхийг ашиглана.
- Unegui-ийн нийтийн зарын индекс, бодит үзүүлэлт ба эх сурвалжийн холбоос. Сервер ажиллаж байгаа үед Улаанбаатарын цагаар 08:00-аас хойш тухайн өдрийн шинэчлэл эхэлнэ. Амжилтгүй шинэчлэл өмнөх бүрэн мэдээллийг хадгална.

## Hostinger Business дээр байршуулах

GitHub репозитор: https://github.com/davaasurenbattogtokh-cmyk/darkhanzar

1. Hostinger → Websites → Create site → Web App → Import your Git repository.
2. `darkhanzar` репозитор, `main` салбарыг сонгоно. GitHub push бүрээр шинэчлэгдэх автомат deployment-ийг идэвхжүүлнэ.
3. Build тохиргоо:

| Талбар | Утга |
| --- | --- |
| Framework preset | Express эсвэл Other |
| Node.js | 24.x эсвэл хамгийн багадаа 22.13 |
| Root directory | Репозиторын үндсэн хавтас |
| Package manager | npm |
| Install | npm ci |
| Build command | npm run build |
| Entry file | server.js |
| Start command харагдвал | npm run start |

`server.js` нь API, MySQL, session болон Next.js хуудсуудыг хамт ажиллуулна. Иймээс Next.js-ийн автоматаар санал болгосон `next start` командыг ашиглавал backend ажиллахгүй. `output: standalone` тохиргоо энэ custom server-т тохирохгүй. Deployment-д репозиторын `server/`, `config/`, `public/`, `node_modules/`, `.next/` болон `server.js` хамт хэрэгтэй; зөвхөн `.next` хавтсыг дангаар нь байршуулахгүй.

4. Hostinger дээр MySQL database болон хэрэглэгч үүсгэж, дараах environment variables-ийг оруулна. `.env.example` нь хоосон загвар; жинхэнэ нууц утгууд GitHub-д орохгүй.

| Variable | Утга |
| --- | --- |
| NODE_ENV | production |
| APP_ORIGIN | Сайтын HTTPS үндсэн хаяг, жишээ нь https://your-domain.mn |
| DB_HOST | 127.0.0.1 — Hostinger-ийн дотоод MySQL холболт; localhost гэж оруулахгүй |
| DB_PORT | 3306 буюу Hostinger-оос өгсөн порт |
| DB_NAME | Үүсгэсэн database-ийн бүтэн нэр |
| DB_USER | Database хэрэглэгчийн бүтэн нэр |
| DB_PASSWORD | Database нууц үг |
| ADMIN_EMAIL | Эзэмшигчийн и-мэйл |
| SETUP_TOKEN | Дор хаяж 32 тэмдэгттэй санамсаргүй нууц түлхүүр |
| UNEGUI_SYNC_ENABLED | true эсвэл false |
| QPAY_ENABLED | Холболтоо дуусгах хүртэл false |

`PORT`-ыг hosting өөрөө онооно. Database холболт эхлэх үед шаардлагатай хүснэгтүүд автоматаар үүснэ. `config/initial-settings.json` нь зөвхөн анхны тохиргоог үүсгэнэ; дараагийн deployment админы хадгалсан баннер, үнэ, зар, хэрэглэгчийг дарахгүй. Зураг болон шинэчилсэн зарын snapshot MySQL-д хадгалагдана; database-ийн хэмжээ, packet limit-ийг hosting дээр шалгана. Unegui зураг кешлэгдэх тул database ашиглалтыг хянана.

5. Deploy хийж, `/setup` хуудаст `SETUP_TOKEN`, `ADMIN_EMAIL`, нэр, шинэ нууц үгээ оруулан админыг анх үүсгэнэ. Дараа нь `SETUP_TOKEN`-ыг environment-оос устгаад redeploy хийнэ. Цаашид `/login` → `/admin` замаар нэвтэрнэ. Нууц үг 12–128 тэмдэгт; сервер scrypt hash хадгална.
6. Нүүр, зарын зураг, `/login`, `/admin`, зар илгээх/зөвшөөрөх, баннер хадгалахыг шалгана. Бодит домэйнд шилжвэл `APP_ORIGIN` болон QPay-ийн буцах хаягийг хамт шинэчилнэ.

## QPay холбох

Environment-д дараах утгуудыг merchant гэрээний бодит мэдээллээр тохируулна:

- `QPAY_ENABLED=true`
- `QPAY_BASE_URL=https://merchant.qpay.mn` эсвэл албан sandbox origin
- `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE`
- `QPAY_SITE_ORIGIN` — `APP_ORIGIN`-той ижил HTTPS origin

Админ → Зар, төлбөр → холболт шалгах. Нийтлэгдсэн өөрийн зар → Миний зарууд → Онцгой болгох. Үнэ, хоногийг серверийн тохиргооноос авна. Provider-оос PAID, MNT, зөв invoice болон дүнг баталгаажуулсны дараа л онцгой идэвхжинэ. Merchant холболт, бодит төлбөрийг Hostinger дээр тусад нь баталгаажуулна. Тодорхойгүй нэхэмжлэх автоматаар дахин үүсэхгүй; админд шалгуулах төлөвт хадгалагдана.

## Хөгжүүлэлт ба шалгалт

Node.js 22.13+ болон MySQL 8.x / түүнтэй нийцтэй сервер шаардлагатай.

```sh
npm ci
cp .env.example .env
# .env дотор орон нутгийн database тохиргоо, APP_ORIGIN=http://localhost:3000 оруулна.
# Хөгжүүлэлтэд NODE_ENV=development, UNEGUI_SYNC_ENABLED=false тохируулна.
npm run build
npm run dev
```

`npm run build` нь checksum-тай `asset-bundle/` багцаас баталсан лого, фонт, 1,715 зураг/asset-ийг сэргээж Next.js production build хийнэ. Шинэ clone-д зураг хэрэгтэй тестийн өмнө `node scripts/restore-assets.mjs` ажиллуулна.

```sh
npm run check:secrets
npm test
npm run typecheck
npm run build
npm run test:mysql
```

MySQL интеграцын тест зөвхөн нэр нь `_test`-ээр төгссөн **тусдаа хоосон database** дээр ажиллана. Тест тухайн database-ийн fixture хүснэгтүүдийг цэвэрлэдэг тул production database-ийг хэзээ ч заахгүй. `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` тохируулж ажиллуулна. GitHub Actions нь тусдаа MySQL 8.4 service дээр эдгээр шалгалтыг хийдэг. QPay тестүүд provider-ийн fixture ашигладаг; бодит төлбөр үүсгэхгүй.

## Одоогийн хязгаар

- Google/Facebook нэвтрэлт, SMS, и-мэйл баталгаажуулалт, нууц үг сэргээх болон бодит хэрэглэгч хоорондын чат хараахан холбогдоогүй.
- Browser-local туршилтын зар, хадгалсан зар, жишээ хэрэглэгч нь серверийн бүртгэлээс тусдаа. Туршилтын эрх төлбөр үүсгэх, админ болох эрх олгохгүй.
- Жишээ зарын эзэмшигч/99999999 нь туршилтын мэдээлэл. Импортын эх зарын холбоос хадгалагдана; эх сурвалжид байхгүй үзүүлэлтийг бодит мэт таамаглахгүй.
- Өмнөх hosted хувилбарын хэрэглэгч/session/бодит зарын database-ийг автоматаар шилжүүлэхгүй. Багцад эхний зарын snapshot болон анхны тохиргоо бий.
- Hostinger орчин дахь бодит ажиллагаа, MySQL quota, scheduler uptime, merchant төлбөрийг deployment-ийн дараа баталгаажуулна.
- SEO index одоогоор хаалттай (`robots: noindex, nofollow`); албан домэйн, жишээ контентын тохиргоо дууссаны дараа нээнэ.

Брэнд: баталсан 01A лого, Nunito/Nunito Sans, #101C45 / #F28B16 / #FFF5E8.

Hostinger-ийн албан заавар:
- https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/
