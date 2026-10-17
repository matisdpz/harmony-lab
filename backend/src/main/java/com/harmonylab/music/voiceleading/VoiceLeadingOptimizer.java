package com.harmonylab.music.voiceleading;

import com.harmonylab.music.Chord;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Register;
import com.harmonylab.music.Voicing;
import com.harmonylab.music.VoicingGenerator;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Ranks candidate voicings of a target chord by how smoothly they follow a given voicing.
 *
 * <p>Candidates come from {@link VoicingGenerator#candidates}; each one is scored with
 * {@link VoiceLeadingEvaluator}. Ties are broken by total movement, then by closeness to the previous
 * voicing's centre, then lexicographically, so identical inputs always give identical rankings.
 */
public final class VoiceLeadingOptimizer {

    private VoiceLeadingOptimizer() {
    }

    public static List<RankedVoicing> rank(Voicing from, Chord target, Register register,
                                           boolean allowInversions, int limit) {
        if (from == null) {
            throw new InvalidMusicInputException("A starting voicing is required");
        }
        if (target == null || register == null) {
            throw new InvalidMusicInputException("A target chord and a register are required");
        }
        if (limit < 1) {
            throw new InvalidMusicInputException("The number of results must be at least 1");
        }
        List<Voicing> candidates = VoicingGenerator.candidates(target, register, allowInversions);
        if (candidates.isEmpty()) {
            throw new InvalidMusicInputException("No voicing of " + target.symbol()
                    + " fits in the register MIDI " + register.low() + "-" + register.high());
        }
        double fromCenter = from.center();
        List<VoiceLeadingResult> results = new ArrayList<>();
        for (Voicing candidate : candidates) {
            results.add(VoiceLeadingEvaluator.evaluate(from, candidate));
        }
        results.sort(Comparator.comparingDouble(VoiceLeadingResult::cost)
                .thenComparingInt(VoiceLeadingResult::totalMovement)
                .thenComparingDouble(r -> Math.abs(r.to().center() - fromCenter))
                .thenComparing(r -> r.to().notes(), VoicingGenerator::compareLexicographically));

        List<RankedVoicing> ranked = new ArrayList<>();
        for (int i = 0; i < Math.min(limit, results.size()); i++) {
            VoiceLeadingResult result = results.get(i);
            Chord chord = target.withBassPitchClass(result.to().lowest());
            ranked.add(new RankedVoicing(i + 1, chord, result.to(), result, VoiceLeadingExplainer.explain(result, chord)));
        }
        return List.copyOf(ranked);
    }

    public static RankedVoicing best(Voicing from, Chord target, Register register, boolean allowInversions) {
        return rank(from, target, register, allowInversions, 1).getFirst();
    }
}
