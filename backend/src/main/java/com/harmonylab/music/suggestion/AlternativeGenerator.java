package com.harmonylab.music.suggestion;

import com.harmonylab.music.Chord;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Register;
import com.harmonylab.music.analysis.ChordInterpretation;
import com.harmonylab.music.analysis.ChordInterpreter;
import com.harmonylab.music.analysis.ProgressionChord;
import com.harmonylab.music.voiceleading.OptimizedProgression;
import com.harmonylab.music.voiceleading.ProgressionVoicer;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Builds whole-progression alternatives:
 * <ul>
 *   <li>one "re-voiced" version keeping the chords and optimising all voicings with {@link ProgressionVoicer};</li>
 *   <li>for each objective, the single chord replacement with the highest suggestion score anywhere in the
 *   progression (ties: earliest position, then chord symbol).</li>
 * </ul>
 */
public final class AlternativeGenerator {

    private AlternativeGenerator() {
    }

    public static List<ProgressionAlternative> generate(Key key, List<ProgressionChord> progression, Register register) {
        if (progression == null || progression.isEmpty()) {
            throw new InvalidMusicInputException("The progression is empty; add chords to generate alternatives");
        }
        List<ProgressionAlternative> alternatives = new ArrayList<>();
        alternatives.add(revoiced(progression, register));

        List<List<CandidateFeatures>> featuresByPosition = new ArrayList<>();
        List<ChordInterpretation> interpretations = new ArrayList<>();
        for (int i = 0; i < progression.size(); i++) {
            featuresByPosition.add(SuggestionEngine.measure(key, progression, i, register));
            Chord next = i + 1 < progression.size() ? progression.get(i + 1).chord() : null;
            interpretations.add(ChordInterpreter.interpret(key, progression.get(i).chord(), next));
        }
        for (Objective objective : Objective.values()) {
            Suggestion best = null;
            int bestIndex = -1;
            for (int i = 0; i < progression.size(); i++) {
                for (CandidateFeatures f : featuresByPosition.get(i)) {
                    Optional<Suggestion> s = SuggestionEngine.score(f, objective, interpretations.get(i), progression, i);
                    if (s.isPresent() && (best == null || s.get().score() > best.score()
                            || (s.get().score() == best.score() && i == bestIndex
                            && s.get().chord().symbol().compareTo(best.chord().symbol()) < 0))) {
                        best = s.get();
                        bestIndex = i;
                    }
                }
            }
            if (best == null) {
                continue;
            }
            List<ProgressionChord> chords = new ArrayList<>(progression);
            Chord replaced = chords.get(bestIndex).chord();
            chords.set(bestIndex, new ProgressionChord(best.chord(), best.voicing()));
            alternatives.add(new ProgressionAlternative(objective.label(), objective,
                    "Replace chord " + (bestIndex + 1) + " (" + replaced.symbol() + ") with " + best.chord().symbol()
                            + " — heuristic score " + best.score() + ". " + String.join("; ", best.reasons()) + ".",
                    List.copyOf(chords), bestIndex));
        }
        return List.copyOf(alternatives);
    }

    private static ProgressionAlternative revoiced(List<ProgressionChord> progression, Register register) {
        List<Chord> chords = progression.stream().map(ProgressionChord::chord).toList();
        OptimizedProgression optimized = ProgressionVoicer.optimize(chords, register, true, progression.getFirst().voicing());
        List<ProgressionChord> result = new ArrayList<>();
        for (int i = 0; i < chords.size(); i++) {
            result.add(new ProgressionChord(optimized.chords().get(i), optimized.voicings().get(i)));
        }
        return new ProgressionAlternative("Smoothest voicings", null,
                "Same chords, re-voiced with a dynamic-programming search that minimises total voice-leading cost "
                        + "(" + optimized.totalMovement() + " semitones of total movement). The first voicing is kept.",
                List.copyOf(result), null);
    }
}
