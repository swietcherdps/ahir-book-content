import { createHash } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const API_BASE = 'https://risale.online/risale-api'
const COVER_BASE = 'https://static-risale.hayrat.dev/mobil-uygulama/eserler'
const OUTPUT_DIR = resolve('dist')
const BATCH_SIZE = 25
const REQUEST_DELAY_MS = 200
const MAX_RETRIES = 4
const AUTHOR = 'Bediüzzaman Said Nursi'
const PUBLISHER = 'Hayrat Neşriyat / Risale Online'

const args = new Set(process.argv.slice(2))
const bookArgIndex = process.argv.indexOf('--book')
const selectedSlug = bookArgIndex >= 0 ? process.argv[bookArgIndex + 1] : null
const ingestAll = args.has('--all')
if (!ingestAll && !selectedSlug) {
  throw new Error('Kullanım: node scripts/ingest.mjs --book sozler | --all')
}

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms))
const sha256 = data => createHash('sha256').update(data).digest('hex')

async function fetchWithRetry(url, responseType = 'json') {
  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'AhirBookContentBuilder/1.0' } })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return responseType === 'arrayBuffer' ? Buffer.from(await response.arrayBuffer()) : response.json()
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES) await sleep(300 * (2 ** (attempt - 1)))
    }
  }
  throw new Error(`${url} alınamadı: ${lastError?.message || lastError}`)
}

const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)
const allowedTags = ['div', 'p', 'span', 'strong', 'em', 'b', 'i', 'sup', 'sub', 'br', 'blockquote']
const allowedAttributes = [
  'class', 'dir', 'lang', 'role', 'tabindex',
  'data-paragraf-id', 'data-eser-id', 'data-sayfa', 'data-sira',
  'data-kelime-tur', 'data-hasiye-no', 'data-lugat-id',
  'data-lugat-latince-kelime', 'data-lugat-latince-mana',
  'data-mehaz-id', 'data-mehaz-metin', 'data-mehaz-latince-meal',
  'data-mehaz-latince-kaynak', 'data-latince', 'data-latince-ust-bilgi'
]

function sanitizeHtml(html) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style']
  })
  const container = window.document.createElement('div')
  container.innerHTML = clean
  container.querySelectorAll('[data-lugat-latince-mana], [data-mehaz-id], [data-latince], [data-latince-ust-bilgi]').forEach(element => {
    element.setAttribute('tabindex', '0')
    element.setAttribute('role', 'button')
    element.setAttribute('aria-label', `${element.textContent?.trim() || 'Kelime'} açıklamasını göster`)
  })
  return container.innerHTML
}

function plainTextFromHtml(html) {
  const container = window.document.createElement('div')
  container.innerHTML = html
  return (container.textContent || '').replace(/\s+/g, ' ').trim()
}

