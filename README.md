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
