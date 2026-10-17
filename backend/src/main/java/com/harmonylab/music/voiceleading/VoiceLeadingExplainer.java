package com.harmonylab.music.voiceleading;

import com.harmonylab.music.Chord;
import com.harmonylab.music.Note;
import com.harmonylab.music.NoteName;

import java.util.ArrayList;
import java.util.List;

/** Turns measured voice-leading metrics into short, factual explanations. */
public final class VoiceLeadingExplainer {

    private VoiceLeadingExplainer() {
    }

    public static List<String> explain(VoiceLeadingResult result, Chord target) {
        List<String> reasons = new ArrayList<>();
        reasons.add("Total movement: " + result.totalMovement() + " semitone" + (result.totalMovement() == 1 ? "" : "s")
                + " across " + result.motions().size() + " voices");
        if (result.heldVoices() > 0) {
            List<String> held = result.motions().stream().filter(m -> m.distance() == 0)
                    .map(m -> spell(m.to(), target)).toList();
            reasons.add("Holds " + String.join(", ", held) + " as a common tone" + (held.size() > 1 ? "s" : ""));
        }
        if (result.stepwiseVoices() > 0) {
            reasons.add(result.stepwiseVoices() + " voice" + (result.stepwiseVoices() > 1 ? "s move" : " moves")
                    + " by a semitone or whole tone");
        }
        if (result.leaps() > 0) {
            reasons.add(result.leaps() + " voice" + (result.leaps() > 1 ? "s leap" : " leaps")
                    + " (largest " + result.largestMove() + " semitones)");
        } else {
            reasons.add("No voice moves more than a perfect fourth");
        }
        if (result.parallelPerfects() > 0) {
            reasons.add("Contains " + result.parallelPerfects() + " parallel fifth/octave motion"
                    + (result.parallelPerfects() > 1 ? "s" : "") + " (penalised as a classical-style heuristic)");
        }
        if (result.overlaps() > 0) {
            reasons.add(result.overlaps() + " voice overlap" + (result.overlaps() > 1 ? "s" : "") + " (penalised)");
        }
        if (result.crossings() > 0) {
            reasons.add(result.crossings() + " voice crossing" + (result.crossings() > 1 ? "s" : "") + " (penalised)");
        }
        if (result.from().size() != result.to().size()) {
            reasons.add("Voice count changes from " + result.from().size() + " to " + result.to().size()
                    + ", so one voice splits or merges");
        }
        if (target != null && target.inversion() > 0) {
            reasons.add("Uses " + inversionName(target.inversion()) + " (" + target.bass() + " in the bass)");
        }
        return List.copyOf(reasons);
    }

    /** Note name with octave, using the chord's own spelling when the pitch belongs to it (G#4, not Ab4). */
    public static String spell(int midi, Chord chord) {
        NoteName spelling = chord == null ? null : chord.spellingOf(midi);
        return (spelling != null ? Note.fromMidi(midi, spelling) : Note.fromMidi(midi)).toString();
    }

    public static String inversionName(int inversion) {
        return switch (inversion) {
            case 0 -> "root position";
            case 1 -> "first inversion";
            case 2 -> "second inversion";
            default -> "third inversion";
        };
    }
}
