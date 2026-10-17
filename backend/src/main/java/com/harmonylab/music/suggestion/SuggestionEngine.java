package com.harmonylab.music.suggestion;

import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordQuality;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Register;
import com.harmonylab.music.Voicing;
import com.harmonylab.music.VoicingGenerator;
import com.harmonylab.music.VoicingStyle;
import com.harmonylab.music.analysis.ChordCategory;
import com.harmonylab.music.analysis.ChordInterpretation;
import com.harmonylab.music.analysis.ChordInterpreter;
import com.harmonylab.music.analysis.ProgressionChord;
import com.harmonylab.music.voiceleading.RankedVoicing;
import com.harmonylab.music.voiceleading.VoiceLeadingEvaluator;
import com.harmonylab.music.voiceleading.VoiceLeadingOptimizer;
import com.harmonylab.music.voiceleading.VoiceLeadingResult;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Deterministic, rule-based chord suggestions.
 *
 * <p>Pipeline: (1) build a candidate pool for the key ({@link CandidatePool}); (2) measure features of each
 * candidate in context — voice-leading cost to the neighbouring voicings, tones shared with the replaced
 * chord, root motion/leading tones into the next chord, conventional function, colour; (3) combine features
 * with objective-specific weights into a 0-100 score; (4) drop candidates below {@link #MIN_SCORE} and sort by
 * score, then by symbol. Scores are heuristic ranking aids, not measurements of musical quality.
 */
public final class SuggestionEngine {

    public static final int MIN_SCORE = 35;
    /** Voice-leading cost at which smoothness reaches 0 (roughly an octave of total motion plus a leap). */
    private static final double SMOOTHNESS_SCALE = 16.0;

    private SuggestionEngine() {
    }

    public static SuggestionResult suggest(Key key, List<ProgressionChord> progression, int index,
                                           Objective objective, Register register, int limit) {
        if (limit < 1 || limit > 20) {
            throw new InvalidMusicInputException("The number of suggestions must be between 1 and 20");
        }
        List<CandidateFeatures> features = measure(key, progression, index, register);
        ChordInterpretation current = ChordInterpreter.interpret(key, progression.get(index).chord(),
                index + 1 < progression.size() ? progression.get(index + 1).chord() : null);

        List<Suggestion> suggestions = new ArrayList<>();
        for (CandidateFeatures f : features) {
            score(f, objective, current, progression, index).ifPresent(suggestions::add);
        }
        suggestions.sort(Comparator.comparingInt(Suggestion::score).reversed()
                .thenComparing(s -> s.chord().symbol()));
        suggestions = bestVariantPerChord(suggestions);
        List<Suggestion> top = List.copyOf(suggestions.subList(0, Math.min(limit, suggestions.size())));
        String message = top.isEmpty()
                ? "No candidate reaches the minimum heuristic score for \"" + objective.label()
                + "\" at this position. Try another objective or change the neighbouring chords."
                : "Ranked by a heuristic score for \"" + objective.label() + "\" (" + features.size()
                + " candidate voicings considered). Scores are ranking aids, not measurements of musical quality.";
        return new SuggestionResult(objective, top, message);
    }

    /** Keeps the highest-ranked voicing variant of each chord (input must already be sorted). */
    static List<Suggestion> bestVariantPerChord(List<Suggestion> sorted) {
        java.util.Set<String> seen = new java.util.HashSet<>();
        List<Suggestion> result = new ArrayList<>();
        for (Suggestion s : sorted) {
            if (seen.add(s.chord().root().pitchClass().value() + ":" + s.chord().quality())) {
                result.add(s);
            }
        }
        return result;
    }

    /** Measures every pool candidate for the chord at {@code index}. Package-visible for alternatives. */
    static List<CandidateFeatures> measure(Key key, List<ProgressionChord> progression, int index, Register register) {
        if (key == null || register == null) {
            throw new InvalidMusicInputException("A key and a register are required");
        }
        if (progression == null || progression.isEmpty()) {
            throw new InvalidMusicInputException("The progression is empty; add a chord before asking for suggestions");
        }
        if (index < 0 || index >= progression.size()) {
            throw new InvalidMusicInputException("Selected chord index " + index + " is outside the progression");
        }
        Chord current = progression.get(index).chord();
        Voicing currentVoicing = voicingOf(progression.get(index), register);
        ProgressionChord previous = index > 0 ? progression.get(index - 1) : null;
        ProgressionChord next = index + 1 < progression.size() ? progression.get(index + 1) : null;
        Voicing previousVoicing = previous != null ? voicingOf(previous, register) : null;
        Voicing nextVoicing = next != null ? voicingOf(next, register) : null;
        Chord chordAfterNext = index + 2 < progression.size() ? progression.get(index + 2).chord() : null;
        ChordInterpretation nextInterpretation = next != null ? ChordInterpreter.interpret(key, next.chord(), chordAfterNext) : null;
        ChordInterpretation previousInterpretation = previous != null ? ChordInterpreter.interpret(key, previous.chord(), current) : null;
        ChordInterpretation currentInterpretation = ChordInterpreter.interpret(key, current, next != null ? next.chord() : null);

        List<CandidateFeatures> result = new ArrayList<>();
        for (CandidatePool.Entry entry : CandidatePool.build(key)) {
            Chord candidate = entry.chord();
            if (candidate.hasSamePitchClasses(current)
                    || (previous != null && candidate.hasSamePitchClasses(previous.chord()))
                    || (next != null && candidate.hasSamePitchClasses(next.chord()))) {
                continue; // same notes as the replaced chord or a neighbour: not a real alternative
            }
            // Two placements per candidate: the smoothest voicing in any inversion, and the smoothest
            // root-position voicing (when different). The objective then decides which variant wins.
            Voicing anchor = previousVoicing != null ? previousVoicing : currentVoicing;
            List<RankedVoicing> placements = new ArrayList<>();
            place(candidate, anchor, register, true).ifPresent(placements::add);
            place(candidate, anchor, register, false)
                    .filter(rootPosition -> placements.isEmpty() || !rootPosition.voicing().equals(placements.getFirst().voicing()))
                    .ifPresent(placements::add);
            for (RankedVoicing placed : placements) {
                result.add(features(key, entry, placed, current, previousVoicing, nextVoicing, next, nextInterpretation,
                        previousInterpretation, currentInterpretation));
            }
        }
        return result;
    }


    private static CandidateFeatures features(Key key, CandidatePool.Entry entry, RankedVoicing placed, Chord current,
                                              Voicing previousVoicing, Voicing nextVoicing, ProgressionChord next,
                                              ChordInterpretation nextInterpretation, ChordInterpretation previousInterpretation,
                                              ChordInterpretation currentInterpretation) {
        Chord candidate = entry.chord();
        Chord voicedChord = placed.chord();
        Voicing voicing = placed.voicing();
        ChordInterpretation interpretation = ChordInterpreter.interpret(key, voicedChord, next != null ? next.chord() : null);

        Integer movementIn = null;
        Integer movementOut = null;
        double costSum = 0;
        int costCount = 0;
        if (previousVoicing != null) {
            VoiceLeadingResult in = placed.result();
            movementIn = in.totalMovement();
            costSum += in.cost();
            costCount++;
        }
        if (nextVoicing != null) {
            VoiceLeadingResult out = VoiceLeadingEvaluator.evaluate(voicing, nextVoicing);
            movementOut = out.totalMovement();
            costSum += out.cost();
            costCount++;
        }
        double smoothness = costCount == 0 ? 0.5 : clamp(1 - (costSum / costCount) / SMOOTHNESS_SCALE);

        List<String> shared = candidate.tones().stream()
                .filter(t -> current.containsPitchClass(t.pitchClass().value())).map(Object::toString).toList();
        double sharedRatio = shared.size() / (double) current.pitchClasses().size();

        List<String> resolutionReasons = new ArrayList<>();
        double resolution = resolution(key, voicedChord, interpretation, next, nextInterpretation,
                previousInterpretation, resolutionReasons);
        double functionMatch = interpretation.function() != null
                && interpretation.function() == currentInterpretation.function() ? 1 : 0;

        boolean sameRoot = candidate.root().pitchClass().equals(current.root().pitchClass());
        return new CandidateFeatures(entry, voicedChord, voicing, interpretation, key.isDiatonic(candidate),
                smoothness, sharedRatio, shared, resolution, resolutionReasons, functionMatch,
                color(candidate, key), sameRoot, movementIn, movementOut);
    }

    private static Optional<RankedVoicing> place(Chord candidate, Voicing anchor, Register register, boolean anyInversion) {
        try {
            return Optional.of(VoiceLeadingOptimizer.best(anchor, candidate, register, anyInversion));
        } catch (InvalidMusicInputException doesNotFit) {
            return Optional.empty();
        }
    }

    private static Voicing voicingOf(ProgressionChord chord, Register register) {
        return chord.voicing() != null ? chord.voicing() : VoicingGenerator.voice(chord.chord(), VoicingStyle.CLOSE, register);
    }

    /** How strongly the candidate leads into the next chord, or closes the progression when it is last. */
    private static double resolution(Key key, Chord candidate, ChordInterpretation interpretation,
                                     ProgressionChord next, ChordInterpretation nextInterpretation,
                                     ChordInterpretation previousInterpretation, List<String> reasons) {
        double score = 0;
        if (next == null) {
            if (interpretation.isTonic()) {
                score += 0.7;
                reasons.add("Closes the progression on the tonic " + key.tonicChord().symbol());
                if (previousInterpretation != null && previousInterpretation.isPrimaryDominant()) {
                    score += 0.3;
                    reasons.add("Completes an authentic cadence after " + previousInterpretation.chord().symbol());
                }
            }
            return clamp(score * closureFactor(candidate, reasons));
        }
        Chord target = next.chord();
        int targetRoot = target.root().pitchClass().value();
        int rootUp = candidate.root().pitchClass().semitonesUpTo(target.root().pitchClass());
        boolean dominantQuality = candidate.quality() == ChordQuality.MAJOR || candidate.quality() == ChordQuality.DOMINANT7;
        boolean leadingToneChord = (candidate.quality() == ChordQuality.DIMINISHED
                || candidate.quality() == ChordQuality.DIMINISHED7 || candidate.quality() == ChordQuality.HALF_DIMINISHED7)
                && rootUp == 1;
        if (rootUp == 5) {
            score += 0.4;
            reasons.add("Root falls a fifth to " + target.root() + " (the strongest conventional root motion)");
            if (dominantQuality) {
                score += 0.2;
            }
            if (candidate.quality() == ChordQuality.DOMINANT7) {
                score += 0.1;
                reasons.add("The dominant seventh adds a tritone that resolves into " + target.symbol());
            }
        }
        if (leadingToneChord) {
            score += 0.6;
            reasons.add("Built on the leading tone of " + target.root() + ", a semitone below it");
        } else if (candidate.containsPitchClass(targetRoot - 1) && !target.containsPitchClass(targetRoot - 1)) {
            score += 0.2;
            reasons.add("Contains " + candidate.spellingOf(targetRoot - 1) + ", a leading tone that rises to " + target.root());
        }
        if (nextInterpretation != null && nextInterpretation.function() == com.harmonylab.music.HarmonicFunction.DOMINANT
                && interpretation.function() == com.harmonylab.music.HarmonicFunction.PREDOMINANT) {
            score += 0.35;
            reasons.add("Predominant function before the dominant " + target.symbol());
        }
        if (score > 0 && candidate.inversion() > 0) {
            score *= 0.85; // conventionally, root-position dominants give the firmest arrival
        }
        return clamp(score);
    }

    /**
     * Conventional heuristic: a close is heard as weaker when the tonic is inverted or has no third
     * (suspended). Returns a multiplier and records the reason.
     */
    private static double closureFactor(Chord candidate, List<String> reasons) {
        if (reasons.isEmpty()) {
            return 1;
        }
        double factor = 1;
        if (candidate.inversion() > 0) {
            factor *= 0.6;
            reasons.add("Inverted (" + candidate.bass() + " in the bass), so the close sounds less final");
        }
        if (candidate.quality().family() == ChordQuality.Family.SUSPENDED) {
            factor *= 0.6;
            reasons.add("Suspended (no third), so the close sounds less settled");
        }
        return factor;
    }

    private static double color(Chord candidate, Key key) {
        double color = 0;
        if (candidate.size() > 3) {
            color += 0.4;
        }
        ChordQuality.Family family = candidate.quality().family();
        if (family == ChordQuality.Family.SUSPENDED || family == ChordQuality.Family.ADDED || family == ChordQuality.Family.SIXTH) {
            color += 0.2;
        }
        if (!key.isDiatonic(candidate)) {
            color += 0.5;
        }
        return clamp(color);
    }

    /** Applies the objective's weights; returns empty when the candidate is filtered out or scores too low. */
    static Optional<Suggestion> score(CandidateFeatures f, Objective objective, ChordInterpretation current,
                                      List<ProgressionChord> progression, int index) {
        Map<String, Integer> points = new LinkedHashMap<>();
        switch (objective) {
            case SMOOTH_VOICE_LEADING -> {
                points.put("smoothness", points(55, f.smoothness()));
                points.put("sharedTones", points(25, f.sharedRatio()));
                points.put("diatonic", f.diatonic() ? 20 : 0);
            }
            case STRONGER_RESOLUTION -> {
                if (f.resolution() <= 0) {
                    return Optional.empty();
                }
                points.put("resolution", points(55, f.resolution()));
                points.put("smoothness", points(20, f.smoothness()));
                boolean inKey = f.diatonic() || f.interpretation().category() == ChordCategory.HARMONIC_MINOR
                        || f.interpretation().category() == ChordCategory.SECONDARY_DOMINANT;
                points.put("tonalContext", inKey ? 15 : 0);
                points.put("sharedTones", points(10, f.sharedRatio()));
            }
            case DIATONIC_ALTERNATIVES -> {
                if (!f.diatonic()) {
                    return Optional.empty();
                }
                points.put("sameFunction", points(35, f.functionMatch()));
                points.put("sharedTones", points(30, f.sharedRatio()));
                points.put("smoothness", points(20, f.smoothness()));
                // A substitute on another root is a real alternative; same-root variants belong to "colour".
                points.put("differentRoot", f.sameRoot() ? 0 : 15);
            }
            case HARMONIC_COLOR -> {
                if (f.color() <= 0) {
                    return Optional.empty();
                }
                points.put("color", points(40, f.color()));
                points.put("sharedTones", points(30, f.sharedRatio()));
                points.put("smoothness", points(30, f.smoothness()));
            }
        }
        int score = points.values().stream().mapToInt(Integer::intValue).sum();
        if (score < MIN_SCORE) {
            return Optional.empty();
        }
        return Optional.of(new Suggestion(f.chord(), f.voicing(), f.interpretation().label(),
                f.interpretation().category(), f.entry().source(), score, Map.copyOf(points),
                reasons(f, objective, current, progression, index)));
    }

    private static List<String> reasons(CandidateFeatures f, Objective objective, ChordInterpretation current,
                                        List<ProgressionChord> progression, int index) {
        List<String> reasons = new ArrayList<>();
        ChordInterpretation interpretation = f.interpretation();
        String keyText = interpretation.isDiatonic()
                ? "Diatonic (" + interpretation.label() + ")"
                : switch (interpretation.category()) {
                    case HARMONIC_MINOR -> "From harmonic minor (" + interpretation.label() + ")";
                    case SECONDARY_DOMINANT -> "Secondary dominant (" + interpretation.label() + ")";
                    case BORROWED -> "Borrowed from the parallel key (" + interpretation.label() + ")";
                    default -> "Chromatic (" + interpretation.label() + ")";
                };
        reasons.add(keyText);
        if (objective == Objective.STRONGER_RESOLUTION) {
            reasons.addAll(f.resolutionReasons());
        }
        if (!f.sharedTones().isEmpty()) {
            reasons.add("Shares " + String.join(", ", f.sharedTones()) + " with " + current.chord().symbol());
        }
        if (objective == Objective.DIATONIC_ALTERNATIVES && f.functionMatch() > 0) {
            reasons.add("Same conventional function as " + current.chord().symbol() + " ("
                    + current.function().name().toLowerCase() + "), so it can act as a substitute");
        }
        if (f.movementIn() != null) {
            reasons.add("From " + progression.get(index - 1).chord().symbol() + ": " + f.movementIn() + " semitones of voice movement");
        }
        if (f.movementOut() != null) {
            reasons.add("Into " + progression.get(index + 1).chord().symbol() + ": " + f.movementOut() + " semitones of voice movement");
        }
        if (objective == Objective.HARMONIC_COLOR) {
            if (f.chord().size() > 3) {
                reasons.add("Four-note chord (" + f.chord().quality().displayName().toLowerCase() + ")");
            }
            if (!f.diatonic()) {
                reasons.add("Introduces notes from outside the key: "
                        + String.join(", ", interpretation.notesOutsideScale().stream().map(Object::toString).toList()));
            }
        }
        return List.copyOf(reasons);
    }

    private static int points(int weight, double value) {
        return (int) Math.round(weight * clamp(value));
    }

    private static double clamp(double value) {
        return Math.max(0, Math.min(1, value));
    }
}
