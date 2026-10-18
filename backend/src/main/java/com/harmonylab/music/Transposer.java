package com.harmonylab.music;

import java.util.ArrayList;
import java.util.List;

/**
 * Transposes a key together with its chords. The new tonic is spelled with the fewest accidentals (A minor up a
 * semitone is Bb minor, not A# minor), and every chord root moves by the same spelled interval as the tonic, so
 * the chords keep their relationship to the key (F in A minor becomes Gb in Bb minor, VI stays VI).
 */
public final class Transposer {

    public record Result(Key key, List<Chord> chords, List<Voicing> voicings) {
    }

    private Transposer() {
    }

    /**
     * @param semitones  between -11 and 11
     * @param voicings   one per chord (may contain nulls); each is moved by the same pitch-class shift, choosing the
     *                   direction (up or down) that moves it least, so repeated transposition does not drift
     */
    public static Result transpose(Key key, List<Chord> chords, List<Voicing> voicings, int semitones) {
        if (semitones < -11 || semitones > 11) {
            throw new InvalidMusicInputException("Transpose by -11 to 11 semitones");
        }
        Key target = targetKey(key, semitones);
        Interval up = Interval.between(key.tonic(), target.tonic());
        int shift = Math.floorMod(semitones, 12) > 6 ? Math.floorMod(semitones, 12) - 12 : Math.floorMod(semitones, 12);
        List<Chord> movedChords = new ArrayList<>();
        List<Voicing> movedVoicings = new ArrayList<>();
        for (int i = 0; i < chords.size(); i++) {
            Chord chord = chords.get(i);
            movedChords.add(new Chord(chord.root().transpose(up), chord.quality(), chord.inversion()));
            Voicing voicing = voicings == null || i >= voicings.size() ? null : voicings.get(i);
            movedVoicings.add(voicing == null ? null : voicing.transpose(shift));
        }
        return new Result(target, movedChords, movedVoicings);
    }

    /** The key a number of semitones away, spelled with the fewest accidentals among real (non-theoretical) keys. */
    static Key targetKey(Key key, int semitones) {
        PitchClass pc = key.tonic().pitchClass().transpose(semitones);
        Key best = null;
        for (NoteName spelling : List.of(pc.spelling(false), pc.spelling(true))) {
            try {
                Key candidate = new Key(spelling, key.mode());
                if (best == null || Math.abs(candidate.signature()) < Math.abs(best.signature())) {
                    best = candidate;
                }
            } catch (InvalidMusicInputException theoretical) {
                // try the enharmonic spelling
            }
        }
        if (best == null) {
            throw new InvalidMusicInputException("No playable spelling for " + pc + " " + key.mode().label());
        }
        return best;
    }
}
