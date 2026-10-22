// Utility: format large numbers gracefully (1.2K, 3.4M, etc.)
export const formatNumber = (n) => {
  const num = Number(n || 0)
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString()
}

// Utility: format currency with proper separators
export const formatCurrency = (n, currency = 'USD') => {
  const num = Number(n || 0)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return `$${num.toFixed(2)}`
  }
}

// Utility: truncate long text with ellipsis
export const truncate = (str, max = 30) => {
  if (!str) return ''
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}
