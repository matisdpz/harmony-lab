package com.harmonylab.music.analysis;

/** Aggregate, directly computed numbers describing a progression (used for comparing versions). */
public record ProgressionMetrics(
        int chordCount,
        int diatonicCount,
        int distinctChords,
        int totalVoiceMovement,
        double averageMovementPerTransition,
        int heldVoices,
        int stepwiseMotions,
        int totalMotions,
        int parallelPerfects,
        int commonToneTotal,
        boolean startsOnTonic,
        boolean endsOnTonic,
        String cadence) {
}
