/** Minimal RFC4180 CSV parser — no extra libraries. */

export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let i = 0
  let quoted = false

  while (i < text.length) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i += 2
        continue
      }
      if (c === '"') {
        quoted = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      quoted = true
      i += 1
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += c
    i += 1
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((item) => item.some((cell) => cell.length > 0))
}

export function csvObjects(text) {
  const rows = parseCsv(text)
  const header = rows[0] ?? []
  return rows.slice(1).map((row) => {
    const record = {}
    for (let i = 0; i < header.length; i += 1) {
      record[header[i]] = row[i] ?? ''
    }
    return record
  })
}

export function toCsv(rows) {
  if (rows.length === 0) return ''
  const header = Object.keys(rows[0])
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      header
        .map((key) => escapeCsv(String(row[key] ?? '')))
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

function escapeCsv(value) {
  if (!/[,"\n\r]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}
