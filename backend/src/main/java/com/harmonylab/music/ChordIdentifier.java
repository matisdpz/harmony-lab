package com.harmonylab.music;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Identifies chords from a set of absolute pitches (MIDI numbers).
 *
 * <p>Identification is inherently ambiguous: {C, E, G, A} is both C6 and Am7, and symmetric chords
 * (augmented, diminished seventh) have several equally valid roots. This class therefore returns
 * <em>all</em> exact matches, ranked deterministically:
 * <ol>
 *   <li>interpretations whose root is the lowest note (root position) first;</li>
 *   <li>then by {@link ChordQuality#identificationPriority()} (triads and sevenths before sixths/sus/add9);</li>
 *   <li>then by root pitch class.</li>
 * </ol>
 * Limitations: only exact pitch-class matches are found (no omitted fifths, no extensions beyond the
 * supported qualities, no non-chord-tone bass notes).
 */
public final class ChordIdentifier {

    private ChordIdentifier() {
    }

    public static List<ChordCandidate> identify(Collection<Integer> midiNotes, Key keyContext) {
        if (midiNotes == null || midiNotes.isEmpty()) {
            throw new InvalidMusicInputException("Select at least one note to identify a chord");
        }
        Set<Integer> pitchClasses = new TreeSet<>();
        midiNotes.forEach(midi -> pitchClasses.add(Math.floorMod(midi, 12)));
        int bassPitchClass = Math.floorMod(midiNotes.stream().min(Integer::compare).orElseThrow(), 12);

        List<ChordCandidate> candidates = new ArrayList<>();
        for (int rootPc : pitchClasses) {
            NoteName root = keyContext != null ? keyContext.spell(rootPc) : PitchClass.of(rootPc).defaultSpelling();
            for (ChordQuality quality : ChordQuality.values()) {
                Chord chord = new Chord(root, quality, 0);
                if (!chord.pitchClasses().equals(pitchClasses)) {
                    continue;
                }
                Chord inverted = chord.withBassPitchClass(bassPitchClass);
                boolean rootPosition = inverted.inversion() == 0;
                String explanation = quality.displayName() + " on " + root
                        + (rootPosition ? " in root position" : " with " + inverted.bass() + " in the bass");
                candidates.add(new ChordCandidate(inverted, rootPosition, explanation));
            }
        }
        candidates.sort(Comparator
                .comparing((ChordCandidate c) -> !c.rootPosition())
                .thenComparingInt(c -> c.chord().quality().identificationPriority())
                .thenComparingInt(c -> c.chord().root().pitchClass().value()));
        return List.copyOf(candidates);
    }
}
