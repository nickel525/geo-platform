import { createResolver } from '../lib/resolve.mjs'

/**
 * Open Supply Hub facilities GeoJSON (API or exported search).
 * Facilities stay separate from companies. `operates` is created only on
 * exact alias / ticker / parent-company match.
 */
export function ingestOpenSupplyHub(collection, catalog, profiles) {
  const resolver = createResolver(profiles)
  const features = collection?.features ?? []
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
        address: props.address,
        countryCode: props.country_code,
        countryName: props.country_name,
        isClosed: props.is_closed,
        source: 'open_supply_hub',
      },
    })
    stats.facilities += 1

    const parentName = parentCompanyName(props)
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
    })
    stats.linked += 1
  }

  return stats
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

export function emptyOshCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
    note: 'OS Hub API requires a token. Place an exported GeoJSON search here or set OSH_API_TOKEN.',
  }
}

export function oshSearchUrls(profiles) {
  return profiles.slice(0, 8).map((profile) => {
    const q = encodeURIComponent(profile.canonicalName)
    return `https://opensupplyhub.org/api/facilities/?q=${q}&page=1`
  })
}
