package com.harmonylab.music;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A spelled note in a specific octave, using scientific pitch notation:
 * middle C is C4 = MIDI 60, A4 = MIDI 69. The octave number belongs to the letter, so
 * B#3 sounds the same as C4 (MIDI 60) and Cb4 the same as B3 (MIDI 59).
 */
public record Note(NoteName name, int octave) {

    private static final Pattern PATTERN = Pattern.compile("^([A-Ga-g](?:##|bb|#|b)?)(-?\\d)$");

    public Note {
        if (name == null) {
            throw new IllegalArgumentException("name must not be null");
        }
        int midi = midiOf(name, octave);
        if (midi < 0 || midi > 127) {
            throw new InvalidMusicInputException(name + "" + octave + " is outside the MIDI range 0-127");
        }
    }

    public static Note parse(String text) {
        Matcher matcher = PATTERN.matcher(text == null ? "" : text.trim());
        if (!matcher.matches()) {
            throw new InvalidMusicInputException("Invalid note '" + text + "'. Expected e.g. C4, F#3, Bb2.");
        }
        return new Note(NoteName.parse(matcher.group(1)), Integer.parseInt(matcher.group(2)));
    }

    /** Builds a note for a MIDI number using the given spelling (must match the pitch class). */
    public static Note fromMidi(int midi, NoteName spelling) {
        if (spelling.pitchClass().value() != Math.floorMod(midi, 12)) {
            throw new IllegalArgumentException(spelling + " does not spell MIDI note " + midi);
        }
        int octave = Math.floorDiv(midi - spelling.letter().naturalPitchClass() - spelling.accidental(), 12) - 1;
        return new Note(spelling, octave);
    }

    public static Note fromMidi(int midi) {
        return fromMidi(midi, PitchClass.ofMidi(midi).defaultSpelling());
    }

    public int midi() {
        return midiOf(name, octave);
    }

    private static int midiOf(NoteName name, int octave) {
        return (octave + 1) * 12 + name.letter().naturalPitchClass() + name.accidental();
    }

    @Override
    public String toString() {
        return name.toString() + octave;
    }
}
