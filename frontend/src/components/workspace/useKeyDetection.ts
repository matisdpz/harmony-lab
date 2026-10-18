import { useEffect, useState } from 'react'
import type { ChordInput, KeyDetectionResponse } from '../../api/types'
import { theoryApi } from '../../api/theory'
import { isAbort } from '../../api/http'

/** Asks the engine for the most likely key of the chords, after edits have settled. */
export function useKeyDetection(chords: ChordInput[], minChords = 3): KeyDetectionResponse | null {
  const [result, setResult] = useState<{ forKey: string; data: KeyDetectionResponse } | null>(null)
  const requestKey = JSON.stringify(chords.map((c) => [c.root, c.quality, c.durationBeats]))
  const enough = chords.length >= minChords

  useEffect(() => {
    if (!enough) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      theoryApi.detectKey(chords.map(({ root, quality, inversion, durationBeats }) => ({ root, quality, inversion, durationBeats })), controller.signal)
        .then((data) => setResult({ forKey: requestKey, data }))
        .catch((e: unknown) => {
          if (!isAbort(e)) setResult(null) // detection is a hint; failures stay silent
        })
    }, 500)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, enough])

  return enough && result?.forKey === requestKey ? result.data : null
}
