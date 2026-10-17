package com.harmonylab.music;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A spelled note without octave, e.g. C#, Db, F##. Spelling matters for music theory
 * (C# and Db share a pitch class but belong to different keys), so chords and scales are
 * built letter-by-letter and only collapse to {@link PitchClass} for sound and comparison.
 *
 * @param letter     natural letter
 * @param accidental -2 (double flat) .. +2 (double sharp)
 */
public record NoteName(Letter letter, int accidental) {

    private static final Pattern NOTE_PATTERN = Pattern.compile("^([A-Ga-g])(##|bb|x|#|b|♯|♭)?$");

    public NoteName {
        if (letter == null) {
            throw new IllegalArgumentException("letter must not be null");
        }
        if (accidental < -2 || accidental > 2) {
            throw new InvalidMusicInputException(
                    "Unsupported accidental on " + letter + ": only up to double sharps/flats are supported");
        }
    }

    /** Parses names such as {@code C}, {@code f#}, {@code Bb}, {@code Ebb}, {@code Fx}. */
    public static NoteName parse(String text) {
        if (text == null || text.isBlank()) {
            throw new InvalidMusicInputException("Note name is empty");
        }
        Matcher matcher = NOTE_PATTERN.matcher(text.trim());
        if (!matcher.matches()) {
            throw new InvalidMusicInputException(
                    "Invalid note name '" + text + "'. Use a letter A-G with an optional #, b, ## or bb (e.g. C#, Bb).");
        }
        Letter letter = Letter.valueOf(matcher.group(1).toUpperCase());
        String acc = matcher.group(2);
        int accidental = acc == null ? 0 : switch (acc) {
            case "#", "♯" -> 1;
            case "##", "x" -> 2;
            case "b", "♭" -> -1;
            case "bb" -> -2;
            default -> throw new IllegalStateException("Unexpected accidental " + acc);
        };
        return new NoteName(letter, accidental);
    }

    public PitchClass pitchClass() {
        return PitchClass.of(letter.naturalPitchClass() + accidental);
    }

    /**
     * Transposes upward by an interval, keeping correct letter spelling
     * (e.g. Db + major third = F, C# + major third = E#).
     */
    public NoteName transpose(Interval interval) {
        Letter targetLetter = letter.shift(interval.degree() - 1);
        int targetPitchClass = pitchClass().value() + interval.semitones();
        int newAccidental = signedDistance(targetLetter.naturalPitchClass(), targetPitchClass);
        if (newAccidental < -2 || newAccidental > 2) {
            // Spelling would need a triple accidental; fall back to the simplest enharmonic spelling.
            return PitchClass.of(targetPitchClass).defaultSpelling();
        }
        return new NoteName(targetLetter, newAccidental);
    }

    /** Transposes by semitones and spells the result without key context. */
    public NoteName transposeSemitones(int semitones, boolean preferFlats) {
        return pitchClass().transpose(semitones).spelling(preferFlats);
    }

    public boolean isEnharmonicWith(NoteName other) {
        return pitchClass().equals(other.pitchClass());
    }

    /** Distance from {@code from} to {@code to} as a value in [-6, 5]. */
    private static int signedDistance(int from, int to) {
        int diff = Math.floorMod(to - from, 12);
        return diff > 5 ? diff - 12 : diff;
    }

    @Override
    public String toString() {
        String suffix = switch (accidental) {
            case -2 -> "bb";
            case -1 -> "b";
            case 1 -> "#";
            case 2 -> "##";
            default -> "";
        };
        return letter.name() + suffix;
    }
}
