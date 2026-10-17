package com.harmonylab.music.voiceleading;

import com.harmonylab.music.Voicing;

import java.util.List;

/**
 * Measured properties of a transition between two voicings plus its heuristic cost.
 *
 * @param heldVoices     voices that keep exactly the same pitch
 * @param stepwiseVoices voices moving by one or two semitones
 * @param leaps          voices moving further than the leap threshold
 */
public record VoiceLeadingResult(
        Voicing from,
        Voicing to,
        List<VoiceMotion> motions,
        int totalMovement,
        int heldVoices,
        int stepwiseVoices,
        int leaps,
        int largestMove,
        int crossings,
        int overlaps,
        int parallelPerfects,
        double cost) {
}
