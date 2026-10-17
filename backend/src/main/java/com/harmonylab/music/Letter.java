package com.harmonylab.music;

/** The seven natural note letters with their pitch class in C major. */
public enum Letter {
    C(0), D(2), E(4), F(5), G(7), A(9), B(11);

    private final int naturalPitchClass;

    Letter(int naturalPitchClass) {
        this.naturalPitchClass = naturalPitchClass;
    }

    public int naturalPitchClass() {
        return naturalPitchClass;
    }

    /** Moves by a number of letter steps, wrapping around (e.g. B shifted by 1 is C). */
    public Letter shift(int steps) {
        Letter[] all = values();
        return all[Math.floorMod(ordinal() + steps, all.length)];
    }

    /** Number of letter steps upward from this letter to {@code other}, in [0, 6]. */
    public int stepsTo(Letter other) {
        return Math.floorMod(other.ordinal() - ordinal(), values().length);
    }
}
