import { FOCUS_TICKERS, PLATFORM_TICKERS } from '../config.mjs'
import { csvObjects, toCsv } from '../lib/csv.mjs'
import { createResolver, normalizeKeepIndustry } from '../lib/resolve.mjs'
import { companyEntityId } from '../lib/catalog.mjs'

const CORE_NAME =
  /tsmc|taiwan semiconductor|nvidia|micron technology|advanced micro devices|intel corporation|applied materials|lam research|hon hai|foxconn|sk hynix|samsung electronics|globalfoundries|united microelectronics|asml|tokyo electron|kioxia|amkor|nxp semicon|analog devices|marvell|qualcomm|broadcom|taiwan semi|kla tencor|kla-tencor/i

const ELECTRONICS_FILER =
  /semiconductor|microelectron|foundry|fabless|microchip|chipset|integrated circuit|\basic\b|wafer|photomask|lithograph|\beda\b|design system|electronics|robotics|gpu|fpga|\bsoc\b|optoelectron|analog|networking|network equipment|teradyne|synopsys|cadence|arm holdings|lattice|quicklogic|peraso|everspin|arteris|ceva|indie|broadcom|qualcomm|marvell|nxp|infineon|stmicro|renesas|tokyo electron|applied material|lam research|kla |asml|amkor|entegris|globalfoundries|tsmc|nvidia|advanced micro|micron|intel/i

const FOUNDRY =
  /tsmc|taiwan semiconductor|united microelectronics|\bumc\b|globalfoundries|samsung electronics|sk hynix|smic|tower semiconductor|vis |psmc|kioxia/i

const EQUIPMENT_OR_EDA = new Set([
  'AMAT',
  'LRCX',
  'KLAC',
  'ASML',
  'TER',
  'SNPS',
  'CDNS',
  'ENTG',
  'AMKR',
  'AEHR',
  'CAMT',
  'VECO',
  'ACLS',
  'MKSI',
  'COHU',
  'FORM',
])

const TECH_FILERS = new Set([
  ...FOCUS_TICKERS,
  'IBM',
  'CSCO',
  'ANET',
  'DELL',
  'HPQ',
  'HPE',
  'NTAP',
  'STX',
  'WDC',
  'SNDK',
  'CRWV',
  'FTNT',
  'PANW',
  'CRWD',
  'QUIK',
  'INDI',
  'CEVA',
  'AIP',
  'LSCC',
  'MRAM',
  'PRSO',
  'ROKU',
  'NET',
  'ARM',
  'AVNW',
  'SERV',
])

const CORE_TICKERS = new Set(FOCUS_TICKERS.filter((ticker) => !PLATFORM_TICKERS.includes(ticker)))

export function isElectronicsCore(ticker, name) {
  if (ticker && CORE_TICKERS.has(ticker.toUpperCase())) return true
  return Boolean(name && CORE_NAME.test(name))
}

export function isPlausibleFiler(ticker, name) {
  const symbol = (ticker || '').toUpperCase()
  if (TECH_FILERS.has(symbol) || CORE_TICKERS.has(symbol)) return true
  return Boolean(name && ELECTRONICS_FILER.test(name))
}

export function filterSampoqRows(rows) {
  const eligible = rows.filter((row) => {
    if (!isPlausibleFiler(row.source_ticker, row.source_name)) return false
    return (
      isElectronicsCore(row.source_ticker, row.source_name) ||
      isElectronicsCore(row.related_ticker, row.related_name) ||
      isPlausibleFiler(row.related_ticker, row.related_name)
    )
  })
  return resolveContradictions(eligible)
}

export function filterSampoqCsv(text) {
  const rows = filterSampoqRows(csvObjects(text))
  return { rows, csv: toCsv(rows) }
}

/**
 * Same filing + same pair labeled both supplier and customer is extractor noise
 * (La-Z-Boy, Chipotle, Costco, etc.). Keep the industry-plausible reading only.
 */
