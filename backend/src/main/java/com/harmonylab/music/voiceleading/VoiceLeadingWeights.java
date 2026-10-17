package com.harmonylab.music.voiceleading;

/**
 * Weights of the voice-leading cost function. The cost of moving from voicing A to voicing B is:
 *
 * <pre>
 * cost = movement        * Σ |semitones moved by each voice|
 *      + leapExcess      * Σ max(0, |move| - leapThreshold)     (large leaps cost extra)
 *      + crossing        * number of voice crossings
 *      + overlap         * number of voice overlaps
 *      + parallelPerfect * number of parallel fifths/octaves
 *      + voiceCountChange* |size(A) - size(B)|
 * </pre>
 *
 * The values are hand-tuned heuristics, not derived from data. They express common-practice preferences
 * (small motion, independent voices) and should not be read as a measure of musical quality.
 */
public record VoiceLeadingWeights(
        double movement,
        int leapThreshold,
        double leapExcess,
        double crossing,
        double overlap,
        double parallelPerfect,
        double voiceCountChange) {

    /** A leap is any movement larger than a perfect fourth (5 semitones). */
    public static final VoiceLeadingWeights DEFAULT = new VoiceLeadingWeights(1.0, 5, 1.0, 4.0, 3.0, 2.0, 1.0);
}
