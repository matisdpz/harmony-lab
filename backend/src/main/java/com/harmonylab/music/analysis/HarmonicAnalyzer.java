package com.harmonylab.music.analysis;

import com.harmonylab.music.Chord;
import com.harmonylab.music.HarmonicFunction;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Note;
import com.harmonylab.music.voiceleading.VoiceLeadingEvaluator;
import com.harmonylab.music.voiceleading.VoiceLeadingResult;
import com.harmonylab.music.voiceleading.VoiceMotion;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Analyses a progression in a user-selected key. Every statement is derived from the chords and voicings
 * passed in; nothing is specific to any example progression.
 */
public final class HarmonicAnalyzer {

    public static final int MAX_CHORDS = 64;

    private HarmonicAnalyzer() {
    }

    public static ProgressionAnalysis analyze(Key key, List<ProgressionChord> progression) {
        if (key == null) {
            throw new InvalidMusicInputException("Select a key before analysing");
        }
        if (progression == null || progression.isEmpty()) {
            throw new InvalidMusicInputException("The progression is empty; add at least one chord to analyse it");
        }
        if (progression.size() > MAX_CHORDS) {
            throw new InvalidMusicInputException("Progressions are limited to " + MAX_CHORDS + " chords");
        }
        List<ChordInterpretation> chords = new ArrayList<>();
        for (int i = 0; i < progression.size(); i++) {
            Chord next = i + 1 < progression.size() ? progression.get(i + 1).chord() : null;
            chords.add(ChordInterpreter.interpret(key, progression.get(i).chord(), next));
        }
        List<TransitionAnalysis> transitions = new ArrayList<>();
        for (int i = 0; i + 1 < progression.size(); i++) {
            transitions.add(analyzeTransition(i, progression.get(i), progression.get(i + 1), chords.get(i), chords.get(i + 1)));
        }
        ProgressionMetrics metrics = computeMetrics(chords, transitions);
        List<Observation> observations = observe(key, chords, transitions, metrics);
        return new ProgressionAnalysis(key, List.copyOf(chords), List.copyOf(transitions), List.copyOf(observations),
                metrics, summarize(key, chords, metrics));
    }

    private static TransitionAnalysis analyzeTransition(int index, ProgressionChord a, ProgressionChord b,
                                                        ChordInterpretation ia, ChordInterpretation ib) {
        List<String> common = b.chord().tones().stream()
                .filter(t -> a.chord().containsPitchClass(t.pitchClass().value()))
                .map(Object::toString).toList();
        VoiceLeadingResult voiceLeading = a.voicing() != null && b.voicing() != null
                ? VoiceLeadingEvaluator.evaluate(a.voicing(), b.voicing()) : null;
        return new TransitionAnalysis(index, index + 1, describeRootMotion(a.chord(), b.chord()), common,
                functionalLabel(ia, ib), voiceLeading);
    }

    static String describeRootMotion(Chord a, Chord b) {
        int up = a.root().pitchClass().semitonesUpTo(b.root().pitchClass());
        return switch (up) {
            case 0 -> "same root";
            case 1 -> "ascending semitone";
            case 2 -> "ascending whole tone";
            case 3 -> "ascending minor third";
            case 4 -> "ascending major third";
            case 5 -> "descending fifth (ascending fourth)";
            case 6 -> "tritone";
            case 7 -> "ascending fifth (descending fourth)";
            case 8 -> "descending major third";
            case 9 -> "descending minor third";
            case 10 -> "descending whole tone";
            default -> "descending semitone";
        };
    }

    private static String functionalLabel(ChordInterpretation a, ChordInterpretation b) {
        if (a.category() == ChordCategory.SECONDARY_DOMINANT && a.functionConfident()) {
            return "secondary dominant " + a.label() + " resolves to its target";
        }
        if (a.isPrimaryDominant() && b.isTonic()) {
            return "dominant → tonic resolution";
        }
        if (a.isPrimaryDominant() && b.numeral().degree() == 6 && b.numeral().alteration() == 0
                && b.category() == ChordCategory.DIATONIC) {
            return "deceptive motion (dominant → " + b.label() + ")";
        }
        if (a.function() == HarmonicFunction.PREDOMINANT && b.function() == HarmonicFunction.DOMINANT) {
            return "predominant → dominant";
        }
        if (a.function() == HarmonicFunction.TONIC && b.function() == HarmonicFunction.PREDOMINANT) {
            return "tonic → predominant";
        }
        if (a.function() == HarmonicFunction.DOMINANT && b.function() == HarmonicFunction.PREDOMINANT) {
            return "dominant → predominant (a 'retrogression' in common-practice terms; frequent in popular music)";
        }
        if (a.numeral().degree() == 4 && b.isTonic()) {
            return "plagal motion (IV → I)";
        }
        return null;
    }

