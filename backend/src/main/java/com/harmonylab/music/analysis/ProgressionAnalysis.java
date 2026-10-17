package com.harmonylab.music.analysis;

import com.harmonylab.music.Key;

import java.util.List;

public record ProgressionAnalysis(
        Key key,
        List<ChordInterpretation> chords,
        List<TransitionAnalysis> transitions,
        List<Observation> observations,
        ProgressionMetrics metrics,
        String summary) {
}
