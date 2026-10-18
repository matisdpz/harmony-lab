package com.harmonylab.music.improvisation;

import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordQuality;
import com.harmonylab.music.HarmonicFunction;
import com.harmonylab.music.Interval;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;
import com.harmonylab.music.NoteName;
import com.harmonylab.music.analysis.ChordInterpreter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Note choices for improvising over one chord in a key. Deterministic rules (conventional jazz/pop pedagogy):
 * <ol>
 *   <li><b>Chord scale</b> = the key's scale where each chord tone replaces the scale note with the same letter
 *   (E7 in A minor turns G into G#; C7 in C major turns B into Bb).</li>
 *   <li>Chord tones are {@link NoteRole#ROOT} / {@link NoteRole#CHORD_TONE}.</li>
 *   <li>A chord-scale note one semitone above a chord tone is an "avoid note" (e.g. F over Cmaj7): it clashes
 *   as a held note but is expressive in passing, so it is a {@link NoteRole#TENSION}. Other chord-scale notes
 *   are {@link NoteRole#SCALE}.</li>
 *   <li>Over dominant chords, the altered tensions b9, #9 and b13 are added as tensions when outside the scale.</li>
 *   <li>Blue notes of the key (b3 and b5 in major, b5 in minor) are tensions when not already used.</li>
 * </ol>
 * These are stylistic conventions, not acoustic facts; the reasons say so.
 */
public final class ImprovisationGuide {

    private ImprovisationGuide() {
    }

    public static List<GuideNote> forChord(Key key, Chord chord) {
        if (key == null || chord == null) {
            throw new InvalidMusicInputException("A key and a chord are required");
        }
        Map<Integer, GuideNote> notes = new LinkedHashMap<>();
        List<NoteName> tones = chord.tones();
        for (int i = 0; i < tones.size(); i++) {
            NoteName tone = tones.get(i);
            Interval interval = chord.intervals().get(i);
            int pc = tone.pitchClass().value();
            notes.putIfAbsent(pc, i == 0
                    ? new GuideNote(pc, tone, NoteRole.ROOT, "Root of " + chord.symbol() + ": the most stable target")
                    : new GuideNote(pc, tone, NoteRole.CHORD_TONE, "Chord tone (" + interval.fullName() + "): always consonant"));
        }

        for (NoteName scaleNote : chordScale(key, chord)) {
            int pc = scaleNote.pitchClass().value();
            if (notes.containsKey(pc)) {
                continue;
            }
            NoteName below = chord.spellingOf(pc - 1);
            if (below != null) {
                notes.put(pc, new GuideNote(pc, scaleNote, NoteRole.TENSION,
                        "Avoid note: a semitone above " + below + ". Tense if held; resolve it down to " + below));
            } else {
                notes.put(pc, new GuideNote(pc, scaleNote, NoteRole.SCALE, "In the chord scale: safe"));
            }
        }

        if (isDominant(key, chord)) {
            NoteName root = chord.root();
            addTension(key, notes, root.transpose(Interval.MINOR_SECOND), "b9 over the dominant " + chord.symbol() + ": strong pull toward the next chord");
            addTension(key, notes, root.transpose(new Interval(2, 3)), "#9 over the dominant " + chord.symbol() + ": bluesy, crunchy colour");
            addTension(key, notes, root.transpose(Interval.MINOR_SIXTH), "b13 over the dominant " + chord.symbol() + ": dark colour, resolves down");
        }

        NoteName tonic = key.tonic();
        if (!key.mode().hasMinorThird()) {
            addTension(key, notes, tonic.transpose(Interval.MINOR_THIRD), "Blue note (b3 of " + key + "): slide it up to the major third");
        }
        addTension(key, notes, tonic.transpose(Interval.DIMINISHED_FIFTH), "Blue note (b5 of " + key + "): use as a passing note");

        List<GuideNote> result = new ArrayList<>(notes.values());
        result.sort(Comparator.comparingInt((GuideNote n) -> n.role().ordinal())
                .thenComparingInt(n -> Math.floorMod(n.pitchClass() - chord.root().pitchClass().value(), 12)));
        return List.copyOf(result);
    }

    /** The key's scale with chord tones substituted for scale notes of the same letter. */
    static List<NoteName> chordScale(Key key, Chord chord) {
        List<NoteName> scale = new ArrayList<>(key.scale());
        for (NoteName tone : chord.tones()) {
            for (int i = 0; i < scale.size(); i++) {
                if (scale.get(i).letter() == tone.letter()) {
                    scale.set(i, tone);
                }
            }
        }
        return scale;
    }

    private static boolean isDominant(Key key, Chord chord) {
        if (chord.quality().isDominantType()) {
            return true;
        }
        return chord.quality() == ChordQuality.MAJOR
                && ChordInterpreter.interpret(key, chord, null).function() == HarmonicFunction.DOMINANT;
    }

    private static void addTension(Key key, Map<Integer, GuideNote> notes, NoteName name, String reason) {
        int pc = name.pitchClass().value();
        if (!notes.containsKey(pc)) {
            notes.put(pc, new GuideNote(pc, readable(key, name), NoteRole.TENSION, reason));
        }
    }

    /** Prefer the key's own spelling (G rather than F## for the #9 of E7 in A minor); avoid double accidentals. */
    private static NoteName readable(Key key, NoteName name) {
        int pc = name.pitchClass().value();
        for (NoteName scaleNote : key.scale()) {
            if (scaleNote.pitchClass().value() == pc) {
                return scaleNote;
            }
        }
        return Math.abs(name.accidental()) == 2 ? key.spell(pc) : name;
    }
}