    private static ProgressionMetrics computeMetrics(List<ChordInterpretation> chords, List<TransitionAnalysis> transitions) {
        int diatonic = (int) chords.stream().filter(ChordInterpretation::isDiatonic).count();
        Set<String> distinct = new HashSet<>();
        chords.forEach(c -> distinct.add(c.chord().symbol()));
        int movement = 0, held = 0, stepwise = 0, motions = 0, parallels = 0, common = 0, voiced = 0;
        for (TransitionAnalysis t : transitions) {
            common += t.commonTones().size();
            VoiceLeadingResult vl = t.voiceLeading();
            if (vl != null) {
                voiced++;
                movement += vl.totalMovement();
                held += vl.heldVoices();
                stepwise += vl.stepwiseVoices();
                motions += vl.motions().size();
                parallels += vl.parallelPerfects();
            }
        }
        double average = voiced == 0 ? 0 : Math.round(movement * 10.0 / voiced) / 10.0;
        return new ProgressionMetrics(chords.size(), diatonic, distinct.size(), movement, average, held, stepwise,
                motions, parallels, common, chords.getFirst().isTonic(), chords.getLast().isTonic(), detectCadence(chords));
    }

    /** Conventional cadence name for the final two chords, or null. */
    static String detectCadence(List<ChordInterpretation> chords) {
        ChordInterpretation last = chords.getLast();
        if (chords.size() < 2) {
            return null;
        }
        ChordInterpretation penultimate = chords.get(chords.size() - 2);
        if (last.isTonic() && penultimate.isPrimaryDominant()) {
            return penultimate.numeral().degree() == 5 ? "authentic cadence (V → I)" : "leading-tone cadence (vii° → I)";
        }
        if (last.isTonic() && penultimate.numeral().degree() == 4 && penultimate.numeral().alteration() == 0) {
            return "plagal cadence (IV → I)";
        }
        if (penultimate.isPrimaryDominant() && last.category() == ChordCategory.DIATONIC
                && last.numeral().degree() == 6 && last.numeral().alteration() == 0) {
            return "deceptive cadence (V → vi)";
        }
        if (last.isPrimaryDominant() && last.numeral().degree() == 5) {
            return "half cadence (ends on V)";
        }
        return null;
    }

