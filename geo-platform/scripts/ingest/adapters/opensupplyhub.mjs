import { createResolver } from '../lib/resolve.mjs'
import { csvObjects } from '../lib/csv.mjs'

const ELECTRONICS_TEXT =
  /\b(electronics?|semiconductor|foundry|wafer|chip|pcb|printed circuit|computer|smartphone|handset|server|notebook|laptop|display|ems|odm|assembly|foxconn|hon hai|pegatron|wistron|luxshare|quanta|compal|inventec|jabil|flex|amkor|tsmc|intel|micron|hynix|samsung|nvidia)\b/i

/**
 * Open Supply Hub facilities GeoJSON (API or exported search).
 * Facilities stay separate from companies. `operates` is created only on
 * exact alias / ticker / parent-company match.
 */
export function ingestOpenSupplyHub(collection, catalog, profiles) {
  const resolver = createResolver(profiles)
  const features = filterOshFeatures(collection?.features ?? [], resolver)
  const stats = { facilities: 0, linked: 0, skipped: 0 }

  for (const feature of features) {
    const props = feature?.properties ?? {}
    const coords = feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : null
    const name = String(props.name ?? '').trim()
    const osId = props.os_id || props.oar_id || feature.id
    if (!name || !osId) {
      stats.skipped += 1
      continue
    }

    const facilityId = `facility:osh:${osId}`
    const parentName = parentCompanyName(props)
    catalog.addEntity({
      id: facilityId,
      name,
      type: 'facility',
      latitude: coords ? Number(coords[1]) : undefined,
      longitude: coords ? Number(coords[0]) : undefined,
      metadata: {
        sourceNames: [name],
        originalName: name,
        osId,
        address: firstString(props.address),
        countryCode: firstString(props.country_code),
        countryName: firstString(props.country_name) || firstString(props.country),
        parentCompany: parentName || undefined,
        sector: firstString(props.sector),
        productType: firstString(props.product_type),
        workers: firstString(props.number_of_workers ?? props.workers),
        isClosed: props.is_closed,
        source: 'open_supply_hub',
        sourceUrl: `https://opensupplyhub.org/facilities/${osId}`,
      },
    })
    stats.facilities += 1

    const companyMatch = resolver.match({ name: parentName || name })
    const nameMatch = resolver.match({ name })

    let operator = null
    let confidence = 0
    if (companyMatch.profile && !companyMatch.reviewFlag) {
      operator = companyMatch.profile
      confidence = companyMatch.confidence
    } else if (nameMatch.profile && !nameMatch.reviewFlag) {
      operator = nameMatch.profile
      confidence = 0.9
    }

    if (!operator) {
      if (companyMatch.possibleProfileId || nameMatch.possibleProfileId) {
        const facility = catalog.addEntity({ id: facilityId, name, type: 'facility' })
        facility.metadata.reviewFlag = true
        facility.metadata.possibleMatch =
          companyMatch.possibleProfileId || nameMatch.possibleProfileId
      }
      continue
    }

    catalog.addEntity({
      id: `company:${operator.id}`,
      name: operator.canonicalName,
      type: 'company',
      metadata: {
        sourceNames: [parentName || name],
        originalName: parentName || name,
      },
    })
    catalog.addRelationship({
      type: 'operates',
      sourceEntityId: `company:${operator.id}`,
      targetEntityId: facilityId,
      confidence,
      evidence: [
        {
          sourceType: 'open_supply_hub',
          sourceName: 'Open Supply Hub',
          sourceUrl: `https://opensupplyhub.org/facilities/${osId}`,
          sourceRecordId: String(osId),
        },
      ],
      metadata: {
        note: parentName
          ? `Open Supply Hub lists ${parentName} as the parent of ${name}.`
          : `Open Supply Hub facility name matched ${operator.canonicalName}.`,
      },
    })
    stats.linked += 1
  }

  return stats
}

export function filterOshFeatures(features, resolver) {
  return features.filter((feature) => {
    const props = feature?.properties ?? {}
    const name = String(props.name ?? '')
    const parent = parentCompanyName(props)
    const sector = firstString(props.sector)
    const product = firstString(props.product_type)
    const haystack = [name, parent, sector, product].filter(Boolean).join(' ')
    if (ELECTRONICS_TEXT.test(haystack)) return true
    return [name, parent].some((value) => {
      if (!value) return false
      const match = resolver.match({ name: value })
      return Boolean(match.profile && !match.reviewFlag)
    })
  })
}

export function collectionFromOshCsv(text) {
  const rows = csvObjects(text)
  const features = []
  for (const row of rows) {
    const record = normalizeKeys(row)
    const name = firstString(record.name, record.facility_name, record.production_location_name)
    const osId = firstString(record.os_id, record.osid, record.oar_id)
    if (!name || !osId) continue
    const lng = Number(firstString(record.lng, record.lon, record.longitude, record.x))
    const lat = Number(firstString(record.lat, record.latitude, record.y))
    const geometry =
      Number.isFinite(lng) && Number.isFinite(lat)
        ? { type: 'Point', coordinates: [lng, lat] }
        : null
    features.push({
      type: 'Feature',
      id: osId,
      geometry,
      properties: {
        name,
        os_id: osId,
        address: firstString(record.address),
        country_code: firstString(record.country_code, record.country),
        country_name: firstString(record.country_name, record.country),
        parent_company: firstString(record.parent_company, record.parent),
        sector: firstString(record.sector, record.sectors),
        product_type: firstString(record.product_type, record.product_types),
        number_of_workers: firstString(record.number_of_workers, record.workers),
        is_closed: firstString(record.is_closed),
      },
    })
  }
  return { type: 'FeatureCollection', features, source: 'csv' }
}

export function emptyOshCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
    note: 'OS Hub API requires a token. Place an exported CSV/GeoJSON search here or set OSH_API_TOKEN.',
  }
}

export function isPlaceholderOsh(collection) {
  return !collection?.features?.length
}

export function oshSearchQueries(profiles) {
  const named = [
    'Foxconn',
    'Hon Hai',
    'Pegatron',
    'Wistron',
    'Luxshare',
    'Quanta Computer',
    'Compal',
    'Inventec',
    'Jabil',
    'Flex Ltd',
    'Amkor',
    'TSMC',
    'Taiwan Semiconductor',
    'Samsung Electronics',
    'SK Hynix',
    'GlobalFoundries',
    'Intel',
    'Micron',
  ]
  const queries = named.map((q) => ({ q }))
  for (const profile of profiles) {
    if (/foxconn|hon hai|tsmc|samsung|hynix|amkor|intel|micron|globalfoundries/i.test(profile.canonicalName)) {
      queries.push({ parent_company: profile.canonicalName })
    }
  }
  queries.push({ sector: 'Electronics' })
  return queries
}

function parentCompanyName(props) {
  const value = props.parent_company ?? props.parentCompany
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'string') return first
    return first?.name ?? ''
  }
  return value.name ?? ''
}

function normalizeKeys(row) {
  const record = {}
  for (const [key, value] of Object.entries(row)) {
    const normalized = String(key)
      .toLowerCase()
      .replace(/^\ufeff/, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
    record[normalized] = value
  }
  return record
}

function firstString(...values) {
  for (const value of values) {
    if (value == null) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ''
}
