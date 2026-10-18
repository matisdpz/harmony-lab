package com.harmonylab.music.analysis;

import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordQuality;
import com.harmonylab.music.HarmonicFunction;
import com.harmonylab.music.Interval;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;
import com.harmonylab.music.NoteName;
import com.harmonylab.music.RomanNumeral;

import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static com.harmonylab.music.HarmonicFunction.DOMINANT;
import static com.harmonylab.music.HarmonicFunction.PREDOMINANT;
import static com.harmonylab.music.HarmonicFunction.TONIC;

/**
 * Interprets a single chord in a key. Rules are applied in a fixed order and the first match wins:
 * diatonic → harmonic minor (minor keys) → secondary dominant → borrowed from the parallel key → chromatic.
 *
 * <p>Function labels follow common textbook conventions (e.g. ii and IV are predominant). Where textbooks
 * disagree or context decides (iii, VI, VII in minor), the label is marked as not confident.
 */
public final class ChordInterpreter {

    private record FunctionEntry(HarmonicFunction function, boolean confident, String note) {
    }

    private ChordInterpreter() {
    }

    /**
     * @param next the following chord, used only to decide whether a secondary dominant resolves (may be null)
     */
    public static ChordInterpretation interpret(Key key, Chord chord, Chord next) {
        RomanNumeral numeral = RomanNumeral.of(chord, key);
        List<NoteName> outside = key.notesOutsideScale(chord);
        String symbol = chord.symbol();

        if (outside.isEmpty()) {
            FunctionEntry entry = functionByDegree(key.mode(), numeral.degree());
            String explanation = symbol + " is " + numeral.format() + " in " + key + " (all notes are in the scale)."
                    + describeFunction(entry);
            return new ChordInterpretation(chord, ChordCategory.DIATONIC, numeral, numeral.format(),
                    entry.function(), entry.confident(), outside, explanation);
        }

        String outsideText = joinNames(outside);
        if (key.mode() == Mode.MINOR && fitsScale(chord, harmonicMinor(key))) {
            FunctionEntry entry = switch (numeral.degree()) {
                case 5, 7 -> new FunctionEntry(DOMINANT, true, "the raised leading tone pulls toward the tonic");
                case 3 -> new FunctionEntry(TONIC, false, "the augmented III is rare and context-dependent");
                default -> functionByDegree(Mode.MINOR, numeral.degree());
            };
            String explanation = symbol + " is " + numeral.format() + " in " + key.tonic() + " harmonic minor: "
                    + outsideText + " is the raised seventh degree, the usual dominant colour in minor keys."
                    + describeFunction(entry);
            return new ChordInterpretation(chord, ChordCategory.HARMONIC_MINOR, numeral, numeral.format(),
                    entry.function(), entry.confident(), outside, explanation);
        }

        ChordInterpretation secondary = secondaryDominant(key, chord, numeral, next, outside);
        if (secondary != null) {
            return secondary;
        }

        if (fitsScale(chord, scalePitchClasses(key.tonic(), key.mode().parallel()))) {
            FunctionEntry entry = functionByDegree(key.mode().parallel(), numeral.degree());
            String explanation = symbol + " (" + numeral.format() + ") is borrowed from " + key.tonic() + " "
                    + key.mode().parallel().label() + " (modal mixture); " + outsideText
                    + (outside.size() > 1 ? " are" : " is") + " outside " + key + "." + describeFunction(entry);
            return new ChordInterpretation(chord, ChordCategory.BORROWED, numeral, numeral.format(),
                    entry.function(), false, outside, explanation);
        }

        String explanation = symbol + " contains " + outsideText + ", outside " + key
                + ". No diatonic, secondary-dominant or borrowed interpretation applies, so no function is assigned.";
        return new ChordInterpretation(chord, ChordCategory.CHROMATIC, numeral, numeral.format(), null, false,
                outside, explanation);
    }

