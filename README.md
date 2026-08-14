# VEXOR Web

VEXOR ERP'nin React, TypeScript ve Vite tabanlı responsive web arayüzüdür. Türkçe, Fransızca ve İngilizceyi; rol bazlı modülleri; merkezi API katmanını ve PWA güncelleme akışını destekler.

## Yerel geliştirme

Node.js 22 gereklidir.

```powershell
npm ci
npm run dev
```

Yerel API proxy ayarı yalnız geliştirme içindir. Production bundle API adresini ortam yapılandırmasından alır; `localhost` veya `127.0.0.1` içermemelidir.

## Kalite kapıları

```powershell
npm run lint
npm test
npm run i18n:check
npm run build
npm run bundle:check
```

Üç dil aynı çeviri anahtarı kümesini korumalıdır. Yeni kullanıcı metinleri sabit string yerine katalog anahtarı kullanmalı; sayılar ve tarihler seçilen locale göre biçimlenmelidir.

## Production

Canlı adres `https://erpvexor.com`, API `https://velora-production-01a9.up.railway.app` adresidir. Deploy yalnız Railway `brave-radiance / production / vexor-web` servisine yapılır. Build sonrası canlı HTML/asset sürümü ve PWA cache yenilenmesi gizli sekmede doğrulanır.

Ek belgeler:

- [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md)
- [I18N_GUIDE.md](I18N_GUIDE.md)
- [PERFORMANCE.md](PERFORMANCE.md)
- [DEVELOPMENT.md](DEVELOPMENT.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)

