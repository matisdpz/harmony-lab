package com.harmonylab.music.analysis;

import com.harmonylab.music.Chord;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Voicing;

/** A chord in a progression together with its concrete voicing (null when not voiced yet). */
public record ProgressionChord(Chord chord, Voicing voicing) {

    public ProgressionChord {
        if (chord == null) {
            throw new InvalidMusicInputException("Progression entries need a chord");
        }
        if (voicing != null) {
            String mismatch = voicing.mismatchWith(chord);
            if (mismatch != null) {
                throw new InvalidMusicInputException(mismatch);
            }
        }
    }
}
