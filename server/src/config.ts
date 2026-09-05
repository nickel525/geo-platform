import { readFileSync } from 'node:fs'

try {
  const envFile = new URL('../.env', import.meta.url)
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const split = trimmed.indexOf('=')
    if (split < 1) continue
    const key = trimmed.slice(0, split)
    const value = trimmed.slice(split + 1)
    if (!(key in process.env)) process.env[key] = value
  }
} catch {
  // Optional local overrides.
}

function readEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export const config = {
  databaseUrl: readEnv(
    'DATABASE_URL',
    'postgres://atlas:atlas@127.0.0.1:5433/atlas',
  ),
  port: Number(readEnv('PORT', '3001')),
  host: readEnv('HOST', '127.0.0.1'),
}
