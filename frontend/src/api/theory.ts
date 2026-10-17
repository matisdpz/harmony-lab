import { request } from './http'
import type {
  AlternativesResponse, AnalysisResponse, Catalog, ChordDetails, ChordInput, IdentifyResponse, ImprovisationResponse, KeyDto, KeyView,
  Objective, PresetView, OptimizeResponse, RegisterDto, SuggestionResponse, VoiceLeadingResponse, VoicingStyle,
} from './types'

export const theoryApi = {
  catalog: (signal?: AbortSignal) => request<Catalog>('GET', '/api/theory/catalog', undefined, signal),

  resolveChord: (body: {
    root: string
    quality: string
    inversion?: number
    style?: VoicingStyle
    register?: RegisterDto
    previousVoicing?: number[]
    key?: KeyDto
  }, signal?: AbortSignal) => request<ChordDetails>('POST', '/api/theory/chords/resolve', body, signal),

  parseChord: (body: { symbol: string; register?: RegisterDto; previousVoicing?: number[]; key?: KeyDto; style?: VoicingStyle }) =>
    request<ChordDetails>('POST', '/api/theory/chords/parse', body),

  identify: (midiNotes: number[], key?: KeyDto) =>
    request<IdentifyResponse>('POST', '/api/theory/chords/identify', { midiNotes, key }),

  key: (key: KeyDto, signal?: AbortSignal) =>
    request<KeyView>('GET', `/api/theory/keys?tonic=${encodeURIComponent(key.tonic)}&mode=${key.mode}`, undefined, signal),

  analyze: (key: KeyDto, chords: ChordInput[], signal?: AbortSignal) =>
    request<AnalysisResponse>('POST', '/api/theory/analyze', { key, chords }, signal),

  voiceLeading: (body: { fromVoicing: number[]; fromChord?: ChordInput; target: ChordInput; register?: RegisterDto; allowInversions?: boolean; limit?: number }, signal?: AbortSignal) =>
    request<VoiceLeadingResponse>('POST', '/api/theory/voice-leading', body, signal),

  optimize: (body: { chords: ChordInput[]; register?: RegisterDto; allowInversions?: boolean; keepFirstVoicing?: boolean }) =>
    request<OptimizeResponse>('POST', '/api/theory/voice-leading/optimize', body),

  suggestions: (body: { key: KeyDto; chords: ChordInput[]; selectedIndex: number; objective: Objective; register?: RegisterDto; limit?: number }, signal?: AbortSignal) =>
    request<SuggestionResponse>('POST', '/api/theory/suggestions', body, signal),

  presets: (key: KeyDto, signal?: AbortSignal) =>
    request<PresetView[]>('GET', `/api/theory/presets?tonic=${encodeURIComponent(key.tonic)}&mode=${key.mode}`, undefined, signal),

  improvisation: (body: { key: KeyDto; chords?: ChordInput[]; symbols?: string[]; register?: RegisterDto; beatsPerChord?: number }, signal?: AbortSignal) =>
    request<ImprovisationResponse>('POST', '/api/theory/improvisation', body, signal),

  alternatives: (body: { key: KeyDto; chords: ChordInput[]; register?: RegisterDto }, signal?: AbortSignal) =>
    request<AlternativesResponse>('POST', '/api/theory/alternatives', body, signal),
}
