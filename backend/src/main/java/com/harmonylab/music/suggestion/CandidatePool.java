package com.harmonylab.music.suggestion;

import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordQuality;
import com.harmonylab.music.Interval;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;
import com.harmonylab.music.NoteName;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Builds the set of chords the suggestion engine considers for a key. The pool is intentionally limited to
 * chords with a clear tonal rationale (diatonic chords, common chromatic chords and colour variants),
 * rather than all 12 × 15 possible chords, so that every suggestion can be explained.
 */
public final class CandidatePool {

    public record Entry(Chord chord, CandidateSource source) {
    }

    private CandidatePool() {
    }

    public static List<Entry> build(Key key) {
        List<Entry> entries = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (Chord chord : key.diatonicChords(false)) {
            add(entries, seen, chord, CandidateSource.DIATONIC_TRIAD);
        }
        for (Chord chord : key.diatonicChords(true)) {
            add(entries, seen, chord, CandidateSource.DIATONIC_SEVENTH);
        }
        if (key.mode() == Mode.MINOR) {
            NoteName dominant = key.tonic().transpose(Interval.PERFECT_FIFTH);
            NoteName leadingTone = key.tonic().transpose(Interval.MAJOR_SEVENTH);
            add(entries, seen, new Chord(dominant, ChordQuality.MAJOR, 0), CandidateSource.HARMONIC_MINOR);
            add(entries, seen, new Chord(dominant, ChordQuality.DOMINANT7, 0), CandidateSource.HARMONIC_MINOR);
            // V7b9: the flat ninth is the minor key's own sixth degree, the classic minor-key dominant colour
            add(entries, seen, new Chord(dominant, ChordQuality.DOMINANT7_FLAT9, 0), CandidateSource.HARMONIC_MINOR);
            add(entries, seen, new Chord(leadingTone, ChordQuality.DIMINISHED7, 0), CandidateSource.HARMONIC_MINOR);
        }
        for (int degree = 2; degree <= 7; degree++) {
            Chord target = key.diatonicChord(degree, false);
            if (target.quality() == ChordQuality.DIMINISHED || target.quality() == ChordQuality.AUGMENTED) {
                continue; // diminished and augmented triads are not tonicised in common practice
            }
            NoteName root = target.root().transpose(Interval.PERFECT_FIFTH);
            add(entries, seen, new Chord(root, ChordQuality.DOMINANT7, 0), CandidateSource.SECONDARY_DOMINANT);
        }
        try {
            for (Chord chord : key.parallel().diatonicChords(false)) {
                if (!key.isDiatonic(chord)) {
                    add(entries, seen, chord, CandidateSource.BORROWED);
                }
            }
        } catch (InvalidMusicInputException theoreticalParallelKey) {
            // e.g. G# minor's parallel key is G# major (8 sharps); skip borrowed chords in that case
        }
        for (Chord triad : key.diatonicChords(false)) {
            ChordQuality[] variants = triad.quality() == ChordQuality.MAJOR
                    ? new ChordQuality[]{ChordQuality.SUS2, ChordQuality.SUS4, ChordQuality.ADD9, ChordQuality.MAJOR6,
                            ChordQuality.MAJOR9, ChordQuality.DOMINANT9, ChordQuality.DOMINANT13}
                    : new ChordQuality[]{ChordQuality.SUS2, ChordQuality.SUS4, ChordQuality.MINOR_ADD9, ChordQuality.MINOR9,
                            ChordQuality.MINOR11};
            if (triad.quality() == ChordQuality.DIMINISHED) {
                continue;
            }
            for (ChordQuality quality : variants) {
                Chord variant = new Chord(triad.root(), quality, 0);
                if (key.isDiatonic(variant)) {
                    add(entries, seen, variant, CandidateSource.COLOR_VARIANT);
                }
            }
        }
        return List.copyOf(entries);
    }

    private static void add(List<Entry> entries, Set<String> seen, Chord chord, CandidateSource source) {
        String id = chord.root().pitchClass().value() + ":" + chord.quality();
        if (seen.add(id)) {
            entries.add(new Entry(chord, source));
        }
    }
}
