export const CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'LTC', 'XRP', 'BCH', 'EOS', 'XLM', 'XTZ', 'ADA', 'DOT',
  'LINK', 'UNI', 'AAVE', 'SOL', 'MATIC', 'AVAX', 'ATOM', 'ALGO', 'FIL',
  'DOGE', 'SHIB', 'USDC', 'USDT', 'DAI', 'BAT', 'ZEC', 'XMR', 'DASH',
  'ETC', 'TRX', 'VET', 'THETA', 'ICP', 'FTM', 'NEAR', 'APT', 'ARB', 'OP',
  'SUI', 'SEI', 'TIA', 'INJ', 'MKR', 'COMP', 'SNX', 'CRV', 'YFI', 'SUSHI',
  '1INCH', 'ENJ', 'MANA', 'SAND', 'AXS', 'GALA', 'CHZ', 'FLOW', 'GRT',
  'ANKR', 'SKL', 'NU', 'CGLD', 'OXT', 'UMA', 'FORTH', 'ETH2', 'CBETH', 'BAND', 'NMR',
])

export function isCryptoSymbol(symbol) {
  if (!symbol) return false
  const upper = symbol.toUpperCase().replace(/\s+/g, '')
  if (upper.startsWith('X:')) return true
  const base = upper.replace(/-USD$/, '')
  return CRYPTO_SYMBOLS.has(base)
}
