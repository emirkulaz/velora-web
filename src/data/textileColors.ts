/** Fransızca tekstil renk adları / yaygın kısaltmalar → hex */

type TextileColorDef = {
  hex: string
  label: string
  keys: string[]
}

const TEXTILE_COLORS: TextileColorDef[] = [
  { label: 'Noir', hex: '#1a1a1a', keys: ['noir', 'black'] },
  { label: 'Blanc', hex: '#f5f5f0', keys: ['blanc', 'white', 'blc'] },
  { label: 'Anthracite', hex: '#2f353b', keys: ['anthracite', 'anc', 'anthra'] },
  { label: 'Gris clair', hex: '#c5c9d0', keys: ['gris clair', 'grisclair'] },
  { label: 'Gris foncé', hex: '#4a4f57', keys: ['gris fonce', 'grisfonce'] },
  { label: 'Gris', hex: '#8a8f98', keys: ['gris', 'grey', 'gray'] },
  { label: 'Beige', hex: '#d6c4a8', keys: ['beige'] },
  { label: 'Écru', hex: '#f0e6d2', keys: ['ecru'] },
  { label: 'Ivoire', hex: '#fffff0', keys: ['ivoire', 'ivory'] },
  { label: 'Crème', hex: '#fff5e1', keys: ['creme', 'cream'] },
  { label: 'Naturel', hex: '#e8dcc8', keys: ['naturel', 'natural'] },
  { label: 'Camel', hex: '#c19a6b', keys: ['camel'] },
  { label: 'Taupe', hex: '#8b7d6b', keys: ['taupe'] },
  { label: 'Marron', hex: '#6b3e26', keys: ['marron', 'brun', 'brown'] },
  { label: 'Chocolat', hex: '#3d2314', keys: ['chocolat', 'chocolate'] },
  { label: 'Cognac', hex: '#9a4634', keys: ['cognac'] },
  { label: 'Bordeaux', hex: '#6e1e2a', keys: ['bordeaux'] },
  { label: 'Rouge', hex: '#c0392b', keys: ['rouge', 'red'] },
  { label: 'Rose', hex: '#e8a0bf', keys: ['rose', 'pink'] },
  { label: 'Orange', hex: '#e67e22', keys: ['orange'] },
  { label: 'Jaune', hex: '#f1c40f', keys: ['jaune', 'yellow'] },
  { label: 'Vert', hex: '#27ae60', keys: ['vert', 'green'] },
  { label: 'Kaki', hex: '#6b6b3a', keys: ['kaki', 'khaki'] },
  { label: 'Bleu marine', hex: '#1a2744', keys: ['bleu marine', 'navy'] },
  { label: 'Marine', hex: '#1a2744', keys: ['marine'] },
  { label: 'Bleu', hex: '#2f6fed', keys: ['bleu', 'blue'] },
  { label: 'Turquoise', hex: '#1abc9c', keys: ['turquoise'] },
  { label: 'Violet', hex: '#7d3c98', keys: ['violet', 'pourpre', 'purple'] },
  { label: 'Argent', hex: '#b0b7c3', keys: ['argent', 'silver'] },
  { label: 'Or', hex: '#c9a227', keys: ['or', 'gold', 'dore'] },
]

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/\s+/g, ' ')
    .trim()
}

export type ResolvedTextileColor = {
  hex: string
  label: string
  source: string
}

const KEY_TO_DEF: Array<{ key: string; def: TextileColorDef }> = TEXTILE_COLORS.flatMap(
  (def) => def.keys.map((key) => ({ key: normalize(key), def })),
).sort((a, b) => b.key.length - a.key.length)

/** Token dizisinde soldan sağa renkleri bul (birleştirmeden). */
function matchColorSequence(tokens: string[]): ResolvedTextileColor[] {
  const result: ResolvedTextileColor[] = []
  let i = 0
  while (i < tokens.length) {
    let matched: TextileColorDef | null = null
    let consume = 1

    for (const { key, def } of KEY_TO_DEF) {
      const keyParts = key.split(' ').filter(Boolean)
      if (keyParts.length === 0) continue
      const slice = tokens.slice(i, i + keyParts.length).map(normalize)
      if (
        slice.length === keyParts.length &&
        slice.every((part, idx) => part === keyParts[idx])
      ) {
        matched = def
        consume = keyParts.length
        break
      }
    }

    if (matched) {
      if (!result.some((r) => r.label === matched!.label)) {
        result.push({
          hex: matched.hex,
          label: matched.label,
          source: tokens.slice(i, i + consume).join(' '),
        })
      }
      i += consume
    } else {
      i += 1
    }
  }
  return result
}

/** Slash ile ayrılmış renk parçalarını çöz (parça başına bir renk). */
function colorsFromSlashParts(text: string): ResolvedTextileColor[] {
  const parts = text
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return []

  const result: ResolvedTextileColor[] = []
  for (const part of parts) {
    const matched = matchColorSequence(part.split(/\s+/).filter(Boolean))
    if (matched.length > 0) {
      result.push(matched[0]!)
    } else {
      result.push({ hex: '#94a3b8', label: part, source: part })
    }
  }
  return result
}

function colorsFromColorField(color: string): ResolvedTextileColor[] {
  if (color.includes('/')) return colorsFromSlashParts(color)
  return matchColorSequence(color.split(/\s+/).filter(Boolean))
}

/**
 * Ürün adı: ilk kelime model; sonrası / ile ayrılan renkler.
 * "Bande Noir/Blanc" → Noir, Blanc
 * "COTES Noir" → Noir
 * "ANC" → renk yok
 */
function colorsFromProductName(name: string): ResolvedTextileColor[] {
  const trimmed = name.trim()
  const firstSpace = trimmed.search(/\s/)
  if (firstSpace < 0) return []
  const remainder = trimmed.slice(firstSpace + 1).trim()
  if (!remainder) return []
  return colorsFromColorField(remainder)
}

/**
 * Renk alanı varsa onu kullan; yoksa ürün adından (ilk kelime hariç) çıkar.
 */
export function resolveTextileColors(
  color: string | null | undefined,
  name?: string | null,
  _code?: string | null,
): ResolvedTextileColor[] {
  void _code

  try {
    if (color?.trim()) {
      const fromField = colorsFromColorField(color)
      if (fromField.length > 0) return fromField
      return [{ hex: '#94a3b8', label: color.trim(), source: color.trim() }]
    }

    if (name?.trim()) {
      return colorsFromProductName(name)
    }

    return []
  } catch {
    return []
  }
}

export function resolveTextileColor(
  color: string | null | undefined,
  name?: string | null,
  code?: string | null,
): ResolvedTextileColor | null {
  return resolveTextileColors(color, name, code)[0] ?? null
}
