package com.harmonylab.music.analysis;

import com.harmonylab.music.Chord;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;
import com.harmonylab.music.NoteName;
import com.harmonylab.music.PitchClass;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Krumhansl–Schmuckler key finding. The progression becomes a 12-value pitch-class distribution (each chord
 * tone weighted by the chord's length in beats), which is correlated with the Krumhansl–Kessler major and
 * minor key profiles rotated to all 12 tonics. The highest Pearson correlation wins.
 *
 * <p>It is a statistical estimate, not a rule: it only knows major and natural minor, it confuses relative
 * keys easily (C major and A minor share every note), and a few chords give little evidence. The confidence
 * therefore depends on both the best correlation and its margin over the runner-up.
 */
public final class KeyDetector {

    /** Probe-tone ratings from Krumhansl and Kessler (1982), tonic first. */
    static final double[] MAJOR_PROFILE = {6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88};
    static final double[] MINOR_PROFILE = {6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17};

    public enum Confidence { STRONG, MODERATE, WEAK }

    public record Candidate(Key key, double correlation) {
    }

    public record Result(List<Candidate> candidates, Confidence confidence, String explanation) {
        public Candidate best() {
            return candidates.getFirst();
        }
    }

    private KeyDetector() {
    }

    /** @param beats length of each chord in beats (same size as {@code chords}) */
    public static Result detect(List<Chord> chords, List<Integer> beats) {
        if (chords == null || chords.isEmpty()) {
            throw new InvalidMusicInputException("Add chords before detecting the key");
        }
        double[] weights = distribution(chords, beats);
        List<Candidate> candidates = new ArrayList<>();
        for (int tonic = 0; tonic < 12; tonic++) {
            candidates.add(new Candidate(key(tonic, Mode.MAJOR), correlate(weights, MAJOR_PROFILE, tonic)));
            candidates.add(new Candidate(key(tonic, Mode.MINOR), correlate(weights, MINOR_PROFILE, tonic)));
        }
        candidates.sort(Comparator.comparingDouble(Candidate::correlation).reversed());
        List<Candidate> top = List.copyOf(candidates.subList(0, 3));
        double best = top.get(0).correlation();
        double margin = best - top.get(1).correlation();
        // Relative keys (C major / A minor) contain the same notes, so pitch content alone cannot separate them.
        boolean relatives = top.get(0).key().scale().stream().map(n -> n.pitchClass().value()).collect(java.util.stream.Collectors.toSet())
                .equals(top.get(1).key().scale().stream().map(n -> n.pitchClass().value()).collect(java.util.stream.Collectors.toSet()));
        Confidence confidence = relatives && margin < 0.15 ? Confidence.WEAK
                : best >= 0.75 && margin >= 0.08 ? Confidence.STRONG
                : best >= 0.6 && margin >= 0.03 ? Confidence.MODERATE
                : Confidence.WEAK;
        String relativeNote = relatives && margin < 0.15
                ? " " + top.get(0).key() + " and " + top.get(1).key() + " use the same notes; the first and last chords"
                + " (here " + chords.getFirst().symbol() + " … " + chords.getLast().symbol() + ") usually decide between them."
                : "";
        String explanation = "The notes, weighted by how long they sound, correlate best with " + top.get(0).key()
                + " (r = " + round(best) + "), then " + top.get(1).key() + " (r = " + round(top.get(1).correlation()) + ")."
                + relativeNote + " "
                + switch (confidence) {
                    case STRONG -> "The match is clear.";
                    case MODERATE -> "The match is plausible but not decisive.";
                    case WEAK -> "The evidence is weak or ambiguous, so treat this as a guess.";
                }
                + " Only major and natural minor keys are considered.";
        return new Result(top, confidence, explanation);
    }

    static double[] distribution(List<Chord> chords, List<Integer> beats) {
        double[] weights = new double[12];
        for (int i = 0; i < chords.size(); i++) {
            int length = beats == null || i >= beats.size() || beats.get(i) == null ? 4 : beats.get(i);
            for (int pc : chords.get(i).pitchClasses()) {
                weights[pc] += length;
            }
        }
        return weights;
    }

    /** Pearson correlation between the distribution and the profile rotated so that its first value is {@code tonic}. */
    static double correlate(double[] weights, double[] profile, int tonic) {
        double meanW = mean(weights);
        double meanP = mean(profile);
        double num = 0;
        double denW = 0;
        double denP = 0;
        for (int pc = 0; pc < 12; pc++) {
            double w = weights[pc] - meanW;
            double p = profile[Math.floorMod(pc - tonic, 12)] - meanP;
            num += w * p;
            denW += w * w;
            denP += p * p;
        }
        return denW == 0 ? 0 : num / Math.sqrt(denW * denP);
    }

    /** Spells the tonic so the key has the fewest accidentals (Db major rather than C# major). */
    private static Key key(int tonicPc, Mode mode) {
        PitchClass pc = PitchClass.of(tonicPc);
        Key best = null;
        for (NoteName spelling : List.of(pc.spelling(false), pc.spelling(true))) {
            try {
                Key candidate = new Key(spelling, mode);
                if (best == null || Math.abs(candidate.signature()) < Math.abs(best.signature())) {
                    best = candidate;
                }
            } catch (InvalidMusicInputException theoretical) {
                // e.g. D# major (9 sharps): use the other spelling
            }
        }
        return best;
    }

    private static double mean(double[] values) {
        double sum = 0;
        for (double v : values) {
            sum += v;
        }
        return sum / values.length;
    }

    private static double round(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
