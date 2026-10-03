import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'

const base = 'https://www.ahmettunalilar.com'
const sourceUrl = `${base}/dini-e-kitaplar/`
const output = resolve('dist/dini')
await mkdir(`${output}/books`, { recursive: true })
await mkdir(`${output}/covers`, { recursive: true })
const run = promisify(execFile)
async function fetchBytes(url) {
  const { stdout } = await run('curl', ['--fail', '--location', '--retry', '3', '--max-time', '180', '--silent', '--show-error', url], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 })
  return stdout
}
const html = (await fetchBytes(sourceUrl)).toString('utf8')
const document = new JSDOM(html).window.document
const books = []
for (const anchor of document.querySelectorAll('.pageListing.children a')) {
  const title = anchor.querySelector('h3')?.textContent?.trim()
  const href = new URL(anchor.getAttribute('href'), base).href
  const coverUrl = new URL(anchor.querySelector('img').getAttribute('src'), base).href
  if (/\.pdf$/i.test(href)) books.push({ title, sourceUrl: href, coverSourceUrl: coverUrl })
  else {
    const child = new JSDOM((await fetchBytes(href)).toString('utf8')).window.document
    for (const volume of child.querySelectorAll('.pageText a[href]')) {
      const url = new URL(volume.getAttribute('href'), base)
      url.hash = ''
      if (/\.pdf$/i.test(url.pathname)) books.push({ title: volume.textContent.trim(), sourceUrl: url.href, coverSourceUrl: coverUrl })
    }
  }
}
if (books.length !== 30 || new Set(books.map(book => book.sourceUrl)).size !== 30) throw new Error('Kaynakta beklenen 30 benzersiz PDF bulunamadı')
const permission = document.querySelector('.legal')?.textContent?.trim()
if (!permission?.includes('izin almaya gerek kalmadan')) throw new Error('Kaynağın paylaşım izni bulunamadı')
await writeFile(`${output}/source-permission.html`, html)
let index = 0
async function download() {
  while (index < books.length) {
    const book = books[index++]
    const filename = decodeURIComponent(new URL(book.sourceUrl).pathname.split('/').pop()).replace(/\.pdf$/i, '.pdf')
    let bytes
    try { bytes = await readFile(`${output}/books/${filename}`) } catch { bytes = await fetchBytes(book.sourceUrl) }
    if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error(`${book.title}: Geçersiz PDF`)
    await writeFile(`${output}/books/${filename}`, bytes)
    const coverName = filename.replace(/\.pdf$/i, '.webp')
    const cover = await readFile(resolve('artwork/dini', coverName))
    if (cover.toString('ascii', 0, 4) !== 'RIFF' || cover.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Geçersiz kapak: ' + coverName)
    await writeFile(`${output}/covers/${coverName}`, cover)
    const author = filename.startsWith('imam_Gazali') || /ihyau/.test(filename) ? 'İmam Gazali' : filename.startsWith('DurrulMensur') ? 'İmam Süyûtî' : filename.startsWith('Mevlana') ? 'Mevlânâ Celâleddîn-i Rûmî' : filename.startsWith('ibrahim_Hakki') ? 'İbrahim Hakkı Erzurumî' : filename.startsWith('ismail_Hakki') ? 'İsmail Hakkı Bursevî' : filename.startsWith('Futuhul') ? 'Abdülkâdir Geylânî' : filename.startsWith('Mektubat') ? 'İmam Rabbânî' : null
    Object.assign(book, { sourceKey: `ahmet-tunalilar:${filename}`, author, filename, format: 'pdf', packageUrl: `books/${filename}`, coverUrl: `covers/${coverName}`, downloadSize: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), existingIhya: /ihyau/.test(filename) })
    console.log(`${book.title}: ${(bytes.length / 1048576).toFixed(1)} MB`)
  }
}
await Promise.all([download(), download(), download()])
await writeFile(`${output}/catalog.json`, JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), sourceUrl, permission, books }, null, 2))
console.log(`Doğrulandı: ${books.length} PDF, ${books.filter(book => !book.existingIhya).length} yeni kitap/cilt`)
