package com.harmonylab.music.improvisation;

/** How a pitch class relates to the chord currently sounding, from an improviser's point of view. */
public enum NoteRole {
    /** The chord's root: the most stable target. */
    ROOT,
    /** Another chord tone: stable, always consonant with the chord. */
    CHORD_TONE,
    /** A note of the chord scale that does not clash: safe for simple improvisation. */
    SCALE,
    /** A tense but expressive note (avoid note, altered dominant tension, blue note): use it and resolve it. */
    TENSION
}
