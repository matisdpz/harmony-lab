package com.harmonylab.music.suggestion;

import com.harmonylab.music.analysis.ProgressionChord;

import java.util.List;

/**
 * A complete alternative version of the progression.
 *
 * @param objective    the objective that produced it, or null for the re-voicing alternative
 * @param changedIndex index of the replaced chord, or null when only voicings changed
 */
public record ProgressionAlternative(String title, Objective objective, String description,
                                     List<ProgressionChord> chords, Integer changedIndex) {
}
