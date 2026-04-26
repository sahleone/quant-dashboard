export function fmt(val, prefix = '$') {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  return `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtPct(val) {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}
