import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const catalog = JSON.parse(await readFile('dist/dini/catalog.json', 'utf8'))
if (catalog.books.length !== 30 || new Set(catalog.books.map(book => book.sourceKey)).size !== 30) throw new Error('30 benzersiz kitap gerekli')
for (const book of catalog.books) {
  const bytes = await readFile(`dist/dini/${book.packageUrl}`)
  if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error(`Geçersiz PDF: ${book.title}`)
  if (bytes.length !== book.downloadSize || createHash('sha256').update(bytes).digest('hex') !== book.sha256) throw new Error(`Hash/boyut hatası: ${book.title}`)
  const cover = await readFile(`dist/dini/${book.coverUrl}`)
  if (cover.length < 1000 || cover.toString('ascii', 0, 4) !== 'RIFF' || cover.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`Kapak eksik: ${book.title}`)
}
console.log('30 PDF ve 30 kapak doğrulandı; hiçbir kitap kapaksız değil.')
