package com.harmonylab.music.analysis;

/** How a chord relates to the selected key. */
public enum ChordCategory {
    /** Every note belongs to the key's scale. */
    DIATONIC,
    /** Minor keys only: fits the harmonic minor scale (raised 7th), e.g. V or vii°7 in minor. */
    HARMONIC_MINOR,
    /** A major or dominant-seventh chord a fifth above a diatonic chord (e.g. V7/ii). */
    SECONDARY_DOMINANT,
    /** Fits the parallel key's scale (modal mixture), e.g. iv or bVI in a major key. */
    BORROWED,
    /** None of the above interpretations applies. */
    CHROMATIC
}