function resolveContradictions(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = [
      row.filing_accession,
      normalizeKeepIndustry(row.source_name),
      normalizeKeepIndustry(row.related_name),
    ].join('|')
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const kept = []
  for (const group of groups.values()) {
    const types = new Set(group.map((row) => String(row.relation_type).toLowerCase()))
    if (!(types.has('supplier') && types.has('customer'))) {
      kept.push(...group)
      continue
    }
    const relatedName = group[0].related_name || ''
    const sourceTicker = (group[0].source_ticker || '').toUpperCase()
    const foundry = FOUNDRY.test(relatedName)
    const equipment = EQUIPMENT_OR_EDA.has(sourceTicker)
    if (foundry && equipment) {
      kept.push(...group.filter((row) => String(row.relation_type).toLowerCase() === 'customer'))
      continue
    }
    if (foundry) {
      kept.push(...group.filter((row) => String(row.relation_type).toLowerCase() === 'supplier'))
      continue
    }
  }
  return kept
}

export function ingestSampoq(rows, catalog, profiles) {
  const resolver = createResolver(profiles)
  const stats = { rows: 0, skipped: 0, companies: 0, edges: 0 }

  for (const row of rows) {
    if (!row.related_name || !row.source_name || !row.relation_type) {
      stats.skipped += 1
      continue
    }
    stats.rows += 1

    const source = upsertCompany(catalog, resolver, {
      name: row.source_name,
      ticker: row.source_ticker,
      cik: row.source_cik,
    })
    const related = upsertCompany(catalog, resolver, {
      name: row.related_name,
      ticker: row.related_ticker,
    })
    stats.companies += 2

    const evidence = {
      sourceType: 'sec_10k',
      sourceName: 'Sampoq 10-K Supply-Chain Graph',
      sourceUrl: edgarIndexUrl(row.source_cik, row.filing_accession),
      sourceRecordId: row.filing_accession || undefined,
      observedAt: row.filing_date || row.collected_at || undefined,
    }

    const relation = String(row.relation_type).toLowerCase()
    // Filer POV: customer = filer sells to related; supplier = filer buys from related.
    const supplierId = relation === 'supplier' ? related.id : source.id
    const customerId = relation === 'supplier' ? source.id : related.id
    if (relation !== 'supplier' && relation !== 'customer') {
      stats.skipped += 1
      continue
    }

    const note = `${row.source_name} 10-K named ${row.related_name} as a ${relation}`

    catalog.addRelationship({
      type: 'supplies',
      sourceEntityId: supplierId,
      targetEntityId: customerId,
      confidence: 0.72,
      evidence: [evidence],
      metadata: {
        filerCik: row.source_cik,
        filerTicker: row.source_ticker,
        relatedTicker: row.related_ticker,
        filingRelation: relation,
        note,
      },
    })
    catalog.addRelationship({
      type: 'customer_of',
      sourceEntityId: customerId,
      targetEntityId: supplierId,
      confidence: 0.72,
      evidence: [evidence],
      metadata: {
        filingRelation: relation,
        note,
      },
    })
    stats.edges += 2
  }

  return stats
}

function upsertCompany(catalog, resolver, { name, ticker, cik }) {
  const match = resolver.match({ name, ticker })
  const id = companyEntityId(match, { ticker, name })

  const entity = catalog.addEntity({
    id,
    name: match.profile ? match.profile.canonicalName : name.trim(),
    type: 'company',
    metadata: {
      sourceNames: [name.trim()],
      ticker: ticker || match.profile?.tickers[0] || undefined,
      cik: cik || undefined,
      reviewFlag: match.reviewFlag || Boolean(match.possibleProfileId),
      possibleMatch: match.possibleProfileId,
      matchedOn: match.matchedOn,
      originalName: name.trim(),
    },
  })
  return entity
}

function edgarIndexUrl(cik, accession) {
  if (!cik || !accession) return 'https://www.sampoq.com/datasets/supply-chain'
  const cikNum = String(cik).replace(/^0+/, '')
  const accn = String(accession).replaceAll('-', '')
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accn}/${accession}-index.html`
}