    private static List<Observation> observe(Key key, List<ChordInterpretation> chords,
                                             List<TransitionAnalysis> transitions, ProgressionMetrics m) {
        List<Observation> list = new ArrayList<>();
        int n = chords.size();
        list.add(Observation.fact("The progression contains " + n + " chord" + (n == 1 ? "" : "s")
                + " (" + m.distinctChords() + " distinct)."));
        list.add(Observation.fact(m.diatonicCount() == n
                ? "All " + n + " chords are diatonic to " + key + "."
                : m.diatonicCount() + " of " + n + " chords are diatonic to " + key + "."));

        for (int i = 0; i < n; i++) {
            ChordInterpretation c = chords.get(i);
            if (!c.isDiatonic()) {
                list.add(Observation.factWarning("Chord " + (i + 1) + " (" + c.chord().symbol() + ") contains notes outside "
                        + key + ": " + ChordInterpreter.joinNames(c.notesOutsideScale()) + " — read as "
                        + c.category().name().toLowerCase().replace('_', ' ') + " (" + c.label() + ")."));
            }
            if (c.category() == ChordCategory.SECONDARY_DOMINANT && !c.functionConfident()) {
                list.add(Observation.heuristic("Chord " + (i + 1) + " (" + c.chord().symbol() + ") looks like " + c.label()
                        + " but does not move to its target, so it may be heard as a chromatic colour chord."));
            }
        }

        if (m.cadence() != null) {
            list.add(Observation.fact("The progression ends with a " + m.cadence() + "."));
        }
        Chord tonic = key.tonicChord();
        list.add(Observation.fact(m.endsOnTonic()
                ? "It ends on the tonic chord (" + tonic.symbol() + ")."
                : "It does not end on the tonic chord (" + tonic.symbol() + ")."));
        if (m.cadence() != null && m.cadence().startsWith("half")) {
            list.add(Observation.heuristic("Ending on V usually sounds open (it invites a continuation), which suits "
                    + "repeating loops or the end of a section."));
        }

        for (TransitionAnalysis t : transitions) {
            ChordInterpretation a = chords.get(t.fromIndex());
            ChordInterpretation b = chords.get(t.toIndex());
            String pair = "Chords " + (t.fromIndex() + 1) + " → " + (t.toIndex() + 1)
                    + " (" + a.chord().symbol() + " → " + b.chord().symbol() + ")";
            if (a.chord().equals(b.chord())) {
                list.add(Observation.fact(pair + " repeat the same chord."));
            }
            VoiceLeadingResult vl = t.voiceLeading();
            if (vl != null && vl.stepwiseVoices() + vl.heldVoices() >= 2 && vl.stepwiseVoices() >= 1) {
                list.add(Observation.fact(pair + ": " + vl.stepwiseVoices() + " voice" + (vl.stepwiseVoices() > 1 ? "s" : "")
                        + " move by a semitone or whole tone and " + vl.heldVoices() + " hold" + (vl.heldVoices() == 1 ? "s" : "")
                        + " a common tone."));
            }
            if (t.commonTones().size() >= 2) {
                list.add(Observation.heuristic(pair + " share " + t.commonTones().size() + " tones ("
                        + String.join(", ", t.commonTones()) + "); shared tones usually make a connection sound smooth."));
            }
            if (vl != null && vl.parallelPerfects() > 0) {
                list.add(Observation.heuristicWarning(pair + " contain parallel fifths or octaves in the current voicing. "
                        + "Classical part-writing avoids them; many popular styles use them freely."));
            }
        }

        if (m.totalMotions() > 0) {
            list.add(Observation.fact("Across all voiced transitions, voices move " + m.totalVoiceMovement()
                    + " semitones in total (" + m.averageMovementPerTransition() + " per transition); "
                    + m.stepwiseMotions() + " of " + m.totalMotions() + " voice motions are steps and "
                    + m.heldVoices() + " are held notes."));
            largestLeap(transitions).ifPresent(list::add);
        }
        return list;
    }

    private static java.util.Optional<Observation> largestLeap(List<TransitionAnalysis> transitions) {
        VoiceMotion largest = null;
        int at = -1;
        for (TransitionAnalysis t : transitions) {
            if (t.voiceLeading() == null) {
                continue;
            }
            for (VoiceMotion motion : t.voiceLeading().motions()) {
                if (largest == null || motion.distance() > largest.distance()) {
                    largest = motion;
                    at = t.fromIndex();
                }
            }
        }
        if (largest == null || largest.distance() <= 5) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(Observation.fact("The largest single-voice leap is " + largest.distance()
                + " semitones (" + Note.fromMidi(largest.from()) + " → " + Note.fromMidi(largest.to())
                + ") between chords " + (at + 1) + " and " + (at + 2) + "."));
    }

    private static String summarize(Key key, List<ChordInterpretation> chords, ProgressionMetrics m) {
        String symbols = chords.stream().map(c -> c.chord().symbol()).collect(Collectors.joining(" – "));
        String numerals = chords.stream().map(ChordInterpretation::label).collect(Collectors.joining(" – "));
        StringBuilder text = new StringBuilder("In " + key + ", " + symbols + " reads as " + numerals + ". ");
        text.append(m.diatonicCount() == m.chordCount() ? "Every chord is diatonic. "
                : m.diatonicCount() + " of " + m.chordCount() + " chords are diatonic. ");
        if (m.cadence() != null) {
            text.append("It closes with a ").append(m.cadence()).append('.');
        } else {
            text.append(m.endsOnTonic() ? "It ends on the tonic." : "It does not end on the tonic.");
        }
        return text.toString();
    }
}
