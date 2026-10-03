import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'

const run = promisify(execFile)
const base = 'https://swietcherdps.github.io/ahir-book-content/'
const root = resolve('dist')
async function fetchBytes(url) {
  const { stdout } = await run('curl', ['--fail', '--location', '--retry', '3', '--silent', '--show-error', '--max-time', '120', url], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  return stdout
}
async function save(reference, expectedHash) {
  const url = new URL(reference, base)
  if (!url.href.startsWith(base)) throw new Error('Beklenmeyen içerik sunucusu')
  const file = resolve(root, decodeURIComponent(url.pathname.slice(new URL(base).pathname.length)))
  if (!file.startsWith(`${root}/`)) throw new Error('Geçersiz içerik yolu')
  const bytes = await fetchBytes(url.href)
  if (expectedHash && createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new Error('Mevcut içerik doğrulanamadı')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, bytes)
  return bytes
}
const bytes = await save('catalog.json')
const catalog = JSON.parse(bytes.toString())
if (catalog.schemaVersion !== 1 || catalog.books.length !== 44) throw new Error('Mevcut 44 Risale kitabı korunamadı')
for (const book of catalog.books) {
  await save(book.packageUrl, book.sha256)
  if (book.coverUrl) {
    const key = book.slug.replace(/-osmanlica$/, '').replace(/emirdag-lahikasi-\d+/, 'emirdag-lahikasi')
    const cover = await readFile(resolve('artwork/risale', `${key}.webp`))
    const file = resolve(root, book.coverUrl.replace(/^\.\//, ''))
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, cover)
  }
}
console.log(`Mevcut ${catalog.books.length} kitap ve kapakları hash doğrulamasıyla korundu.`)
