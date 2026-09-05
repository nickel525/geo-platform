import { OSM_REGIONS } from '../config.mjs'
import { createResolver } from '../lib/resolve.mjs'
import { stableId } from '../lib/catalog.mjs'

const ROAD_LIMIT = 8
const RAIL_LIMIT = 6
const POWER_LIMIT = 12

export function buildOverpassQuery(regions = OSM_REGIONS) {
  const blocks = regions.flatMap((region) => {
    const bbox = `${region.south},${region.west},${region.north},${region.east}`
    return [
      `nwr["landuse"="port"](${bbox});`,
      `nwr["harbour"](${bbox});`,
      `nwr["industrial"="port"](${bbox});`,
      `nwr["aeroway"="aerodrome"](${bbox});`,
      `nwr["power"="substation"](${bbox});`,
      `nwr["power"="plant"](${bbox});`,
      `nwr["man_made"="works"](${bbox});`,
      `nwr["landuse"="industrial"]["name"](${bbox});`,
      `way["highway"~"^(motorway|trunk)$"](${bbox});`,
      `way["railway"="rail"]["name"](${bbox});`,
    ]
  })
  return `[out:json][timeout:90];\n(\n  ${blocks.join('\n  ')}\n);\nout center tags;`
}

export function ingestOsm(overpass, catalog, profiles) {
  const resolver = createResolver(profiles)
  const stats = {
    ports: 0,
    airports: 0,
    power: 0,
    transport: 0,
    facilities: 0,
    operates: 0,
  }

  const roads = []
  const rails = []
  const power = []

  for (const element of overpass?.elements ?? []) {
    const tags = element.tags ?? {}
    const point = elementPoint(element)
    if (!point) continue

    if (isPort(tags)) {
      addInfra(catalog, element, point, 'port', tags)
      stats.ports += 1
      continue
    }
    if (tags.aeroway === 'aerodrome') {
      if (!isMajorAirport(tags)) continue
      addInfra(catalog, element, point, 'airport', tags)
      stats.airports += 1
      continue
    }
    if (tags.power === 'substation' || tags.power === 'plant') {
      power.push({ element, point, tags })
      continue
    }
    if (tags.highway === 'motorway' || tags.highway === 'trunk') {
      roads.push({ element, point, tags })
      continue
    }
    if (tags.railway === 'rail') {
      rails.push({ element, point, tags })
      continue
    }
    if (tags.man_made === 'works' || tags.landuse === 'industrial') {
      const name = tags.name || tags['name:en']
      if (!name || !isElectronicsSite(name, tags, resolver)) continue
      const facilityId = osmEntityId('facility', element)
      catalog.addEntity({
        id: facilityId,
        name,
        type: 'facility',
        latitude: point.lat,
        longitude: point.lon,
        metadata: {
          sourceNames: [name],
          originalName: name,
          osmId: `${element.type}/${element.id}`,
          operator: tags.operator,
          source: 'openstreetmap',
        },
      })
      stats.facilities += 1
      stats.operates += linkOperator(catalog, resolver, facilityId, tags, element)
    }
  }

  for (const item of pickNamed(power, POWER_LIMIT)) {
    addInfra(catalog, item.element, item.point, 'power_infrastructure', item.tags)
    stats.power += 1
  }
  for (const item of pickNamed(roads, ROAD_LIMIT)) {
    addInfra(catalog, item.element, item.point, 'transport_infrastructure', item.tags)
    stats.transport += 1
  }
  for (const item of pickNamed(rails, RAIL_LIMIT)) {
    addInfra(catalog, item.element, item.point, 'transport_infrastructure', item.tags)
    stats.transport += 1
  }

  return stats
}

const ELECTRONICS_SITE =
  /\b(tsmc|umc|intel|micron|nvidia|amd|asml|nxp|qualcomm|broadcom|foxconn|hon hai|hynix|samsung|globalfoundries|global foundries|applied materials|lam research|kla|amkor|semiconductor|foundry|wafer|fab|fabs|chip|electronics)\b/i

