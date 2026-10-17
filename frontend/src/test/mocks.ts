import { vi } from 'vitest'
import type { AnalysisResponse, ChordInput, KeyDto, VoicedChord } from '../api/types'
import { AM, AM7, C, CATALOG, DM, F, G } from './fixtures'
import { ApiError } from '../api/http'

const BY_KEY: Record<string, VoicedChord> = {
  'A:MINOR:0': AM, 'F:MAJOR:1': F, 'C:MAJOR:2': C, 'G:MAJOR:0': G, 'A:MINOR7:0': AM7, 'D:MINOR:0': DM,
}

export function chordFor(input: { root: string; quality: string; inversion?: number }): VoicedChord {
  const chord = BY_KEY[`${input.root}:${input.quality}:${input.inversion ?? 0}`]
  if (!chord) throw new ApiError(400, 'Invalid musical input', `No fixture for ${input.root} ${input.quality}`)
  return chord
}

/** A stand-in for the backend theory API that returns fixture data (no music theory runs in the browser). */
export function createTheoryApiMock() {
  return {
    catalog: vi.fn(async () => CATALOG),
    optimize: vi.fn(async () => ({ chords: [AM, F, C, G], totalMovement: 6, totalCost: 6 })),
    resolveChord: vi.fn(async (body: { root: string; quality: string; inversion?: number }) => ({ chord: chordFor(body), inversions: [], relation: null })),
    parseChord: vi.fn(async ({ symbol }: { symbol: string }) => {
      if (symbol === 'Dm') return { chord: DM, inversions: [], relation: null }
      throw new ApiError(400, 'Validation failed', `symbol: Invalid chord symbol '${symbol}'`,
        [{ field: 'symbol', message: `Invalid chord symbol '${symbol}'. Start with an uppercase root (A-G), e.g. Am, F#7, Bbmaj7, C/E.` }])
    }),
    analyze: vi.fn(async (key: KeyDto, chords: ChordInput[]): Promise<AnalysisResponse> => ({
      key: `${key.tonic} ${key.mode}`,
      chords: chords.map((c, index) => ({
        index, symbol: chordFor(c).symbol, label: `R${index + 1}`, category: 'DIATONIC', function: 'TONIC',
        functionConfident: true, notesOutsideScale: [], explanation: `Explanation for chord ${index + 1}`,
      })),
      transitions: [],
      observations: [{ kind: 'FACT', severity: 'INFO', message: `The progression contains ${chords.length} chords.` }],
      metrics: {
        chordCount: chords.length, diatonicCount: chords.length, distinctChords: chords.length, totalVoiceMovement: 0,
        averageMovementPerTransition: 0, heldVoices: 0, stepwiseMotions: 0, totalMotions: 0, parallelPerfects: 0,
        commonToneTotal: 0, startsOnTonic: false, endsOnTonic: false, cadence: null,
      },
      summary: 'Summary',
    })),
    suggestions: vi.fn(async () => ({ objective: 'SMOOTH_VOICE_LEADING', objectiveLabel: 'Smooth', message: 'No candidate', suggestions: [] })),
    voiceLeading: vi.fn(async () => ({ candidates: [], costFunction: 'cost' })),
    alternatives: vi.fn(async () => ({ current: null, alternatives: [] })),
    identify: vi.fn(),
    key: vi.fn(),
  }
}

export function createAudioEngineMock() {
  return {
    init: vi.fn(async () => {}),
    playChord: vi.fn(async () => {}),
    playNote: vi.fn(async () => {}),
    playSequence: vi.fn(async () => {}),
    stop: vi.fn(),
    setTempo: vi.fn(),
    setVolume: vi.fn(),
  }
}
