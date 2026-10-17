# The Harmony Lab music engine

All code referenced here lives in `backend/src/main/java/com/harmonylab/music` and is plain Java with no
framework dependencies. Every rule below is deterministic: identical input always gives identical output.

## Pitch and spelling

| Concept | Type | Notes |
|---|---|---|
| Pitch class | `PitchClass(0..11)` | 0 = C. Used for comparisons that ignore octave and spelling. |
| Spelled note | `NoteName(Letter, accidental -2..+2)` | C#, Db and B## are different names. |
| Absolute note | `Note(NoteName, octave)` | Scientific pitch notation, C4 = MIDI 60. The octave belongs to the letter (B#3 = 60). |
| Interval | `Interval(degree, semitones)` | Keeps both generic size and exact size, so A4 (C–F#) ≠ d5 (C–Gb). |

Transposing a `NoteName` by an `Interval` moves the **letter** by the interval's degree and then picks the
accidental that produces the right number of semitones. This is why chord and scale spelling is correct
(F major contains Bb, F# major contains E#, Db minor is Db–Fb–Ab). If a spelling would need a triple
accidental, the simplest enharmonic name is used instead.

## Chords

`ChordQuality` defines each quality by its intervals above the root (15 qualities: triads, sus2/sus4,
sevenths, sixths, add9 and minor add9). A `Chord` is `(root, quality, inversion)`. The bass is the
`inversion`-th chord tone. `ChordSymbol` is the only place where text is parsed or produced:
`[A-G][#|b|##|bb]` + suffix + optional `/bass`, and the bass must be a chord tone.

**Identification** (`ChordIdentifier`) tries every pitch class of the input as a root against every
quality and keeps the exact matches. Results are ranked:
1. root in the bass first,
2. then `identificationPriority` (triads and sevenths before sixths, sus and add9),
3. then root pitch class.

So `{C,E,G,A}` with C in the bass is `C6` then `Am7/C`, and with A in the bass `Am7` then `C6/A`. Every
interpretation is returned, because note sets are ambiguous.

## Keys and Roman numerals

`Key(tonic, Mode)` supports major and natural minor. Theoretical keys (more than 7 sharps or flats) are
rejected with a hint to use the enharmonic key. Diatonic chords are built by stacking scale thirds.

A Roman numeral's **degree** comes from the root's *letter* relative to the tonic letter. Its
**alteration** is the root's difference from that scale degree (so Ab in C major is `bVI`, G# in A minor
is `#vii°`). Case follows the third (upper case for a major third or a suspended chord), and suffixes are
`°`, `ø7`, `+`, `7`, `maj7`, `6`, `sus4`, `add9`. Inversions of triads and seventh chords use figured bass
(`6`, `6/4`, `6/5`, `4/3`, `4/2`).

## Chord interpretation (`ChordInterpreter`)

Rules are tried in order and the first match wins:

1. **Diatonic**: every note is in the scale. The function comes from a degree table. In major: I = T,
   ii/IV = PD, V/vii° = D, iii and vi = T (tentative). In minor: i = T, ii°/iv = PD, v = D (tentative,
   no leading tone), III = T (tentative), VI = PD (tentative), VII = D (tentative).
2. **Harmonic minor** (minor keys): fits the scale with a raised 7th, e.g. `V`, `V7` or `vii°7` in minor.
   This is a confident dominant.
3. **Secondary dominant**: a major or dominant-seventh chord whose root is a fifth above a diatonic,
   non-diminished, non-tonic degree (`V7/ii`). It is labelled confident only when the next chord actually
   is that target.
4. **Borrowed**: fits the parallel key's scale (`iv`, `bVI`, `bVII` in major). Its function comes from the
   parallel key's table and is marked tentative.
5. **Chromatic**: none of the above apply, so no function is assigned (the UI shows "unclear").

## Progression analysis (`HarmonicAnalyzer`)

For each adjacent pair it reports:
* root motion (e.g. "descending fifth"),
* common tones,
* a conventional label (dominant → tonic, predominant → dominant, deceptive motion, plagal motion,
  dominant → predominant),
* and, if both chords are voiced, the voice-leading metrics below.

The cadence is detected from the last two chords (authentic, leading-tone, plagal, deceptive, half).

Observations are typed. **FACT**s are counts and measurements: the number of chords, diatonic share, notes
outside the scale, the cadence, stepwise motions and the largest leap. **HEURISTIC**s are conventions:
shared tones sound smooth, parallel fifths are avoided in classical style, an unresolved secondary dominant
may be heard as colour, ending on V sounds open. No statement is hard-coded for any particular
progression, and the engine makes no claims about emotional meaning.

## Voice leading

### Candidate voicings (`VoicingGenerator.candidates`)

Every voicing that uses each chord tone exactly once, inside the register, at most 24 semitones wide, with
upper voices at most an octave apart (and the bass at most a 12th below the next voice). Optionally, the
bass must be the chord's bass, which preserves the inversion. Results are sorted lexicographically, so
ties always break the same way.

### Pairing voices (`VoiceLeadingEvaluator.pair`)

* **Same number of notes:** pair lowest with lowest, and so on. For points on a line, the
  order-preserving matching minimises the total absolute movement, and it never crosses voices.
* **Different number of notes:** a DP over `dp[i][j]` = the cheapest order-preserving matching where every
  note of the larger chord is paired with exactly one note of the smaller one (a voice splits or merges).
  This takes O(n·m) time.

### Cost function

```
cost = 1 · Σ |movement of each voice|               (semitones)
     + 1 · Σ max(0, |movement| − 5)                 (leaps beyond a perfect fourth cost extra)
     + 4 · crossings                                (voices swap order; only possible in explicit assignments)
     + 3 · overlaps                                 (a voice moves past its neighbour's previous pitch)
     + 2 · parallel perfect fifths/octaves          (both voices move the same way and keep a P5/P8)
     + 1 · |difference in number of voices|
```

The weights are hand-tuned to encode common-practice preferences (small motion, independent voices).
They are a ranking heuristic, not a perceptual model.

### Ranking (`VoiceLeadingOptimizer`)

All candidates are evaluated against the previous voicing and sorted by cost, then total movement, then
closeness to the previous voicing's centre, then lexicographically. Each result carries factual
explanations (held notes, number of stepwise voices, leaps, parallels, inversion).

### Whole progression (`ProgressionVoicer`)

This is a Viterbi-style dynamic program. `best[i][c]` is the cheapest total cost of voicing chords 0..i
when chord i uses candidate c, computed from `best[i-1][p] + cost(p → c)`. The start state may be fixed
(keep the user's first voicing) or chosen with a small preference for compact, centred voicings. Unlike a
greedy chord-by-chord choice, this minimises the *sum* of transition costs. Complexity is O(n·k²) for n
chords and k candidates per chord. A unit test checks that it is never worse than greedy.

## Suggestions (`SuggestionEngine`)

1. **Pool** (`CandidatePool`): diatonic triads and sevenths, harmonic-minor dominants in minor, V7 of each
   diatonic non-diminished degree, borrowed triads from the parallel key, and sus2/sus4/add9/6 variants
   that stay in the key. Candidates with the same notes as the replaced chord or either neighbour are
   skipped.
2. **Placement:** each candidate is voiced twice, once with the smoothest voicing in any inversion and once
   with the smoothest root-position voicing. The objective decides which variant wins, and only the best
   variant per chord is shown.
3. **Features** (each 0–1):
   * smoothness = `1 − avg(cost from previous, cost to next) / 16`;
   * shared-tone ratio with the replaced chord;
   * resolution: root falling a fifth into the next chord, dominant quality, a leading tone, a
     predominant before a dominant; at the end of the progression, closing on the tonic, reduced for an
     inverted or suspended tonic;
   * whether the conventional function matches the replaced chord's;
   * colour: four-note chord, sus/add/6, notes outside the key;
   * whether the candidate has the same root as the replaced chord.
4. **Objective weights** (points, total 100):

| Objective | Weights | Filter |
|---|---|---|
| Smooth voice leading | smoothness 55, shared tones 25, diatonic 20 | none |
| Stronger resolution | resolution 55, smoothness 20, tonal context 15, shared tones 10 | resolution > 0 |
| Diatonic alternatives | same function 35, shared tones 30, smoothness 20, different root 15 | diatonic only |
| More harmonic colour | colour 40, shared tones 30, smoothness 30 | colour > 0 |

Candidates below 35 points are dropped. If none remain, the response says so instead of padding the list.
The point breakdown is returned with every suggestion.

`AlternativeGenerator` builds whole-progression alternatives. One is the DP re-voicing. The others are, for
each objective, the single best-scoring replacement anywhere in the progression.

## Improvisation guide (`improvisation/ImprovisationGuide`)

For a chord in a key, every pitch class gets one role:

1. **Chord scale.** Start from the key's scale and let each chord tone replace the scale note with the same
   letter. E7 in A minor gives A B C D E F G#, and C7 in C major gives C D E F G A Bb.
2. **Root and chord tones.** These are the most stable targets.
3. **Scale notes.** These are safe, *unless* they lie a semitone above a chord tone. Such "avoid notes" (F
   over Cmaj7, C over G7) clash when held but work in passing, so they count as **tensions**.
4. **Dominant chords.** On a dominant seventh, or a major triad with dominant function, b9, #9 and b13 are
   added as tensions when they are not already in the chord scale.
5. **Blue notes.** In major, b3 and b5 are added as tensions; in minor, b5 is. This happens only when the
   note has no other role.

Tension names use the key's spelling when the note belongs to the key (G rather than F## for the #9 of E7
in A minor). Every note carries a short reason, presented as a stylistic convention.

`ProgressionPresets` defines common progressions by scale degree and quality. It realises them in any key
of the matching mode, and the voicings come from `ProgressionVoicer`.
