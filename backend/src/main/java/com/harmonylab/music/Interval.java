package com.harmonylab.music;

/**
 * A spelled interval: a generic size ({@code degree}: 1 = unison, 3 = third, 9 = ninth, ...)
 * plus an exact size in semitones. Keeping both distinguishes e.g. an augmented fourth (C-F#)
 * from a diminished fifth (C-Gb), which have the same semitone count.
 */
public record Interval(int degree, int semitones) {

    public static final Interval PERFECT_UNISON = new Interval(1, 0);
    public static final Interval MINOR_SECOND = new Interval(2, 1);
    public static final Interval MAJOR_SECOND = new Interval(2, 2);
    public static final Interval MINOR_THIRD = new Interval(3, 3);
    public static final Interval MAJOR_THIRD = new Interval(3, 4);
    public static final Interval PERFECT_FOURTH = new Interval(4, 5);
    public static final Interval AUGMENTED_FOURTH = new Interval(4, 6);
    public static final Interval DIMINISHED_FIFTH = new Interval(5, 6);
    public static final Interval PERFECT_FIFTH = new Interval(5, 7);
    public static final Interval AUGMENTED_FIFTH = new Interval(5, 8);
    public static final Interval MINOR_SIXTH = new Interval(6, 8);
    public static final Interval MAJOR_SIXTH = new Interval(6, 9);
    public static final Interval DIMINISHED_SEVENTH = new Interval(7, 9);
    public static final Interval MINOR_SEVENTH = new Interval(7, 10);
    public static final Interval MAJOR_SEVENTH = new Interval(7, 11);
    public static final Interval PERFECT_OCTAVE = new Interval(8, 12);
    public static final Interval MAJOR_NINTH = new Interval(9, 14);

    /** Semitones of the major/perfect form of each simple degree (index 1..7). */
    private static final int[] REFERENCE_SEMITONES = {0, 0, 2, 4, 5, 7, 9, 11};
    private static final String[] DEGREE_NAMES = {"", "unison", "second", "third", "fourth", "fifth",
            "sixth", "seventh", "octave", "ninth", "tenth", "eleventh", "twelfth", "thirteenth"};

    public Interval {
        if (degree < 1 || degree > 15) {
            throw new IllegalArgumentException("Interval degree must be in [1, 15], got " + degree);
        }
        if (semitones < -1 || semitones > 26) {
            throw new IllegalArgumentException("Unsupported interval size " + semitones);
        }
    }

    /** Ascending interval between two spelled notes within one octave (e.g. C to Eb = minor third). */
    public static Interval between(NoteName lower, NoteName upper) {
        int degree = lower.letter().stepsTo(upper.letter()) + 1;
        int semitones = lower.pitchClass().semitonesUpTo(upper.pitchClass());
        int reference = REFERENCE_SEMITONES[degree];
        // Pick the octave-equivalent size closest to the reference (handles e.g. C to B#, an augmented seventh).
        if (semitones - reference < -6) {
            semitones += 12;
        } else if (semitones - reference > 6) {
            semitones -= 12;
        }
        return new Interval(degree, semitones);
    }

    /** Interval between two absolute notes; {@code upper} must not be lower than {@code lower}. */
    public static Interval between(Note lower, Note upper) {
        int semitones = upper.midi() - lower.midi();
        if (semitones < 0) {
            throw new IllegalArgumentException(upper + " is below " + lower);
        }
        int letterSteps = (upper.octave() * 7 + upper.name().letter().ordinal())
                - (lower.octave() * 7 + lower.name().letter().ordinal());
        return new Interval(letterSteps + 1, semitones);
    }

    public boolean isPerfectType() {
        int simple = simpleDegree();
        return simple == 1 || simple == 4 || simple == 5;
    }

    public int simpleDegree() {
        return (degree - 1) % 7 + 1;
    }

    private int octaves() {
        return (degree - 1) / 7;
    }

    /** Deviation from the major/perfect form: 0 = major/perfect, -1 = minor (or diminished for perfect types), ... */
    private int deviation() {
        return semitones - (REFERENCE_SEMITONES[simpleDegree()] + 12 * octaves());
    }

    /** Short name such as P5, m3, M7, d5, A4. */
    public String shortName() {
        return qualityLetter() + degree;
    }

    /** Long name such as "perfect fifth" or "minor third". */
    public String fullName() {
        String quality = switch (qualityLetter()) {
            case "P" -> "perfect";
            case "M" -> "major";
            case "m" -> "minor";
            case "A" -> "augmented";
            case "d" -> "diminished";
            case "AA" -> "doubly augmented";
            default -> "doubly diminished";
        };
        String degreeName = degree < DEGREE_NAMES.length ? DEGREE_NAMES[degree] : degree + "th";
        return quality + " " + degreeName;
    }

    private String qualityLetter() {
        int dev = deviation();
        if (isPerfectType()) {
            return switch (dev) {
                case 0 -> "P";
                case 1 -> "A";
                case -1 -> "d";
                default -> dev > 0 ? "AA" : "dd";
            };
        }
        return switch (dev) {
            case 0 -> "M";
            case -1 -> "m";
            case 1 -> "A";
            case -2 -> "d";
            default -> dev > 0 ? "AA" : "dd";
        };
    }

    @Override
    public String toString() {
        return shortName();
    }
}
