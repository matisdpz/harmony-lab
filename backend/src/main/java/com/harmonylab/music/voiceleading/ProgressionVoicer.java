package com.harmonylab.music.voiceleading;

import com.harmonylab.music.Chord;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Register;
import com.harmonylab.music.Voicing;
import com.harmonylab.music.VoicingGenerator;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Chooses voicings for a whole progression with dynamic programming (Viterbi over voicing candidates).
 *
 * <p>Greedy chord-by-chord choices can paint later chords into a corner; the DP instead minimises the
 * <em>sum</em> of transition costs over the entire progression. With n chords and at most k candidates per
 * chord it runs in O(n·k²) evaluations, which is small for realistic progressions (k is usually &lt; 300).
 */
public final class ProgressionVoicer {

    /** Weight of the distance between the first voicing's centre and the register centre. */
    private static final double START_CENTER_WEIGHT = 0.25;
    /** Weight of the first voicing's span, so a free start prefers compact voicings over wide spreads. */
    private static final double START_SPAN_WEIGHT = 0.5;

    private ProgressionVoicer() {
    }

    /**
     * @param fixedFirst if non-null, the first chord keeps this voicing (so the progression starts where the user put it)
     */
    public static OptimizedProgression optimize(List<Chord> chords, Register register, boolean allowInversions,
                                                Voicing fixedFirst) {
        return optimize(chords, register, allowInversions, fixedFirst, false);
    }

    /** @param fourVoices double the root of triads (four-part writing), see {@link VoicingGenerator#candidates} */
    public static OptimizedProgression optimize(List<Chord> chords, Register register, boolean allowInversions,
                                                Voicing fixedFirst, boolean fourVoices) {
        if (chords == null || chords.isEmpty()) {
            throw new InvalidMusicInputException("The progression is empty; add at least one chord");
        }
        List<List<Voicing>> candidates = new ArrayList<>();
        for (int i = 0; i < chords.size(); i++) {
            List<Voicing> options = i == 0 && fixedFirst != null
                    ? List.of(fixedFirst)
                    : VoicingGenerator.candidates(chords.get(i), register, allowInversions, fourVoices);
            if (options.isEmpty()) {
                throw new InvalidMusicInputException("No voicing of " + chords.get(i).symbol()
                        + " (chord " + (i + 1) + ") fits in the selected register");
            }
            candidates.add(options);
        }

        int n = chords.size();
        double[][] cost = new double[n][];
        int[][] previous = new int[n][];
        cost[0] = new double[candidates.get(0).size()];
        previous[0] = new int[candidates.get(0).size()];
        for (int c = 0; c < candidates.get(0).size(); c++) {
            Voicing start = candidates.get(0).get(c);
            cost[0][c] = START_CENTER_WEIGHT * Math.abs(start.center() - register.center()) + START_SPAN_WEIGHT * start.span();
        }
        for (int i = 1; i < n; i++) {
            List<Voicing> current = candidates.get(i);
            List<Voicing> before = candidates.get(i - 1);
            cost[i] = new double[current.size()];
            previous[i] = new int[current.size()];
            for (int c = 0; c < current.size(); c++) {
                double best = Double.MAX_VALUE;
                int bestPrevious = 0;
                for (int p = 0; p < before.size(); p++) {
                    double total = cost[i - 1][p] + VoiceLeadingEvaluator.evaluate(before.get(p), current.get(c)).cost();
                    if (total < best) { // strict: earliest (lexicographically smallest) candidate wins ties
                        best = total;
                        bestPrevious = p;
                    }
                }
                cost[i][c] = best;
                previous[i][c] = bestPrevious;
            }
        }

        int last = 0;
        for (int c = 1; c < cost[n - 1].length; c++) {
            if (cost[n - 1][c] < cost[n - 1][last]) {
                last = c;
            }
        }
        List<Voicing> voicings = new ArrayList<>();
        int index = last;
        for (int i = n - 1; i >= 0; i--) {
            voicings.add(candidates.get(i).get(index));
            index = previous[i][index];
        }
        Collections.reverse(voicings);

        List<Chord> voicedChords = new ArrayList<>();
        int movement = 0;
        double transitionCost = 0;
        for (int i = 0; i < n; i++) {
            voicedChords.add(chords.get(i).withBassPitchClass(voicings.get(i).lowest()));
            if (i > 0) {
                VoiceLeadingResult result = VoiceLeadingEvaluator.evaluate(voicings.get(i - 1), voicings.get(i));
                movement += result.totalMovement();
                transitionCost += result.cost();
            }
        }
        return new OptimizedProgression(List.copyOf(voicedChords), List.copyOf(voicings), transitionCost, movement);
    }
}
