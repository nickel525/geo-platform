/**
 * First-pass entity resolution.
 * Exact normalized names + curated aliases + tickers only.
 * Uncertain names stay as separate entities with a review flag.
 */

export function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(
      /\b(inc|incorporated|incorporated|ltd|limited|llc|llp|plc|nv|sa|ag|kk|gmbh|corp|corporation|co|company|the|holdings|holding|group|technologies|technology|semiconductor|semiconductors)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Lighter normalize that keeps industry words so "Micron Technology"
 * does not collapse into the same token as an unrelated "Micron".
 */
export function normalizeKeepIndustry(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replaceAll('&', ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(
      /\b(inc|incorporated|ltd|limited|llc|llp|plc|nv|sa|ag|kk|gmbh|corp|corporation|co|company|the)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

export function createResolver(profiles) {
  const byKey = new Map()
  const byTicker = new Map()

  for (const profile of profiles) {
    const keys = new Set([
      normalizeKeepIndustry(profile.canonicalName),
      ...profile.aliases.map((alias) => normalizeKeepIndustry(alias)),
    ])
    for (const key of keys) {
      if (key) byKey.set(key, profile)
    }
    for (const ticker of profile.tickers) {
      byTicker.set(ticker.toUpperCase(), profile)
    }
  }

  function match({ name, ticker }) {
    const tickerKey = ticker ? String(ticker).trim().toUpperCase() : ''
    if (tickerKey && byTicker.has(tickerKey)) {
      const profile = byTicker.get(tickerKey)
      return {
        profile,
        confidence: 1,
        reviewFlag: false,
        matchedOn: `ticker:${tickerKey}`,
      }
    }

    const key = normalizeKeepIndustry(name)
    if (key && byKey.has(key)) {
      const profile = byKey.get(key)
      return {
        profile,
        confidence: 0.98,
        reviewFlag: false,
        matchedOn: `alias:${key}`,
      }
    }

    const possible = profiles.filter((profile) =>
      profile.aliases.some((alias) => {
        const aliasKey = normalizeKeepIndustry(alias)
        return aliasKey.length >= 4 && key.startsWith(`${aliasKey} `)
      }),
    )

    // Prefix hits are review candidates only — never merged.
    if (possible.length === 1) {
      return {
        profile: null,
        confidence: 0,
        reviewFlag: true,
        matchedOn: null,
        possibleProfileId: possible[0].id,
      }
    }

    return {
      profile: null,
      confidence: 0,
      reviewFlag: false,
      matchedOn: null,
    }
  }

  return { match, normalizeKeepIndustry, byKey, byTicker }
}
