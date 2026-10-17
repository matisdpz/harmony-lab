package com.harmonylab.music;

/**
 * An inclusive MIDI range in which voicings must lie. Limited to the 88-key piano (A0 = 21 to C8 = 108)
 * and at least one octave wide so that every chord tone can be placed.
 */
public record Register(int low, int high) {

    public static final int PIANO_LOW = 21;
    public static final int PIANO_HIGH = 108;
    /** Default: A2 (45) to G5 (79), a comfortable two-hand chord register. */
    public static final Register DEFAULT = new Register(45, 79);

    public Register {
        if (low < PIANO_LOW || high > PIANO_HIGH) {
            throw new InvalidMusicInputException("Register must lie within the piano range (MIDI 21-108)");
        }
        if (high - low < 12) {
            throw new InvalidMusicInputException("Register must span at least one octave (low=" + low + ", high=" + high + ")");
        }
    }

    public boolean contains(int midi) {
        return midi >= low && midi <= high;
    }

    public boolean contains(Voicing voicing) {
        return contains(voicing.lowest()) && contains(voicing.highest());
    }

    public double center() {
        return (low + high) / 2.0;
    }
}
