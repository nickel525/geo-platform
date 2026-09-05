import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ingestOpenSupplyHub } from './adapters/opensupplyhub.mjs'
import { ingestOsm } from './adapters/osm.mjs'
import { ingestSampoq } from './adapters/sampoq.mjs'
import { ingestSectivia } from './adapters/sectivia.mjs'
import { COMPANY_PROFILES } from './config.mjs'
import { csvObjects } from './lib/csv.mjs'
import { createCatalogBuilder } from './lib/catalog.mjs'
import { ensureRawSources, PATHS } from './fetch.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = join(root, '../../src/data/generated')

const refresh = process.argv.includes('--refresh')

await ensureRawSources({ refresh })

const sampoqRows = csvObjects(await readFile(PATHS.sampoqSlice, 'utf8'))
const osh = JSON.parse(await readFile(PATHS.osh, 'utf8'))
const osm = JSON.parse(await readFile(PATHS.osm, 'utf8'))
const sectivia = JSON.parse(await readFile(PATHS.sectivia, 'utf8'))

const catalog = createCatalogBuilder()

const sampoqStats = ingestSampoq(sampoqRows, catalog, COMPANY_PROFILES)
const oshStats = ingestOpenSupplyHub(osh, catalog, COMPANY_PROFILES)
const osmStats = ingestOsm(osm, catalog, COMPANY_PROFILES)
const sectiviaStats = ingestSectivia(sectivia, catalog, COMPANY_PROFILES)

const output = catalog.toJSON()
output.sources = {
  sampoq: {
    dataset: 'SAMPOQ/supply-chain-10k',
    license: 'CC BY 4.0',
    attribution: 'Sampoq — https://www.sampoq.com',
    rowsIngested: sampoqStats.rows,
  },
  sectivia: {
    dataset: sectivia.name || 'Sectivia U.S. supply-chain graph',
    license: sectivia.license || 'CC BY 4.0',
    attribution: sectivia.attribution || 'Sectivia',
    url: sectivia.url || 'https://sectivia.com/dataset/',
    caveat: sectivia.caveat,
    companiesIngested: sectiviaStats.companies,
    relationsIngested: sectiviaStats.relations,
  },
  openSupplyHub: {
    dataset: 'Open Supply Hub facilities GeoJSON',
    featuresIngested: oshStats.facilities,
    linkedToCompanies: oshStats.linked,
  },
  openStreetMap: {
    dataset: 'OpenStreetMap Overpass extract',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    ...osmStats,
  },
}

await mkdir(outDir, { recursive: true })
await writeFile(join(outDir, 'catalog.json'), JSON.stringify(output, null, 2), 'utf8')

const manifest = {
  generatedAt: output.generatedAt,
  entityCount: output.entities.length,
  relationshipCount: output.relationships.length,
  byType: countBy(output.entities, 'type'),
  relationshipTypes: countBy(output.relationships, 'type'),
  sources: output.sources,
}

await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
console.log(JSON.stringify(manifest, null, 2))

function countBy(items, key) {
  const counts = {}
  for (const item of items) {
    const value = item[key] ?? 'unknown'
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}
