// Mirrors of the backend DTOs (see backend com.harmonylab.*.dto / *Dtos). Kept in one place so that
// API contract changes surface as type errors.

export type Mode =
  | 'MAJOR' | 'MINOR' | 'HARMONIC_MINOR' | 'MELODIC_MINOR'
  | 'DORIAN' | 'PHRYGIAN' | 'LYDIAN' | 'MIXOLYDIAN' | 'LOCRIAN'

export interface KeyDto {
  tonic: string
  mode: Mode
}

export interface RegisterDto {
  low: number
  high: number
}

export interface IntervalView {
  note: string
  name: string
  fullName: string
  semitones: number
}

export interface ChordView {
  symbol: string
  root: string
  quality: string
  qualityName: string
  inversion: number
  bass: string
  notes: string[]
  notesFromBass: string[]
  pitchClasses: number[]
  intervals: IntervalView[]
  voicing: number[] | null
  voicingNotes: string[] | null
  durationBeats: number | null
  /** Playback pattern of a saved chord; null outside projects. */
  pattern?: string | null
}

/** A chord with a concrete voicing, as used throughout the workspace. */
export type VoicedChord = ChordView & { voicing: number[]; voicingNotes: string[] }

export interface ChordInput {
  root: string
  quality: string
  inversion: number
  voicing?: number[]
  durationBeats?: number
  pattern?: string
}

export interface QualityInfo {
  id: string
  name: string
  suffix: string
  family: string
  intervals: string[]
  size: number
}

export interface ObjectiveInfo {
  id: Objective
  label: string
  description: string
}

export interface Catalog {
  qualities: QualityInfo[]
  roots: string[]
  keyTonics: Partial<Record<Mode, string[]>>
  objectives: ObjectiveInfo[]
  voicingStyles: VoicingStyle[]
  defaultRegister: RegisterDto
  pitchConvention: string
}

export type VoicingStyle = 'CLOSE' | 'OPEN' | 'DROP2' | 'FOUR_PART'
export type Objective = 'SMOOTH_VOICE_LEADING' | 'STRONGER_RESOLUTION' | 'DIATONIC_ALTERNATIVES' | 'HARMONIC_COLOR'

export interface InterpretationView {
  label: string
  category: ChordCategory
  function: HarmonicFunction | null
  functionConfident: boolean
  notesOutsideScale: string[]
  explanation: string
}

export type ChordCategory = 'DIATONIC' | 'HARMONIC_MINOR' | 'SECONDARY_DOMINANT' | 'BORROWED' | 'CHROMATIC'
export type HarmonicFunction = 'TONIC' | 'PREDOMINANT' | 'DOMINANT'

export interface ChordDetails {
  chord: VoicedChord
  inversions: VoicedChord[]
  relation: InterpretationView | null
}

export interface IdentifyResponse {
  candidates: { chord: VoicedChord; rootPosition: boolean; explanation: string }[]
  message: string
}

export interface DiatonicChordView {
  degree: number
  roman: string
  function: HarmonicFunction | null
  chord: ChordView
}

export interface KeyView {
  tonic: string
  mode: Mode
  label: string
  scale: string[]
  signature: number
  signatureText: string
  triads: DiatonicChordView[]
  sevenths: DiatonicChordView[]
}

export interface MotionView {
  from: number
  to: number
  semitones: number
  fromNote: string
  toNote: string
}

export interface VoiceLeadingView {
  totalMovement: number
  heldVoices: number
  stepwiseVoices: number
  leaps: number
  largestMove: number
  crossings: number
  overlaps: number
  parallelPerfects: number
  cost: number
  motions: MotionView[]
}

export interface ChordAnalysisView {
  index: number
  symbol: string
  label: string
  category: ChordCategory
  function: HarmonicFunction | null
  functionConfident: boolean
  notesOutsideScale: string[]
  explanation: string
}

export interface TransitionView {
  fromIndex: number
  toIndex: number
  rootMotion: string
  commonTones: string[]
  functionalLabel: string | null
  voiceLeading: VoiceLeadingView | null
}

export interface ObservationView {
  kind: 'FACT' | 'HEURISTIC'
  severity: 'INFO' | 'WARNING'
  message: string
}

export interface MetricsView {
  chordCount: number
  diatonicCount: number
  distinctChords: number
  totalVoiceMovement: number
  averageMovementPerTransition: number
  heldVoices: number
  stepwiseMotions: number
  totalMotions: number
  parallelPerfects: number
  commonToneTotal: number
  startsOnTonic: boolean
  endsOnTonic: boolean
  cadence: string | null
}

export interface AnalysisResponse {
  key: string
  chords: ChordAnalysisView[]
  transitions: TransitionView[]
  observations: ObservationView[]
  metrics: MetricsView
  summary: string
}

export interface RankedVoicingView {
  rank: number
  chord: VoicedChord
  voiceLeading: VoiceLeadingView
  reasons: string[]
}

export interface VoiceLeadingResponse {
  candidates: RankedVoicingView[]
  costFunction: string
}

export interface OptimizeResponse {
  chords: VoicedChord[]
  totalMovement: number
  totalCost: number
}

export interface SuggestionView {
  chord: VoicedChord
  romanLabel: string
  category: ChordCategory
  source: string
  score: number
  breakdown: Record<string, number>
  reasons: string[]
}

export interface SuggestionResponse {
  objective: Objective
  objectiveLabel: string
  message: string
  suggestions: SuggestionView[]
}

export interface AlternativeView {
  title: string
  objective: Objective | null
  description: string
  changedIndex: number | null
  chords: VoicedChord[]
  metrics: MetricsView
}

export interface AlternativesResponse {
  current: MetricsView
  alternatives: AlternativeView[]
}

export interface ProjectResponse {
  id: string
  name: string
  key: KeyDto
  tempoBpm: number
  register: RegisterDto
  chords: VoicedChord[]
  version: number
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  key: KeyDto
  keyLabel: string
  tempoBpm: number
  chordCount: number
  preview: string[]
  version: number
  createdAt: string
  updatedAt: string
}

export interface ProjectRequest {
  name: string
  key: KeyDto
  tempoBpm: number
  register: RegisterDto
  chords: ChordInput[]
  version?: number
}

export type GuideRole = 'ROOT' | 'CHORD_TONE' | 'SCALE' | 'TENSION'

export interface GuideNoteView {
  pitchClass: number
  note: string
  role: GuideRole
  reason: string
}

export interface PresetView {
  id: string
  name: string
  description: string
  mode: Mode
  chords: VoicedChord[]
}

export interface ImprovisationResponse {
  key: string
  chords: { chord: VoicedChord; guide: GuideNoteView[] }[]
  legend: string
}

export interface KeyCandidateView {
  key: KeyDto
  label: string
  correlation: number
}

export interface KeyDetectionResponse {
  candidates: KeyCandidateView[]
  confidence: 'STRONG' | 'MODERATE' | 'WEAK'
  explanation: string
}

export interface TransposeResponse {
  key: KeyDto
  keyLabel: string
  chords: VoicedChord[]
}
