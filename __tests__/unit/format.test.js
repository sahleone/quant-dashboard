import { fmt, fmtPct } from '@/utils/format'

describe('fmt (currency formatter)', () => {
  it('formats a positive number with the default $ prefix', () => {
    expect(fmt(1234.5)).toBe('$1,234.50')
  })

  it('formats zero as $0.00', () => {
    expect(fmt(0)).toBe('$0.00')
  })

  it('uses a custom prefix when provided', () => {
    expect(fmt(99.9, '£')).toBe('£99.90')
  })

  it('returns an em dash for null', () => {
    expect(fmt(null)).toBe('—')
  })

  it('returns an em dash for undefined', () => {
    expect(fmt(undefined)).toBe('—')
  })

  it('returns an em dash for non-numeric input', () => {
    expect(fmt('not a number')).toBe('—')
  })
})

describe('fmtPct (percentage formatter)', () => {
  it('adds a + sign for positive values', () => {
    expect(fmtPct(5.5)).toBe('+5.50%')
  })

  it('formats zero as +0.00%', () => {
    expect(fmtPct(0)).toBe('+0.00%')
  })

  it('keeps the - sign for negative values without adding +', () => {
    expect(fmtPct(-3.21)).toBe('-3.21%')
  })

  it('returns an em dash for null', () => {
    expect(fmtPct(null)).toBe('—')
  })

  it('rounds to two decimal places', () => {
    expect(fmtPct(1.239)).toBe('+1.24%')
  })
})
