import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const catalog = JSON.parse(
  await readFile(join(dirname(fileURLToPath(import.meta.url)), '../../src/data/generated/catalog.json'), 'utf8'),
)

const focus = catalog.entities.filter((entity) =>
  /tsmc|nvidia|amd|intel|micron|apple|microsoft/i.test(entity.id + entity.name),
)
console.log('focus entities', focus.map((entity) => `${entity.id} | ${entity.name} | ${entity.type} | ${entity.latitude ?? '-'}`))

console.log('\nfacilities')
for (const entity of catalog.entities.filter((item) => item.type === 'facility')) {
  console.log(`- ${entity.name} (${entity.latitude}, ${entity.longitude}) review=${entity.metadata?.reviewFlag ?? false}`)
}

console.log('\nairports/ports')
for (const entity of catalog.entities.filter((item) => item.type === 'airport' || item.type === 'port')) {
  console.log(`- ${entity.type} ${entity.name}`)
}

const byCompany = {}
for (const rel of catalog.relationships.filter((item) => item.type === 'supplies')) {
  byCompany[rel.sourceEntityId] = (byCompany[rel.sourceEntityId] ?? 0) + 1
}
console.log('\ntop suppliers', Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 12))
console.log('operates', catalog.relationships.filter((rel) => rel.type === 'operates'))
