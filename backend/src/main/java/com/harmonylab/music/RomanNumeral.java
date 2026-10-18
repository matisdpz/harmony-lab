package com.harmonylab.music;

/**
 * A Roman numeral label for a chord relative to a key.
 *
 * @param degree     scale degree of the root, 1..7, counted by letter name from the tonic
 * @param alteration chromatic alteration of the root relative to the key's own scale (-1 = flat, +1 = sharp)
 * @param quality    chord quality, which determines case and suffix
 * @param inversion  inversion, rendered as figured-bass numbers for triads and seventh chords
 */
public record RomanNumeral(int degree, int alteration, ChordQuality quality, int inversion) {

    private static final String[] NUMERALS = {"", "I", "II", "III", "IV", "V", "VI", "VII"};

    public RomanNumeral {
        if (degree < 1 || degree > 7) {
            throw new IllegalArgumentException("Degree must be 1..7");
        }
    }

    /** Computes the numeral of a chord in a key. Degree comes from the letter name, so spelling matters. */
    public static RomanNumeral of(Chord chord, Key key) {
        int degree = key.tonic().letter().stepsTo(chord.root().letter()) + 1;
        NoteName scaleNote = key.scale().get(degree - 1);
        int alteration = Math.floorMod(chord.root().pitchClass().value() - scaleNote.pitchClass().value() + 6, 12) - 6;
        return new RomanNumeral(degree, alteration, chord.quality(), chord.inversion());
    }

    public String format() {
        String prefix = alteration < 0 ? "b".repeat(-alteration) : "#".repeat(Math.max(0, alteration));
        String numeral = NUMERALS[degree];
        boolean upper = quality.hasMajorThird() || quality.isDominantType() || quality.family() == ChordQuality.Family.SUSPENDED;
        String base = upper ? numeral : numeral.toLowerCase();
        String suffix = switch (quality) {
            case MAJOR, MINOR -> "";
            case DIMINISHED -> "°";
            case AUGMENTED -> "+";
            case SUS2 -> "sus2";
            case SUS4 -> "sus4";
            case MAJOR7 -> "maj7";
            case MINOR7, DOMINANT7 -> "7";
            case HALF_DIMINISHED7 -> "ø7";
            case DIMINISHED7 -> "°7";
            case MINOR_MAJOR7 -> "maj7";
            case AUGMENTED_MAJOR7 -> "+maj7";
            case MAJOR6, MINOR6 -> "6";
            case ADD9, MINOR_ADD9 -> "add9";
            case DOMINANT9, MINOR9 -> "9";
            case MAJOR9 -> "maj9";
            case DOMINANT11, MINOR11 -> "11";
            case DOMINANT13 -> "13";
            case DOMINANT7_FLAT9 -> "7b9";
            case DOMINANT7_SHARP9 -> "7#9";
            case DOMINANT7_SHARP11 -> "7#11";
            case DOMINANT7_FLAT13 -> "7b13";
            case ALTERED -> "7alt";
        };
        return prefix + base + applyFigures(suffix);
    }

    /** Figured-bass inversion symbols: triads 6, 6/4; seventh chords 6/5, 4/3, 4/2. */
    private String applyFigures(String suffix) {
        if (inversion == 0) {
            return suffix;
        }
        if (quality.family() == ChordQuality.Family.TRIAD) {
            return suffix + (inversion == 1 ? "6" : "6/4");
        }
        if (quality.family() == ChordQuality.Family.SEVENTH) {
            String figures = switch (inversion) {
                case 1 -> "6/5";
                case 2 -> "4/3";
                default -> "4/2";
            };
            // the "7" is implied by the figures (V7 in first inversion is V6/5)
            String stripped = suffix.endsWith("7") ? suffix.substring(0, suffix.length() - 1) : suffix;
            return stripped + figures;
        }
        return suffix + " (inv. " + inversion + ")";
    }

    @Override
    public String toString() {
        return format();
    }
}
