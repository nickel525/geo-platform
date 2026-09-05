import { readFile } from 'node:fs/promises'

const catalog = JSON.parse(await readFile('src/data/generated/catalog.json', 'utf8'))

const tsmc = catalog.entities.find((entity) => entity.id === 'company:tsmc')
const intel = catalog.entities.find((entity) => entity.id === 'company:intel')
if (!tsmc || !intel) throw new Error('Focus companies missing')

const supplies = catalog.relationships.filter(
  (rel) => rel.type === 'supplies' && rel.sourceEntityId === 'company:tsmc',
)
const operates = catalog.relationships.filter(
  (rel) => rel.type === 'operates' && rel.sourceEntityId === 'company:tsmc',
)
if (supplies.length === 0) throw new Error('TSMC has no disclosed supplies edges')
if (operates.length === 0) throw new Error('TSMC has no OSM operates edges')

const hsinchu = catalog.entities.filter((entity) => {
  if (entity.latitude == null) return false
  return (
    entity.latitude >= 24.75 &&
    entity.latitude <= 24.84 &&
    entity.longitude >= 120.96 &&
    entity.longitude <= 121.08
  )
})
if (hsinchu.length === 0) throw new Error('No mapped entities in Hsinchu AOI')

const evidence = supplies[0].evidence?.[0]
if (!evidence?.sourceRecordId) throw new Error('10-K evidence missing accession')

const nvidiaSupplies = catalog.relationships.filter(
  (rel) => rel.type === 'supplies' && rel.sourceEntityId === 'company:nvidia',
)
if (!nvidiaSupplies.some((rel) => rel.evidence?.some((item) => item.sourceType === 'sectivia'))) {
  throw new Error('NVIDIA missing Sectivia evidence')
}

console.log(
  JSON.stringify(
    {
      tsmcSupplies: supplies.length,
      tsmcOperates: operates.length,
      nvidiaSupplies: nvidiaSupplies.length,
      hsinchuEntities: hsinchu.map((entity) => entity.name),
      sampleEvidence: evidence,
    },
    null,
    2,
  ),
)
