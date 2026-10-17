package com.harmonylab.music;

/**
 * A pitch class in 12-tone equal temperament: 0 = C, 1 = C#/Db, ..., 11 = B.
 * Pitch classes ignore octave and spelling; use {@link NoteName} when spelling matters.
 */
public record PitchClass(int value) {

    private static final String[] SHARP_NAMES = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
    private static final String[] FLAT_NAMES = {"C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"};
    /** Default spelling used when no key context is available. */
    private static final String[] DEFAULT_NAMES = {"C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"};

    public PitchClass {
        if (value < 0 || value > 11) {
            throw new IllegalArgumentException("Pitch class must be in [0, 11], got " + value);
        }
    }

    public static PitchClass of(int anyInteger) {
        return new PitchClass(Math.floorMod(anyInteger, 12));
    }

    public static PitchClass ofMidi(int midi) {
        return of(midi);
    }

    public PitchClass transpose(int semitones) {
        return of(value + semitones);
    }

    /** Smallest upward distance in semitones from this pitch class to {@code other}, in [0, 11]. */
    public int semitonesUpTo(PitchClass other) {
        return Math.floorMod(other.value - value, 12);
    }

    /** A spelling of this pitch class without key context. */
    public NoteName defaultSpelling() {
        return NoteName.parse(DEFAULT_NAMES[value]);
    }

    public NoteName spelling(boolean preferFlats) {
        return NoteName.parse(preferFlats ? FLAT_NAMES[value] : SHARP_NAMES[value]);
    }
}
