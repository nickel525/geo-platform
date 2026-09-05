import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

import { buildOverpassQuery } from './adapters/osm.mjs'
import { filterSampoqCsv } from './adapters/sampoq.mjs'
import { emptyOshCollection, oshSearchUrls } from './adapters/opensupplyhub.mjs'
import {
  COMPANY_PROFILES,
  OSM_REGIONS,
  OVERPASS_URL,
  OSH_API_URL,
  SAMPOQ_CSV_URL,
} from './config.mjs'

const root = dirname(fileURLToPath(import.meta.url))
export const RAW_DIR = join(root, 'raw')

export const PATHS = {
  sampoqFull: join(RAW_DIR, 'sampoq-supply-chain.csv'),
  sampoqSlice: join(RAW_DIR, 'sampoq-semiconductor.csv'),
  osh: join(RAW_DIR, 'opensupplyhub-sample.geojson'),
  osm: join(RAW_DIR, 'osm-overpass.json'),
  sectivia: join(RAW_DIR, 'sectivia-supply-chain.json'),
}

export async function ensureRawSources({ refresh = false } = {}) {
  await mkdir(RAW_DIR, { recursive: true })

  if (refresh || !(await exists(PATHS.sampoqSlice))) {
    const csv = await loadSampoqCsv(refresh)
    const { rows, csv: slice } = filterSampoqCsv(csv)
    await writeFile(PATHS.sampoqSlice, slice, 'utf8')
    console.log(`Sampoq semiconductor slice: ${rows.length} rows`)
  } else {
    console.log('Using existing Sampoq semiconductor slice')
  }

  if (refresh || !(await exists(PATHS.osm))) {
    const query = buildOverpassQuery(OSM_REGIONS)
    const json = await postOverpass(query)
    await writeFile(PATHS.osm, JSON.stringify(json), 'utf8')
    console.log(`OSM Overpass elements: ${json.elements?.length ?? 0}`)
  } else {
    console.log('Using existing OSM Overpass extract')
  }

  if (!(await exists(PATHS.osh))) {
    const live = await fetchOshIfTokenized()
    await writeFile(PATHS.osh, JSON.stringify(live ?? emptyOshCollection(), null, 2), 'utf8')
    console.log(
      live
        ? `Open Supply Hub features: ${live.features?.length ?? 0}`
        : 'Open Supply Hub: no token; wrote empty sample adapter input',
    )
  } else {
    console.log('Using existing Open Supply Hub sample')
  }

  if (!(await exists(PATHS.sectivia))) {
    const downloaded = join(homedir(), 'Downloads', 'sectivia-supply-chain.json')
    if (await exists(downloaded)) {
      await copyFile(downloaded, PATHS.sectivia)
      console.log('Copied Sectivia graph from Downloads')
    } else {
      throw new Error(
        `Missing ${PATHS.sectivia}. Place sectivia-supply-chain.json in scripts/ingest/raw/`,
      )
    }
  } else {
    console.log('Using existing Sectivia supply-chain graph')
  }
}

async function loadSampoqCsv(refresh) {
  if (!refresh && (await exists(PATHS.sampoqFull))) {
    return readFile(PATHS.sampoqFull, 'utf8')
  }
  console.log(`Downloading ${SAMPOQ_CSV_URL}`)
  const response = await fetch(SAMPOQ_CSV_URL, {
    headers: { 'User-Agent': 'ATLAS-dev-ingest/0.1' },
  })
  if (!response.ok) {
    throw new Error(`Sampoq download failed: ${response.status}`)
  }
  const csv = await response.text()
  await writeFile(PATHS.sampoqFull, csv, 'utf8')
  return csv
}

async function postOverpass(query) {
  console.log(`Querying Overpass (${OVERPASS_URL})`)
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ATLAS-dev-ingest/0.1',
    },
    body: new URLSearchParams({ data: query }),
  })
  if (!response.ok) {
    throw new Error(`Overpass failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

async function fetchOshIfTokenized() {
  const token = process.env.OSH_API_TOKEN
  if (!token) return null

  const features = []
  for (const url of oshSearchUrls(COMPANY_PROFILES)) {
    const response = await fetch(url.startsWith('http') ? url : `${OSH_API_URL}?q=TSMC`, {
      headers: { Authorization: `Token ${token}`, 'User-Agent': 'ATLAS-dev-ingest/0.1' },
    })
    if (!response.ok) {
      console.warn(`OSH fetch ${url} failed: ${response.status}`)
      continue
    }
    const body = await response.json()
    features.push(...(body.features ?? []))
  }
  return { type: 'FeatureCollection', features }
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
