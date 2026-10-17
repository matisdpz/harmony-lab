package com.harmonylab.music.suggestion;

import com.harmonylab.music.Chord;
import com.harmonylab.music.Voicing;
import com.harmonylab.music.analysis.ChordCategory;

import java.util.List;
import java.util.Map;

/**
 * A ranked alternative for the selected chord.
 *
 * @param score     heuristic score 0-100 for the chosen objective (a ranking aid, not a quality measure)
 * @param breakdown points contributed by each feature, summing to {@code score}
 */
public record Suggestion(
        Chord chord,
        Voicing voicing,
        String romanLabel,
        ChordCategory category,
        CandidateSource source,
        int score,
        Map<String, Integer> breakdown,
        List<String> reasons) {
}
