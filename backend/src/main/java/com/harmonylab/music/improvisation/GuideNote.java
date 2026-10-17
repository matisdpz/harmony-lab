package com.harmonylab.music.improvisation;

import com.harmonylab.music.NoteName;

/** One pitch class of the improvisation guide, with its role and a short reason. */
public record GuideNote(int pitchClass, NoteName name, NoteRole role, String reason) {
}
