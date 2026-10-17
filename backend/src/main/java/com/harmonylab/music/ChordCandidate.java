package com.harmonylab.music;

/** One possible interpretation of a note set, produced by {@link ChordIdentifier}. */
public record ChordCandidate(Chord chord, boolean rootPosition, String explanation) {
}