function isElectronicsSite(name, tags, resolver) {
  const haystack = [name, tags.operator, tags.brand, tags.product].filter(Boolean).join(' ')
  if (ELECTRONICS_SITE.test(haystack)) return true
  return [name, tags.operator, tags.brand].some((value) => {
    if (!value) return false
    const match = resolver.match({ name: value })
    return Boolean(match.profile && !match.reviewFlag)
  })
}

function isPort(tags) {
  return (
    tags.landuse === 'port' ||
    tags.industrial === 'port' ||
    Boolean(tags.harbour) ||
    tags.amenity === 'ferry_terminal'
  )
}

function addInfra(catalog, element, point, type, tags) {
  const name =
    tags.name ||
    tags['name:en'] ||
    tags.operator ||
    tags.ref ||
    (type === 'port' ? `Port OSM ${element.type}/${element.id}` : `${type.replaceAll('_', ' ')} ${element.type}/${element.id}`)
  catalog.addEntity({
    id: osmEntityId(type, element),
    name,
    type,
    latitude: point.lat,
    longitude: point.lon,
    metadata: {
      sourceNames: [name],
      originalName: tags.name,
      osmId: `${element.type}/${element.id}`,
      osmTags: pickTags(tags),
      source: 'openstreetmap',
    },
  })
}

function linkOperator(catalog, resolver, facilityId, tags, element) {
  const candidates = [tags.operator, tags.brand, tags.name, tags['name:en']].filter(Boolean)
  for (const candidate of candidates) {
    const exact = resolver.match({ name: candidate })
    const leading = exact.profile ? exact : leadingAliasMatch(resolver, candidate)
    if (!leading?.profile) {
      if (exact.possibleProfileId) {
        const facility = catalog.addEntity({
          id: facilityId,
          name: tags.name || candidate,
          type: 'facility',
        })
        facility.metadata.reviewFlag = true
        facility.metadata.possibleMatch = exact.possibleProfileId
      }
      continue
    }

    catalog.addEntity({
      id: `company:${leading.profile.id}`,
      name: leading.profile.canonicalName,
      type: 'company',
      metadata: {
        sourceNames: [candidate],
        originalName: candidate,
      },
    })
    catalog.addRelationship({
      type: 'operates',
      sourceEntityId: `company:${leading.profile.id}`,
      targetEntityId: facilityId,
      confidence: tags.operator ? 0.88 : leading.confidence,
      evidence: [
        {
          sourceType: 'openstreetmap',
          sourceName: 'OpenStreetMap',
          sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
          sourceRecordId: `${element.type}/${element.id}`,
        },
      ],
    })
    return 1
  }
  return 0
}

function leadingAliasMatch(resolver, name) {
  const key = resolver.normalizeKeepIndustry(name)
  for (const [aliasKey, profile] of resolver.byKey) {
    if (aliasCovers(aliasKey, key)) {
      return { profile, confidence: key === aliasKey ? 0.9 : 0.84 }
    }
  }
  return null
}

function aliasCovers(aliasKey, key) {
  if (key === aliasKey || key.startsWith(`${aliasKey} `)) return true
  return [...aliasKey].some((char) => (char.codePointAt(0) ?? 0) > 127) &&
    aliasKey.length >= 3 &&
    key.startsWith(aliasKey)
}

function isMajorAirport(tags) {
  return Boolean(tags.iata || /international|國際/i.test(tags.name || tags['name:en'] || ''))
}

function elementPoint(element) {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lon: element.lon }
  }
  if (element.center) return { lat: element.center.lat, lon: element.center.lon }
  return null
}

function osmEntityId(type, element) {
  return stableId(type, `osm:${element.type}:${element.id}`)
}

function pickNamed(items, limit) {
  return [...items]
    .sort((a, b) => Number(Boolean(b.tags.name)) - Number(Boolean(a.tags.name)))
    .slice(0, limit)
}

function pickTags(tags) {
  const keys = [
    'name',
    'operator',
    'power',
    'highway',
    'railway',
    'aeroway',
    'landuse',
    'harbour',
    'industrial',
  ]
  const picked = {}
  for (const key of keys) {
    if (tags[key]) picked[key] = tags[key]
  }
  return picked
}
