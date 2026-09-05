import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { sql } from './db.ts'

const file = fileURLToPath(new URL('./sql/001_init.sql', import.meta.url))

const text = await readFile(file, 'utf8')
await sql.unsafe(text)
console.log('Applied 001_init.sql')
await sql.end()
