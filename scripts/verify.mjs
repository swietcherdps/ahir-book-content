import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'

const sha256 = data => createHash('sha256').update(data).digest('hex')
const catalog = JSON.parse(await readFile(resolve('dist/catalog.json'), 'utf8'))
if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.books) || catalog.books.length === 0) {
  throw new Error('Katalog geçersiz')
}

const expectedIndex = process.argv.indexOf('--expected')
if (expectedIndex >= 0) {
  const expected = Number(process.argv[expectedIndex + 1])
  if (catalog.books.length !== expected) {
    throw new Error(`Katalogda ${catalog.books.length} kitap var; ${expected} bekleniyordu`)
  }
}

const sourceKeys = new Set(catalog.books.map(book => book.sourceKey))
const slugs = new Set(catalog.books.map(book => book.slug))
if (sourceKeys.size !== catalog.books.length || slugs.size !== catalog.books.length) {
  throw new Error('Katalogda mükerrer kitap bulundu')
}

for (const book of catalog.books) {
  const packagePath = resolve('dist', book.packageUrl.replace(/^\.\//, ''))
  const compressed = await readFile(packagePath)
  if (compressed.length !== book.downloadSize) throw new Error(`${book.slug}: boyut uyuşmuyor`)
  if (sha256(compressed) !== book.sha256) throw new Error(`${book.slug}: SHA-256 uyuşmuyor`)
  const pkg = JSON.parse(gunzipSync(compressed).toString('utf8'))
  if (pkg.book.sourceKey !== book.sourceKey || pkg.book.version !== book.version) {
    throw new Error(`${book.slug}: paket metadata uyuşmuyor`)
  }
  if (!['latince', 'osmanlica'].includes(book.writingType) || pkg.book.writingType !== book.writingType) {
    throw new Error(`${book.slug}: yazı türü metadata uyuşmuyor`)
  }
  if (pkg.pages.length !== book.pageCount) throw new Error(`${book.slug}: eksik sayfa`)
  const pageNumbers = new Set(pkg.pages.map(page => page.pageNumber))
  if (pageNumbers.size !== book.pageCount) throw new Error(`${book.slug}: tekrarlı sayfa`)
  for (let pageNumber = 1; pageNumber <= book.pageCount; pageNumber += 1) {
    if (!pageNumbers.has(pageNumber)) throw new Error(`${book.slug}: ${pageNumber}. sayfa eksik`)
  }
  if (!pkg.pages.some(page => page.html.includes('data-lugat-latince-mana'))) {
    throw new Error(`${book.slug}: lügat alanı yok`)
  }
  if (book.writingType === 'osmanlica' && !pkg.pages.some(page => page.html.includes('OsmanlicaStandart'))) {
    throw new Error(`${book.slug}: Osmanlıca sınıfları korunmamış`)
  }
  if (pkg.pages.some(page => /<script|\son[a-z]+\s*=|<iframe/i.test(page.html))) {
    throw new Error(`${book.slug}: güvensiz HTML bulundu`)
  }
  const coverPath = resolve('dist', book.coverUrl.replace(/^\.\//, ''))
  const cover = await readFile(coverPath)
  if (cover.length < 1024 || cover.subarray(0, 4).toString('ascii') !== 'RIFF' || cover.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error(`${book.slug}: kapak geçerli WebP değil`)
  }
  console.log(`${book.title}: doğrulandı (${book.pageCount} sayfa, ${(compressed.length / 1048576).toFixed(2)} MiB)`)
}
