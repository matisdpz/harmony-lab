/** User-created improvisation progressions, kept in this browser (they are practice loops, not projects). */
export interface CustomProgression {
  id: string
  name: string
  symbols: string[]
}

const STORAGE_KEY = 'harmony-lab.improvisation.custom'

export function loadCustomProgressions(): CustomProgression[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as CustomProgression[]).filter((p) => p && Array.isArray(p.symbols)) : []
  } catch {
    return []
  }
}

export function saveCustomProgressions(list: CustomProgression[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // storage unavailable (private mode): the list still lives for this session
  }
}

/** Splits "Am F | C, G" into ["Am", "F", "C", "G"]. */
export function splitSymbols(text: string): string[] {
  return text.split(/[\s|,]+/).map((s) => s.trim()).filter(Boolean)
}
