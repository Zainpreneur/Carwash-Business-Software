/**
 * Turn one brand colour into a full Tailwind palette.
 *
 * The theme in index.css defines `--color-brand-50 … --color-brand-950`.
 * Tailwind v4 compiles `bg-brand-600` to `var(--color-brand-600)`, so writing
 * those variables onto the root element re-skins the whole app for a tenant
 * without a rebuild.
 */

const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n))

export const hexToRgb = (hex) => {
  let value = String(hex || '').trim().replace('#', '')
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-f]{6}$/i.test(value)) return null
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

export const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`

export const rgbToHsl = ({ r, g, b }) => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

export const hslToRgb = ({ h, s, l }) => {
  const hn = ((h % 360) + 360) % 360 / 360
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100

  if (sn === 0) {
    const v = ln * 255
    return { r: v, g: v, b: v }
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q
  const channel = (t) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  return {
    r: channel(hn + 1 / 3) * 255,
    g: channel(hn) * 255,
    b: channel(hn - 1 / 3) * 255,
  }
}

// lightness / saturation for each step of the scale
const SCALE = {
  50: { l: 97, s: 95 },
  100: { l: 93, s: 92 },
  200: { l: 85, s: 88 },
  300: { l: 74, s: 85 },
  400: { l: 60, s: 85 },
  500: { l: 48, s: 88 },
  600: { l: 41, s: 90 },
  700: { l: 33, s: 82 },
  800: { l: 26, s: 72 },
  900: { l: 21, s: 62 },
  950: { l: 14, s: 55 },
}

/** Build the CSS custom properties for a brand colour. */
export const brandVariables = (hex) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return {}
  const { h, s } = rgbToHsl(rgb)

  const vars = {}
  Object.entries(SCALE).forEach(([step, { l, s: sat }]) => {
    const c = hslToRgb({ h, s: sat, l })
    vars[`--color-brand-${step}`] = rgbToHex(c)
  })
  // 600 is the identity colour — keep it exactly as the tenant picked it.
  vars['--color-brand-600'] = rgbToHex(rgb)
  return vars
}

/** Write the palette onto the document root. */
export const applyBrand = (hex) => {
  const vars = brandVariables(hex)
  const root = document.documentElement
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value))
  if (hex) {
    root.style.setProperty('--brand-color', hex)
  }
  return vars
}

/** Readable text colour for a given background. */
export const contrastColor = (hex) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#ffffff'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.65 ? '#0f172a' : '#ffffff'
}
