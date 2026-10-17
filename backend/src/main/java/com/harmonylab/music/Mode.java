package com.harmonylab.music;

import java.util.List;

import static com.harmonylab.music.Interval.*;

/** Supported key modes. MINOR means the natural minor (Aeolian) scale. */
public enum Mode {
    MAJOR("major", List.of(PERFECT_UNISON, MAJOR_SECOND, MAJOR_THIRD, PERFECT_FOURTH, PERFECT_FIFTH, MAJOR_SIXTH, MAJOR_SEVENTH)),
    MINOR("minor", List.of(PERFECT_UNISON, MAJOR_SECOND, MINOR_THIRD, PERFECT_FOURTH, PERFECT_FIFTH, MINOR_SIXTH, MINOR_SEVENTH));

    private final String label;
    private final List<Interval> scaleIntervals;

    Mode(String label, List<Interval> scaleIntervals) {
        this.label = label;
        this.scaleIntervals = scaleIntervals;
    }

    public String label() {
        return label;
    }

    public List<Interval> scaleIntervals() {
        return scaleIntervals;
    }

    public Mode parallel() {
        return this == MAJOR ? MINOR : MAJOR;
    }

    public static Mode fromId(String id) {
        if (id == null || id.isBlank()) {
            throw new InvalidMusicInputException("Key mode is empty");
        }
        try {
            return valueOf(id.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidMusicInputException("Unsupported mode '" + id + "'. Use MAJOR or MINOR.");
        }
    }
}
