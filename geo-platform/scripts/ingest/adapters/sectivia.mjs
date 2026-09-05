import { FOCUS_TICKERS } from '../config.mjs'
import { createResolver } from '../lib/resolve.mjs'
import { companyEntityId } from '../lib/catalog.mjs'

const FOCUS = new Set(FOCUS_TICKERS)
const AI_SEGMENTS = new Set(['chips', 'equip', 'cloud', 'datacentre', 'infra', 'aisw', 'data'])

export function filterSectivia(dataset) {
  const companies = dataset.companies ?? []
  const relations = dataset.relations ?? []
  const byId = new Map(companies.map((company) => [company.id, company]))

  const keepId = new Set()
  for (const company of companies) {
    if (isElectronicsCompany(company)) keepId.add(company.id)
  }
  for (const rel of relations) {
    const supplier = byId.get(rel.supplier)
    const customer = byId.get(rel.customer)
    if (!supplier || !customer) continue
    if (isElectronicsCompany(supplier) || isElectronicsCompany(customer)) {
      keepId.add(supplier.id)
      keepId.add(customer.id)
    }
  }

  return {
    ...dataset,
    companies: companies.filter((company) => keepId.has(company.id)),
    relations: relations.filter(
      (rel) => keepId.has(rel.supplier) && keepId.has(rel.customer),
    ),
  }
}

export function ingestSectivia(dataset, catalog, profiles) {
  const resolver = createResolver(profiles)
  const slice = filterSectivia(dataset)
  const byId = new Map(slice.companies.map((company) => [company.id, company]))
  const stats = { companies: 0, relations: 0, skipped: 0 }

  for (const company of slice.companies) {
    upsertCompany(catalog, resolver, company)
    stats.companies += 1
  }

  for (const rel of slice.relations) {
    const supplier = byId.get(rel.supplier)
    const customer = byId.get(rel.customer)
    if (!supplier || !customer) {
      stats.skipped += 1
      continue
    }
    const from = upsertCompany(catalog, resolver, supplier)
    const to = upsertCompany(catalog, resolver, customer)
    const evidence = {
      sourceType: 'sectivia',
      sourceName: 'Sectivia U.S. supply-chain graph',
      sourceUrl: dataset.url || 'https://sectivia.com/dataset/',
      sourceRecordId: `${rel.supplier}->${rel.customer}`,
    }
    const note = `Sectivia maps ${supplier.name} as a supplier of ${customer.name} (${rel.sector}).`

    catalog.addRelationship({
      type: 'supplies',
      sourceEntityId: from.id,
      targetEntityId: to.id,
      confidence: 0.62,
      evidence: [evidence],
      metadata: {
        sector: rel.sector,
        supplierTicker: rel.supplierTicker,
        customerTicker: rel.customerTicker,
        note,
        inferred: true,
      },
    })
    catalog.addRelationship({
      type: 'customer_of',
      sourceEntityId: to.id,
      targetEntityId: from.id,
      confidence: 0.62,
      evidence: [evidence],
      metadata: {
        sector: rel.sector,
        note,
        inferred: true,
      },
    })
    stats.relations += 1
  }

  return stats
}

function isElectronicsCompany(company) {
  if (!company) return false
  if (company.sector === 'ai' || company.sector === 'quantum') return true
  if (AI_SEGMENTS.has(company.segment)) return true
  return FOCUS.has((company.ticker || '').toUpperCase())
}

function upsertCompany(catalog, resolver, company) {
  const match = resolver.match({ name: company.name, ticker: company.ticker })
  const id = companyEntityId(match, { ticker: company.ticker, name: company.name })
  return catalog.addEntity({
    id,
    name: match.profile ? match.profile.canonicalName : company.name,
    type: 'company',
    metadata: {
      sourceNames: [company.name],
      originalName: company.name,
      ticker: company.ticker || match.profile?.tickers[0],
      country: company.country,
      sector: company.sector,
      segment: company.segment,
      exchange: company.exchange,
      source: 'sectivia',
      matchedOn: match.matchedOn,
    },
  })
}
