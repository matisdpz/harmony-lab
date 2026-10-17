package com.harmonylab.music.analysis;

import com.harmonylab.music.Chord;
import com.harmonylab.music.HarmonicFunction;
import com.harmonylab.music.NoteName;
import com.harmonylab.music.RomanNumeral;

import java.util.List;

/**
 * Analysis of one chord in a key.
 *
 * @param label              Roman numeral label, e.g. "vi", "V7/ii", "bVI"
 * @param function           conventional function, or null when it cannot be assigned
 * @param functionConfident  false when the function label is ambiguous or context-dependent
 * @param notesOutsideScale  chord tones that are not in the key's (natural) scale
 */
public record ChordInterpretation(
        Chord chord,
        ChordCategory category,
        RomanNumeral numeral,
        String label,
        HarmonicFunction function,
        boolean functionConfident,
        List<NoteName> notesOutsideScale,
        String explanation) {

    public boolean isDiatonic() {
        return category == ChordCategory.DIATONIC;
    }

    /** True for the key's tonic triad or any chord built on degree 1 with the key's third (I, Imaj7, i7...). */
    public boolean isTonic() {
        return numeral.degree() == 1 && numeral.alteration() == 0
                && (category == ChordCategory.DIATONIC) && function == HarmonicFunction.TONIC;
    }

    /** V or vii° type chord of the key (not secondary dominants). */
    public boolean isPrimaryDominant() {
        return function == HarmonicFunction.DOMINANT && category != ChordCategory.SECONDARY_DOMINANT
                && numeral.alteration() >= 0 && (numeral.degree() == 5 || numeral.degree() == 7);
    }
}
