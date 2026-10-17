package com.harmonylab.music.analysis;

import com.harmonylab.music.voiceleading.VoiceLeadingResult;

import java.util.List;

/**
 * Relationship between two adjacent chords.
 *
 * @param rootMotion      description such as "descending fifth"
 * @param commonTones     shared pitch classes, spelled as in the second chord
 * @param functionalLabel conventional label such as "dominant → tonic", or null
 * @param voiceLeading    metrics of the actual voicings, or null if either chord is unvoiced
 */
public record TransitionAnalysis(
        int fromIndex,
        int toIndex,
        String rootMotion,
        List<String> commonTones,
        String functionalLabel,
        VoiceLeadingResult voiceLeading) {
}
