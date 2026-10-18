package com.harmonylab.music;

import java.util.List;

import static com.harmonylab.music.Interval.*;

/**
 * Supported key modes. MINOR is the natural minor (Aeolian) scale and MAJOR the Ionian scale; their ids are
 * kept for compatibility with saved projects.
 *
 * <p>Two properties drive the analysis:
 * <ul>
 *   <li>{@link #isTonal()}: major and the three minor scales use tonic/predominant/dominant functions; in the
 *   church modes only the tonic chord gets a function, the others are described by their colour.</li>
 *   <li>{@link #signatureMode()}: the scale whose accidentals form the key signature. Harmonic and melodic minor
 *   are written with the natural minor's signature plus accidentals, so D# harmonic minor (6 sharps) is a real
 *   key even though its scale contains C##.</li>
 * </ul>
 */
public enum Mode {
    MAJOR("major", 1, List.of(PERFECT_UNISON, MAJOR_SECOND, MAJOR_THIRD, PERFECT_FOURTH, PERFECT_FIFTH, MAJOR_SIXTH, MAJOR_SEVENTH)),
    MINOR("minor", 6, List.of(PERFECT_UNISON, MAJOR_SECOND, MINOR_THIRD, PERFECT_FOURTH, PERFECT_FIFTH, MINOR_SIXTH, MINOR_SEVENTH)),
    HARMONIC_MINOR("harmonic minor", 0, List.of(PERFECT_UNISON, MAJOR_SECOND, MINOR_THIRD, PERFECT_FOURTH, PERFECT_FIFTH, MINOR_SIXTH, MAJOR_SEVENTH)),
    MELODIC_MINOR("melodic minor", 0, List.of(PERFECT_UNISON, MAJOR_SECOND, MINOR_THIRD, PERFECT_FOURTH, PERFECT_FIFTH, MAJOR_SIXTH, MAJOR_SEVENTH)),
    DORIAN("Dorian", 2, List.of(PERFECT_UNISON, MAJOR_SECOND, MINOR_THIRD, PERFECT_FOURTH, PERFECT_FIFTH, MAJOR_SIXTH, MINOR_SEVENTH)),
    PHRYGIAN("Phrygian", 3, List.of(PERFECT_UNISON, MINOR_SECOND, MINOR_THIRD, PERFECT_FOURTH, PERFECT_FIFTH, MINOR_SIXTH, MINOR_SEVENTH)),
    LYDIAN("Lydian", 4, List.of(PERFECT_UNISON, MAJOR_SECOND, MAJOR_THIRD, AUGMENTED_FOURTH, PERFECT_FIFTH, MAJOR_SIXTH, MAJOR_SEVENTH)),
    MIXOLYDIAN("Mixolydian", 5, List.of(PERFECT_UNISON, MAJOR_SECOND, MAJOR_THIRD, PERFECT_FOURTH, PERFECT_FIFTH, MAJOR_SIXTH, MINOR_SEVENTH)),
    LOCRIAN("Locrian", 7, List.of(PERFECT_UNISON, MINOR_SECOND, MINOR_THIRD, PERFECT_FOURTH, DIMINISHED_FIFTH, MINOR_SIXTH, MINOR_SEVENTH));

    private final String label;
    private final int majorScaleDegree;
    private final List<Interval> scaleIntervals;

    Mode(String label, int majorScaleDegree, List<Interval> scaleIntervals) {
        this.label = label;
        this.majorScaleDegree = majorScaleDegree;
        this.scaleIntervals = scaleIntervals;
    }

    public String label() {
        return label;
    }

    public List<Interval> scaleIntervals() {
        return scaleIntervals;
    }

    /** For the seven modes of the major scale, the degree of the major scale they start on (Dorian = 2); else 0. */
    public int majorScaleDegree() {
        return majorScaleDegree;
    }

    public boolean hasMinorThird() {
        return scaleIntervals.get(2).equals(MINOR_THIRD);
    }

    public boolean isTonal() {
        return this == MAJOR || this == MINOR || this == HARMONIC_MINOR || this == MELODIC_MINOR;
    }

    public Mode signatureMode() {
        return this == HARMONIC_MINOR || this == MELODIC_MINOR ? MINOR : this;
    }

    /**
     * The mode chords are borrowed from (modal mixture). Major and the three minors borrow from each other; a
     * church mode borrows from the closest of the two (Dorian from natural minor, Mixolydian from major).
     */
    public Mode parallel() {
        return switch (this) {
            case MAJOR, DORIAN, PHRYGIAN, LOCRIAN -> MINOR;
            case MINOR, HARMONIC_MINOR, MELODIC_MINOR, LYDIAN, MIXOLYDIAN -> MAJOR;
        };
    }

    public static Mode fromId(String id) {
        if (id == null || id.isBlank()) {
            throw new InvalidMusicInputException("Key mode is empty");
        }
        try {
            return valueOf(id.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidMusicInputException("Unsupported mode '" + id + "'. Use one of: "
                    + String.join(", ", java.util.Arrays.stream(values()).map(Enum::name).toList()) + ".");
        }
    }
}
