package com.harmonylab.music;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/** A concrete realisation of a chord as distinct MIDI pitches, stored in ascending order. */
public record Voicing(List<Integer> notes) {

    public static final int MAX_NOTES = 8;

    public Voicing {
        if (notes == null || notes.isEmpty()) {
            throw new InvalidMusicInputException("A voicing needs at least one note");
        }
        if (notes.size() > MAX_NOTES) {
            throw new InvalidMusicInputException("A voicing can contain at most " + MAX_NOTES + " notes");
        }
        Set<Integer> seen = new HashSet<>();
        for (Integer note : notes) {
            if (note == null || note < 0 || note > 127) {
                throw new InvalidMusicInputException("Voicing notes must be MIDI numbers between 0 and 127");
            }
            if (!seen.add(note)) {
                throw new InvalidMusicInputException("Voicing contains the same note twice (MIDI " + note + ")");
            }
        }
        List<Integer> sorted = new ArrayList<>(notes);
        Collections.sort(sorted);
        notes = List.copyOf(sorted);
    }

    public static Voicing of(Integer... notes) {
        return new Voicing(List.of(notes));
    }

    public int size() {
        return notes.size();
    }

    public int lowest() {
        return notes.getFirst();
    }

    public int highest() {
        return notes.getLast();
    }

    public int span() {
        return highest() - lowest();
    }

    public double center() {
        return (lowest() + highest()) / 2.0;
    }

    public Set<Integer> pitchClasses() {
        Set<Integer> result = new TreeSet<>();
        notes.forEach(n -> result.add(Math.floorMod(n, 12)));
        return result;
    }

    public Voicing transpose(int semitones) {
        return new Voicing(notes.stream().map(n -> n + semitones).toList());
    }

    /**
     * Checks that this voicing realises the chord: every note is a chord tone, every chord tone is present
     * and the lowest note is the chord's bass (so that the voicing agrees with the inversion).
     *
     * @return null when valid, otherwise a human-readable reason
     */
    public String mismatchWith(Chord chord) {
        for (int note : notes) {
            if (!chord.containsPitchClass(note)) {
                return "Note " + Note.fromMidi(note) + " is not a tone of " + chord.symbol();
            }
        }
        if (!pitchClasses().equals(chord.pitchClasses())) {
            return "The voicing does not contain every tone of " + chord.symbol();
        }
        if (Math.floorMod(lowest(), 12) != chord.bass().pitchClass().value()) {
            return "The lowest note must be the bass of " + chord.symbol() + " (" + chord.bass() + ")";
        }
        return null;
    }

    /** Spelled note names (with octaves) using the chord's spelling. */
    public List<String> spelledNotes(Chord chord) {
        return notes.stream().map(midi -> {
            NoteName spelling = chord.spellingOf(midi);
            return (spelling != null ? Note.fromMidi(midi, spelling) : Note.fromMidi(midi)).toString();
        }).toList();
    }

    @Override
    public String toString() {
        return notes.toString();
    }
}
