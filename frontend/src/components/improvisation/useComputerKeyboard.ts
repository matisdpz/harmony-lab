import { useEffect, useState } from 'react'

// One octave on the home row, like most DAWs: white keys on A S D F G H J K, black keys on W E T Y U.
const KEY_OFFSETS: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName))
}

/**
 * Lets the user play notes from the computer keyboard while a loop runs. Z / X shift the octave.
 * Returns the current base note (MIDI) so the UI can show which octave is mapped.
 */
export function useComputerKeyboard(onNote: (midi: number) => void, enabled: boolean): number {
  const [base, setBase] = useState(60) // C4

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'z') setBase((b) => Math.max(36, b - 12))
      else if (key === 'x') setBase((b) => Math.min(84, b + 12))
      else if (key in KEY_OFFSETS) onNote(base + KEY_OFFSETS[key])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, base, onNote])

  return base
}
