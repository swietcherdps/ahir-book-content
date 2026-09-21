import { access, readFile } from 'node:fs/promises'

const permissionFile = process.env.CONTENT_LICENSE_FILE
if (!permissionFile) {
  throw new Error('Yayın durduruldu: CONTENT_LICENSE_FILE tanımlı değil.')
}

await access(permissionFile)
const permission = await readFile(permissionFile, 'utf8')
if (permission.trim().length < 20) {
  throw new Error('Yayın durduruldu: izin belgesi boş veya geçersiz.')
}

console.log('Yazılı izin belgesi bulundu. Yayın adımı çalıştırılabilir.')
