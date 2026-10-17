package com.harmonylab.music.voiceleading;

/** Movement of one voice from a pitch in the first chord to a pitch in the second (MIDI numbers). */
public record VoiceMotion(int from, int to) {

    /** Signed movement: positive = up, negative = down. */
    public int semitones() {
        return to - from;
    }

    public int distance() {
        return Math.abs(to - from);
    }
}