async function ingestBook(book) {
  console.log(`${book.latince}: ${book.sayfa_sayisi} sayfa alınıyor...`)
  const paragraphsById = new Map()
  for (let first = 1; first <= book.sayfa_sayisi; first += BATCH_SIZE) {
    const last = Math.min(book.sayfa_sayisi, first + BATCH_SIZE - 1)
    const url = `${API_BASE}/paragraf?eserid=${book.id}&ilksayfa=${first}&sonsayfa=${last}&yazi=latince`
    const paragraphs = await fetchWithRetry(url)
    if (!Array.isArray(paragraphs)) throw new Error(`${book.slug}: paragraf yanıtı dizi değil`)
    for (const paragraph of paragraphs) {
      if (!paragraphsById.has(paragraph.id)) paragraphsById.set(paragraph.id, paragraph)
    }
    process.stdout.write(`  ${last}/${book.sayfa_sayisi}\r`)
    await sleep(REQUEST_DELAY_MS)
  }
  process.stdout.write('\n')

  const grouped = new Map()
  for (const paragraph of paragraphsById.values()) {
    if (!grouped.has(paragraph.sayfa)) grouped.set(paragraph.sayfa, [])
    grouped.get(paragraph.sayfa).push(paragraph)
  }

  const pages = []
  let glossaryCount = 0
  let citationCount = 0
  for (let pageNumber = 1; pageNumber <= book.sayfa_sayisi; pageNumber += 1) {
    const paragraphs = grouped.get(pageNumber) || []
    // Sanitize once per page. This keeps paragraph order/metadata intact and avoids
    // constructing thousands of redundant DOM trees on full-catalog builds.
    const html = sanitizeHtml(paragraphs.map(paragraph => paragraph.latince_html || '').join(''))
    glossaryCount += (html.match(/data-lugat-latince-mana=/g) || []).length
    citationCount += (html.match(/data-mehaz-id=/g) || []).length
    pages.push({
      pageNumber,
      html,
      plainText: plainTextFromHtml(html),
      sourceParagraphIds: paragraphs.map(paragraph => paragraph.id)
    })
  }

  if (pages.length !== book.sayfa_sayisi) throw new Error(`${book.slug}: sayfa sayısı doğrulanamadı`)
  if (glossaryCount === 0) throw new Error(`${book.slug}: lügat verisi bulunamadı`)

  const toc = await fetchWithRetry(`${API_BASE}/fihrist?eserid=${book.id}`)
  if (!Array.isArray(toc) || toc.length === 0) throw new Error(`${book.slug}: fihrist bulunamadı`)

  const revisionSeed = JSON.stringify({ sourceId: book.id, pageCount: book.sayfa_sayisi, toc, pages })
  const version = `1-${sha256(revisionSeed).slice(0, 12)}`
  const pkg = {
    schemaVersion: 1,
    source: {
      name: 'Risale Online',
      url: `https://risale.online/oku/${book.slug}?tip=latince`,
      publisher: PUBLISHER
    },
    book: {
      sourceKey: `risale-online:${book.id}`,
      sourceId: book.id,
      slug: book.slug,
      title: book.latince,
      author: AUTHOR,
      pageCount: book.sayfa_sayisi,
      version
    },
    toc,
    pages
  }
  const canonical = Buffer.from(JSON.stringify(pkg))
  const compressed = gzipSync(canonical, { level: 9, mtime: 0 })
  const relativePackagePath = `books/${book.slug}/${version}.json.gz`
  const packagePath = resolve(OUTPUT_DIR, relativePackagePath)
  await mkdir(dirname(packagePath), { recursive: true })
  await writeFile(packagePath, compressed)

  const cover = await fetchWithRetry(`${COVER_BASE}/${String(book.id).padStart(2, '0')}.webp`, 'arrayBuffer')
  const relativeCoverPath = `covers/${book.slug}.webp`
  const coverPath = resolve(OUTPUT_DIR, relativeCoverPath)
  await mkdir(dirname(coverPath), { recursive: true })
  await writeFile(coverPath, cover)

  console.log(`  ${paragraphsById.size} paragraf, ${glossaryCount} lügat, ${citationCount} kaynak, ${(compressed.length / 1048576).toFixed(2)} MiB`)
  return {
    sourceKey: `risale-online:${book.id}`,
    sourceId: book.id,
    slug: book.slug,
    title: book.latince,
    author: AUTHOR,
    pageCount: book.sayfa_sayisi,
    version,
    downloadSize: compressed.length,
    sha256: sha256(compressed),
    packageUrl: `./${relativePackagePath}`,
    coverUrl: `./${relativeCoverPath}`,
    sourceUrl: `https://risale.online/oku/${book.slug}?tip=latince`
  }
}

await rm(OUTPUT_DIR, { recursive: true, force: true })
await mkdir(OUTPUT_DIR, { recursive: true })
const books = await fetchWithRetry(`${API_BASE}/eserler`)
const selectedBooks = books
  .filter(book => book.metin_var_mi && (ingestAll || book.slug === selectedSlug))
  .sort((left, right) => left.sira - right.sira || left.id - right.id)
if (selectedBooks.length === 0) throw new Error('İstenen kitap bulunamadı')

const catalogBooks = []
for (const book of selectedBooks) catalogBooks.push(await ingestBook(book))
const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'https://risale.online/oku?tip=latince',
  books: catalogBooks
}
await writeFile(resolve(OUTPUT_DIR, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)
await writeFile(resolve(OUTPUT_DIR, 'build-report.json'), `${JSON.stringify({
  generatedAt: catalog.generatedAt,
  books: catalogBooks.map(book => ({
    sourceKey: book.sourceKey,
    pageCount: book.pageCount,
    downloadSize: book.downloadSize,
    sha256: book.sha256
  }))
}, null, 2)}\n`)
console.log(`${catalogBooks.length} kitap paketi hazır: ${OUTPUT_DIR}`)
