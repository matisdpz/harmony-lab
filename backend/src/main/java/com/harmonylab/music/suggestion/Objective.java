package com.harmonylab.music.suggestion;

import com.harmonylab.music.InvalidMusicInputException;

/** What the user wants to explore when asking for alternatives to a chord. */
public enum Objective {
    SMOOTH_VOICE_LEADING("Smooth voice leading", "Prefer chords reachable with small voice movements and shared tones."),
    STRONGER_RESOLUTION("Stronger tonal resolution", "Prefer chords that lead strongly into the next chord (or close on the tonic)."),
    DIATONIC_ALTERNATIVES("Diatonic alternatives", "Only chords from the key, preferring the same function as the current chord."),
    HARMONIC_COLOR("More harmonic colour", "Sevenths, added tones, suspensions and chords borrowed from outside the key.");

    private final String label;
    private final String description;

    Objective(String label, String description) {
        this.label = label;
        this.description = description;
    }

    public String label() {
        return label;
    }

    public String description() {
        return description;
    }

    public static Objective fromId(String id) {
        if (id == null || id.isBlank()) {
            return SMOOTH_VOICE_LEADING;
        }
        try {
            return valueOf(id.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidMusicInputException("Unknown suggestion objective '" + id + "'");
        }
    }
}
