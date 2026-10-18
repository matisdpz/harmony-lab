package com.harmonylab.music;

/** Simple voicing templates used when a chord is first placed on the keyboard. */
public enum VoicingStyle {
    /** All tones packed within one octave above the bass. */
    CLOSE,
    /** Close voicing with alternate upper tones raised an octave (wider, more transparent sound). */
    OPEN,
    /** The second-highest tone of a close voicing dropped an octave (common jazz piano/guitar voicing). */
    DROP2,
    /**
     * Keyboard-style four-part writing: the bass alone, the other voices in close position above it.
     * Triads double one tone (the bass's pitch class: the root in root position, the fifth in a 6/4 chord),
     * so they have four voices; larger chords keep one voice per tone.
     */
    FOUR_PART
}
