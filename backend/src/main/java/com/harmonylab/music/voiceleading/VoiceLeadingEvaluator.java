package com.harmonylab.music.voiceleading;

import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Voicing;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Pairs the voices of two voicings and computes the movement metrics and cost.
 *
 * <p><b>Voice pairing.</b> Voices are matched in pitch order (lowest to lowest, ...). For equal sizes this
 * order-preserving matching minimises total absolute movement (a classic result for matching points on a
 * line), and it can never introduce a crossing. When the sizes differ, a dynamic program finds the cheapest
 * order-preserving matching in which every note of the larger voicing is paired with exactly one note of the
 * smaller one, i.e. a voice "splits" into two (or two voices merge into one).
 */
public final class VoiceLeadingEvaluator {

    private VoiceLeadingEvaluator() {
    }

    public static VoiceLeadingResult evaluate(Voicing from, Voicing to) {
        return evaluate(from, to, VoiceLeadingWeights.DEFAULT);
    }

    public static VoiceLeadingResult evaluate(Voicing from, Voicing to, VoiceLeadingWeights weights) {
        requireVoicings(from, to);
        return evaluateMotions(from, to, pair(from.notes(), to.notes()), weights);
    }

    /**
     * Evaluates an explicit voice assignment (useful to compare a crossing assignment with the default one).
     * Every note of both voicings must appear in at least one motion.
     */
    public static VoiceLeadingResult evaluateMotions(Voicing from, Voicing to, List<VoiceMotion> motions,
                                                     VoiceLeadingWeights weights) {
        requireVoicings(from, to);
        if (motions == null || motions.isEmpty()) {
            throw new InvalidMusicInputException("A voice assignment needs at least one motion");
        }
        int total = 0;
        int held = 0;
        int stepwise = 0;
        int leaps = 0;
        int largest = 0;
        double leapExcess = 0;
        for (VoiceMotion motion : motions) {
            int d = motion.distance();
            total += d;
            largest = Math.max(largest, d);
            if (d == 0) {
                held++;
            } else if (d <= 2) {
                stepwise++;
            }
            if (d > weights.leapThreshold()) {
                leaps++;
                leapExcess += d - weights.leapThreshold();
            }
        }
        int crossings = countCrossings(motions);
        int overlaps = countOverlaps(from, motions);
        int parallels = countParallelPerfects(motions);
        double cost = weights.movement() * total
                + weights.leapExcess() * leapExcess
                + weights.crossing() * crossings
                + weights.overlap() * overlaps
                + weights.parallelPerfect() * parallels
                + weights.voiceCountChange() * Math.abs(from.size() - to.size());
        return new VoiceLeadingResult(from, to, List.copyOf(motions), total, held, stepwise, leaps, largest,
                crossings, overlaps, parallels, cost);
    }

    /** Order-preserving minimum-movement matching (see class comment). */
    static List<VoiceMotion> pair(List<Integer> from, List<Integer> to) {
        if (from.size() == to.size()) {
            List<VoiceMotion> motions = new ArrayList<>();
            for (int i = 0; i < from.size(); i++) {
                motions.add(new VoiceMotion(from.get(i), to.get(i)));
            }
            return motions;
        }
        boolean fromIsShorter = from.size() < to.size();
        List<Integer> shorter = fromIsShorter ? from : to;
        List<Integer> longer = fromIsShorter ? to : from;
        int s = shorter.size();
        int l = longer.size();

        // dp[i][j] = min cost when longer[0..j] is matched to shorter[0..i] and longer[j] is matched to shorter[i]
        long[][] dp = new long[s][l];
        for (long[] row : dp) {
            java.util.Arrays.fill(row, Long.MAX_VALUE / 4);
        }
        dp[0][0] = Math.abs(shorter.get(0) - longer.get(0));
        for (int j = 1; j < l; j++) {
            for (int i = 0; i < s; i++) {
                long sameShort = dp[i][j - 1];
                long previousShort = i > 0 ? dp[i - 1][j - 1] : Long.MAX_VALUE / 4;
                dp[i][j] = Math.abs(shorter.get(i) - longer.get(j)) + Math.min(sameShort, previousShort);
            }
        }
        // Backtrack; on ties prefer advancing in both lists (diagonal) for determinism.
        List<VoiceMotion> motions = new ArrayList<>();
        int i = s - 1;
        for (int j = l - 1; j >= 0; j--) {
            int a = shorter.get(i);
            int b = longer.get(j);
            motions.add(fromIsShorter ? new VoiceMotion(a, b) : new VoiceMotion(b, a));
            if (j > 0 && i > 0 && dp[i - 1][j - 1] <= dp[i][j - 1]) {
                i--;
            }
        }
        Collections.reverse(motions);
        return motions;
    }

    /** Two voices cross when their order in the second chord is the reverse of their order in the first. */
    private static int countCrossings(List<VoiceMotion> motions) {
        int count = 0;
        for (int a = 0; a < motions.size(); a++) {
            for (int b = a + 1; b < motions.size(); b++) {
                VoiceMotion x = motions.get(a);
                VoiceMotion y = motions.get(b);
                long before = Long.signum(x.from() - y.from());
                long after = Long.signum(x.to() - y.to());
                if (before != 0 && after != 0 && before != after) {
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * An overlap happens when a voice moves beyond the previous pitch of its neighbouring voice
     * (e.g. the lower voice moves above where the upper voice just was).
     */
    private static int countOverlaps(Voicing from, List<VoiceMotion> motions) {
        List<Integer> pitches = from.notes();
        int count = 0;
        for (VoiceMotion motion : motions) {
            int index = pitches.indexOf(motion.from());
            if (index < pitches.size() - 1 && motion.to() > pitches.get(index + 1)) {
                count++;
            }
            if (index > 0 && motion.to() < pitches.get(index - 1)) {
                count++;
            }
        }
        return count;
    }

    /** Pairs of voices forming a perfect fifth or octave (compound included) before and after, moving in the same direction. */
    private static int countParallelPerfects(List<VoiceMotion> motions) {
        int count = 0;
        for (int a = 0; a < motions.size(); a++) {
            for (int b = a + 1; b < motions.size(); b++) {
                VoiceMotion x = motions.get(a);
                VoiceMotion y = motions.get(b);
                if (x.from() == y.from() || x.to() == y.to()) {
                    continue; // split/merged voice, not two independent voices
                }
                if (x.semitones() == 0 || Integer.signum(x.semitones()) != Integer.signum(y.semitones())) {
                    continue;
                }
                int before = Math.abs(x.from() - y.from()) % 12;
                int after = Math.abs(x.to() - y.to()) % 12;
                if (before == after && (before == 0 || before == 7)) {
                    count++;
                }
            }
        }
        return count;
    }

    private static void requireVoicings(Voicing from, Voicing to) {
        if (from == null || to == null) {
            throw new InvalidMusicInputException("Both voicings are required to evaluate voice leading");
        }
    }
}
