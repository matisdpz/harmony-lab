package com.harmonylab.music;

/** Simple voicing templates used when a chord is first placed on the keyboard. */
public enum VoicingStyle {
    /** All tones packed within one octave above the bass. */
    CLOSE,
    /** Close voicing with alternate upper tones raised an octave (wider, more transparent sound). */
    OPEN,
    /** The second-highest tone of a close voicing dropped an octave (common jazz piano/guitar voicing). */
    DROP2
}
