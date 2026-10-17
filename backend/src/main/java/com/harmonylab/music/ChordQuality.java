package com.harmonylab.music;

import java.util.List;
import java.util.Optional;

import static com.harmonylab.music.Interval.*;

/**
 * Supported chord qualities, defined by their intervals above the root. The first symbol alias is
 * the canonical suffix used when formatting chord symbols. {@code identificationPriority} breaks ties
 * when one note set matches several chords (lower = preferred), e.g. Am7 is preferred over C6/A.
 */
public enum ChordQuality {
    MAJOR("Major triad", Family.TRIAD, 0, List.of(PERFECT_UNISON, MAJOR_THIRD, PERFECT_FIFTH), "", "maj", "M"),
    MINOR("Minor triad", Family.TRIAD, 0, List.of(PERFECT_UNISON, MINOR_THIRD, PERFECT_FIFTH), "m", "min", "-"),
    DIMINISHED("Diminished triad", Family.TRIAD, 0, List.of(PERFECT_UNISON, MINOR_THIRD, DIMINISHED_FIFTH), "dim", "°", "o"),
    AUGMENTED("Augmented triad", Family.TRIAD, 1, List.of(PERFECT_UNISON, MAJOR_THIRD, AUGMENTED_FIFTH), "aug", "+"),
    SUS2("Suspended second", Family.SUSPENDED, 3, List.of(PERFECT_UNISON, MAJOR_SECOND, PERFECT_FIFTH), "sus2"),
    SUS4("Suspended fourth", Family.SUSPENDED, 3, List.of(PERFECT_UNISON, PERFECT_FOURTH, PERFECT_FIFTH), "sus4", "sus"),
    MAJOR7("Major seventh", Family.SEVENTH, 1, List.of(PERFECT_UNISON, MAJOR_THIRD, PERFECT_FIFTH, MAJOR_SEVENTH), "maj7", "M7", "Δ7", "Δ", "ma7"),
    MINOR7("Minor seventh", Family.SEVENTH, 1, List.of(PERFECT_UNISON, MINOR_THIRD, PERFECT_FIFTH, MINOR_SEVENTH), "m7", "min7", "-7"),
    DOMINANT7("Dominant seventh", Family.SEVENTH, 1, List.of(PERFECT_UNISON, MAJOR_THIRD, PERFECT_FIFTH, MINOR_SEVENTH), "7", "dom7"),
    HALF_DIMINISHED7("Half-diminished seventh", Family.SEVENTH, 1, List.of(PERFECT_UNISON, MINOR_THIRD, DIMINISHED_FIFTH, MINOR_SEVENTH), "m7b5", "ø", "ø7", "min7b5"),
    DIMINISHED7("Diminished seventh", Family.SEVENTH, 1, List.of(PERFECT_UNISON, MINOR_THIRD, DIMINISHED_FIFTH, DIMINISHED_SEVENTH), "dim7", "°7", "o7"),
    MAJOR6("Major sixth", Family.SIXTH, 2, List.of(PERFECT_UNISON, MAJOR_THIRD, PERFECT_FIFTH, MAJOR_SIXTH), "6", "maj6"),
    MINOR6("Minor sixth", Family.SIXTH, 2, List.of(PERFECT_UNISON, MINOR_THIRD, PERFECT_FIFTH, MAJOR_SIXTH), "m6", "min6"),
    ADD9("Added ninth", Family.ADDED, 4, List.of(PERFECT_UNISON, MAJOR_THIRD, PERFECT_FIFTH, MAJOR_NINTH), "add9"),
    MINOR_ADD9("Minor added ninth", Family.ADDED, 4, List.of(PERFECT_UNISON, MINOR_THIRD, PERFECT_FIFTH, MAJOR_NINTH), "madd9", "m(add9)");

    public enum Family { TRIAD, SEVENTH, SIXTH, SUSPENDED, ADDED }

    private final String displayName;
    private final Family family;
    private final int identificationPriority;
    private final List<Interval> intervals;
    private final List<String> symbols;

    ChordQuality(String displayName, Family family, int identificationPriority, List<Interval> intervals, String... symbols) {
        this.displayName = displayName;
        this.family = family;
        this.identificationPriority = identificationPriority;
        this.intervals = intervals;
        this.symbols = List.of(symbols);
    }

    public String displayName() {
        return displayName;
    }

    public Family family() {
        return family;
    }

    public int identificationPriority() {
        return identificationPriority;
    }

    public List<Interval> intervals() {
        return intervals;
    }

    public int size() {
        return intervals.size();
    }

    /** Canonical suffix appended to the root in chord symbols ("" for major, "m7" for minor seventh...). */
    public String suffix() {
        return symbols.getFirst();
    }

    public List<String> aliases() {
        return symbols;
    }

    /** True when the chord has a major third above the root (used for upper/lower-case Roman numerals). */
    public boolean hasMajorThird() {
        return intervals.contains(MAJOR_THIRD);
    }

    public boolean hasMinorThird() {
        return intervals.contains(MINOR_THIRD);
    }

    /** Matches a suffix exactly (case-sensitive: "M7" is major seventh, "m7" is minor seventh). */
    public static Optional<ChordQuality> fromSuffix(String suffix) {
        for (ChordQuality quality : values()) {
            if (quality.symbols.contains(suffix)) {
                return Optional.of(quality);
            }
        }
        return Optional.empty();
    }

    /** Parses an enum id such as "MINOR7" (case-insensitive). */
    public static ChordQuality fromId(String id) {
        if (id == null || id.isBlank()) {
            throw new InvalidMusicInputException("Chord quality is empty");
        }
        try {
            return valueOf(id.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidMusicInputException("Unsupported chord quality '" + id + "'");
        }
    }

    /** Finds the quality whose semitone structure (above the root) equals the given one. */
    public static Optional<ChordQuality> fromSemitones(List<Integer> semitonesAboveRoot) {
        for (ChordQuality quality : values()) {
            List<Integer> own = quality.intervals.stream().map(i -> i.semitones() % 12).toList();
            if (own.equals(semitonesAboveRoot)) {
                return Optional.of(quality);
            }
        }
        return Optional.empty();
    }
}