    private static ChordInterpretation secondaryDominant(Key key, Chord chord, RomanNumeral numeral, Chord next,
                                                         List<NoteName> outside) {
        if (chord.quality() != ChordQuality.MAJOR && !chord.quality().isDominantType()) {
            return null;
        }
        NoteName target = chord.root().transpose(Interval.PERFECT_FOURTH);
        var degree = key.degreeOf(target.pitchClass().value());
        if (degree.isEmpty() || degree.get() == 1) {
            return null;
        }
        Chord targetChord = key.diatonicChord(degree.get(), false);
        if (targetChord.quality() == ChordQuality.DIMINISHED || targetChord.quality() == ChordQuality.AUGMENTED) {
            return null; // diminished and augmented triads are not tonicised in common practice
        }
        String targetLabel = RomanNumeral.of(targetChord, key).format();
        String label = (chord.quality() == ChordQuality.MAJOR ? "V/" : "V7/") + targetLabel;
        boolean resolves = next != null && next.root().pitchClass().equals(target.pitchClass());
        String explanation = chord.symbol() + " can be read as " + label + ", the dominant of " + targetChord.symbol()
                + " (" + targetLabel + "); " + joinNames(outside) + " lies outside " + key + ". "
                + (resolves ? "It resolves to " + targetChord.root() + " here, which supports this reading."
                : "It does not resolve to " + targetChord.root() + " here, so the reading is tentative.");
        return new ChordInterpretation(chord, ChordCategory.SECONDARY_DOMINANT, numeral, label, DOMINANT, resolves,
                outside, explanation);
    }

    private static FunctionEntry functionByDegree(Mode mode, int degree) {
        if (!mode.isTonal()) {
            // Church modes: the final is the tonal centre; the other chords have colour, not functional roles.
            return degree == 1
                    ? new FunctionEntry(TONIC, true, null)
                    : new FunctionEntry(null, false, "in " + mode.label() + ", chords are described by their colour; "
                    + "tonic/predominant/dominant roles belong to major and minor keys");
        }
        if (mode == Mode.HARMONIC_MINOR || mode == Mode.MELODIC_MINOR) {
            FunctionEntry minor = functionByDegree(Mode.MINOR, degree);
            return switch (degree) {
                case 5, 7 -> new FunctionEntry(DOMINANT, true, null); // the raised seventh is a real leading tone
                case 3 -> new FunctionEntry(TONIC, false, "the augmented III is rare and context-dependent");
                default -> minor;
            };
        }
        if (mode == Mode.MAJOR) {
            return switch (degree) {
                case 1 -> new FunctionEntry(TONIC, true, null);
                case 2, 4 -> new FunctionEntry(PREDOMINANT, true, null);
                case 3 -> new FunctionEntry(TONIC, false, "iii can act as a weak tonic substitute or lead toward the dominant");
                case 5, 7 -> new FunctionEntry(DOMINANT, true, null);
                default -> new FunctionEntry(TONIC, false, "vi often substitutes for the tonic but can also lead to predominant chords");
            };
        }
        return switch (degree) {
            case 1 -> new FunctionEntry(TONIC, true, null);
            case 2, 4 -> new FunctionEntry(PREDOMINANT, true, null);
            case 3 -> new FunctionEntry(TONIC, false, "III is the relative major and often acts as a secondary tonic");
            case 5 -> new FunctionEntry(DOMINANT, false, "a minor v lacks the leading tone, so its dominant pull is weak");
            case 6 -> new FunctionEntry(PREDOMINANT, false, "VI can act as a predominant or as a tonic substitute");
            default -> new FunctionEntry(DOMINANT, false, "the subtonic VII often acts as V of III or as a dominant substitute");
        };
    }

    private static String describeFunction(FunctionEntry entry) {
        if (entry.function() == null) {
            return " No conventional function: " + entry.note() + ".";
        }
        String name = entry.function().name().charAt(0) + entry.function().name().substring(1).toLowerCase();
        return " Conventional function: " + name + (entry.confident() ? "." : " (tentative: " + entry.note() + ").");
    }

    private static boolean fitsScale(Chord chord, Set<Integer> scale) {
        return scale.containsAll(chord.pitchClasses());
    }

    private static Set<Integer> harmonicMinor(Key key) {
        Set<Integer> scale = scalePitchClasses(key.tonic(), Mode.MINOR);
        int tonic = key.tonic().pitchClass().value();
        scale.remove(Math.floorMod(tonic + 10, 12));
        scale.add(Math.floorMod(tonic + 11, 12));
        return scale;
    }

    /** Pitch classes of a scale without building a {@link Key}, so theoretical parallel keys are fine. */
    static Set<Integer> scalePitchClasses(NoteName tonic, Mode mode) {
        Set<Integer> result = new TreeSet<>();
        mode.scaleIntervals().forEach(i -> result.add(Math.floorMod(tonic.pitchClass().value() + i.semitones(), 12)));
        return result;
    }

    static String joinNames(List<NoteName> names) {
        return String.join(", ", names.stream().map(NoteName::toString).toList());
    }
}
