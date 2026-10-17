package com.harmonylab.music.suggestion;

import com.harmonylab.music.Chord;
import com.harmonylab.music.Voicing;
import com.harmonylab.music.analysis.ChordInterpretation;

import java.util.List;

/**
 * Measured properties of one candidate in context. Scores are in [0, 1].
 *
 * @param smoothness    1 - (average voice-leading cost to/from neighbours) / 16, clamped; 0.5 if there are no neighbours
 * @param sharedRatio   shared pitch classes with the replaced chord / size of the replaced chord
 * @param resolution    strength of the connection into the next chord (or of closing on the tonic)
 * @param functionMatch 1 when the conventional function equals that of the replaced chord
 * @param color         extensions, suspensions and chromatic content
 * @param sameRoot      true when the candidate has the same root as the replaced chord (a variant, not a substitute)
 * @param movementIn    semitones moved from the previous chord's voicing, or null
 * @param movementOut   semitones moved into the next chord's voicing, or null
 */
record CandidateFeatures(
        CandidatePool.Entry entry,
        Chord chord,
        Voicing voicing,
        ChordInterpretation interpretation,
        boolean diatonic,
        double smoothness,
        double sharedRatio,
        List<String> sharedTones,
        double resolution,
        List<String> resolutionReasons,
        double functionMatch,
        double color,
        boolean sameRoot,
        Integer movementIn,
        Integer movementOut) {
}
