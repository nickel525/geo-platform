import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

import { buildOverpassQuery } from './adapters/osm.mjs'
import { filterSampoqCsv } from './adapters/sampoq.mjs'
import {
  collectionFromOshCsv,
  emptyOshCollection,
  isPlaceholderOsh,
  oshSearchQueries,
} from './adapters/opensupplyhub.mjs'
import {
  COMPANY_PROFILES,
  OSM_REGIONS,
  OVERPASS_URL,
  OSH_API_URL,
  OSH_PAGE_LIMIT,
  SAMPOQ_CSV_URL,
} from './config.mjs'

const root = dirname(fileURLToPath(import.meta.url))
export const RAW_DIR = join(root, 'raw')

export const PATHS = {
  sampoqFull: join(RAW_DIR, 'sampoq-supply-chain.csv'),
  sampoqSlice: join(RAW_DIR, 'sampoq-semiconductor.csv'),
  osh: join(RAW_DIR, 'opensupplyhub-sample.geojson'),
  oshCsv: join(RAW_DIR, 'opensupplyhub.csv'),
  osm: join(RAW_DIR, 'osm-overpass.json'),
  sectivia: join(RAW_DIR, 'sectivia-supply-chain.json'),
}

export async function ensureRawSources({ refresh = false } = {}) {
  await loadLocalEnv()
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

  await ensureOshSource(refresh)

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

async function ensureOshSource(refresh) {
  if (await exists(PATHS.oshCsv)) {
    const collection = collectionFromOshCsv(await readFile(PATHS.oshCsv, 'utf8'))
    await writeFile(PATHS.osh, JSON.stringify(collection, null, 2), 'utf8')
    console.log(`Open Supply Hub CSV export: ${collection.features.length} rows`)
    return
  }

  const existing = (await exists(PATHS.osh))
    ? JSON.parse(await readFile(PATHS.osh, 'utf8'))
    : null
  const token = process.env.OSH_API_TOKEN?.trim()
  const shouldFetch = Boolean(token) && (refresh || !existing || isPlaceholderOsh(existing))

  if (shouldFetch) {
    const live = await fetchOshApi(token)
    await writeFile(PATHS.osh, JSON.stringify(live, null, 2), 'utf8')
    console.log(`Open Supply Hub API features: ${live.features.length}`)
    return
  }

  if (existing) {
    console.log(
      isPlaceholderOsh(existing)
        ? oshSetupHint()
        : `Using existing Open Supply Hub extract (${existing.features.length} features)`,
    )
    return
  }

  await writeFile(PATHS.osh, JSON.stringify(emptyOshCollection(), null, 2), 'utf8')
  console.log(oshSetupHint())
}

async function fetchOshApi(token) {
  const byId = new Map()
  for (const query of oshSearchQueries(COMPANY_PROFILES)) {
    for (let page = 1; page <= OSH_PAGE_LIMIT; page += 1) {
      const url = new URL(OSH_API_URL)
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
      url.searchParams.set('page', String(page))
      url.searchParams.set('pageSize', '50')
      url.searchParams.set('number_of_public_contributors', 'true')
      const response = await fetch(url, {
        headers: {
          Authorization: `Token ${token}`,
          'User-Agent': 'ATLAS-dev-ingest/0.1',
        },
      })
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Open Supply Hub rejected the API token (${response.status}). Check OSH_API_TOKEN.`,
        )
      }
      if (!response.ok) {
        console.warn(`OSH ${url} failed: ${response.status}`)
        break
      }
      const body = await response.json()
      for (const feature of body.features ?? []) {
        const id = feature.id || feature.properties?.os_id
        if (id) byId.set(String(id), feature)
      }
      if (!body.next || (body.features?.length ?? 0) === 0) break
      await wait(200)
    }
  }
  return { type: 'FeatureCollection', features: [...byId.values()] }
}

function oshSetupHint() {
  return [
    'Open Supply Hub: no facilities yet.',
    'Free path: create an account at https://opensupplyhub.org, search Electronics or Foxconn, download CSV, save as scripts/ingest/raw/opensupplyhub.csv',
    'API path: My Account > Settings > API token (trial/subscription), set OSH_API_TOKEN, then npm run ingest -- --refresh',
  ].join('\n')
}

async function loadLocalEnv() {
  const candidates = [
    join(root, '../../.env'),
    join(root, '../.env'),
    join(root, '.env'),
  ]
  for (const path of candidates) {
    if (!(await exists(path))) continue
    const text = await readFile(path, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^OSH_API_TOKEN=(.*)$/)
      if (!match || process.env.OSH_API_TOKEN) continue
      process.env.OSH_API_TOKEN = match[1].trim().replace(/^["']|["']$/g, '')
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
