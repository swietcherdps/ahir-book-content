# Ahir Book Content

Ahir Book için sürümlü, sıkıştırılmış uzaktan içerik paketleri üretir. Bu depo uygulama kodundan ayrıdır; uygulama yalnız `catalog.json` ve kullanıcının seçtiği kitap paketini indirir.

## Yerel pilot

```bash
npm install
npm run ingest:sozler
npm run verify
```

Çıktılar `dist/catalog.json`, `dist/books/...json.gz` ve `dist/covers/...webp` altında oluşur. Uygulamayı yerel katalogla denemek için:

```bash
VITE_CONTENT_CATALOG_URL=http://localhost:4174/catalog.json npm run dev
```

Başka bir terminalde `dist` klasörünü CORS destekli statik bir sunucuyla `4174` portunda servis edin.

Latin ve Osmanlıca koleksiyonları üretip 44 kitaplık kataloğu doğrulamak için:

```bash
npm run ingest:all
npm run verify:all
```

## Yayın güvenlik kapısı

Bu araç içerik hak sahibinin izni olmadan yayın yapmaz. `npm run publish:check` çalıştırılmadan önce `CONTENT_LICENSE_FILE` değişkeni, yazılı yeniden dağıtım izninin yerel dosya yoluna ayarlanmalıdır. İzin belgesi depoya eklenmemelidir.

GitHub Pages iş akışı elle başlatılır ve depo sırrı olarak `CONTENT_LICENSE_TEXT` bulunmadığı sürece içerik oluşturma/yayınlama adımına geçmez.

## Ahmet Tunalılar dini kitapları

`npm run ingest:dini`, kaynak sayfadaki 30 PDF'yi (Ed-Dürrü'l-Mensûr'un 15 cildi dahil) ve kapaklarını `dist/dini/` altında indirir. PDF başlıklarını, dosya boyutlarını ve SHA-256 değerlerini doğrular; uygulama kataloğu yalnız metadata içerir. İhyâ mevcut uygulama kaydında tutulur, 29 yeni kitap/cilt eklenir.

Kaynak: https://www.ahmettunalilar.com/dini-e-kitaplar/

Sayfanın kendi yayınladığı izin metni katalogda ve kaynak sayfanın kopyasında saklanır. Bu işlem Risale izin koşullarını değiştirmez. Yayın iş akışında `collection=dini`, mevcut 44 Risale paketini SHA-256 ile doğrulayarak korur ve yalnız yeni dini kitapları ekler. `all` mevcut izin kontrolünden sonra iki koleksiyonu üretir.
