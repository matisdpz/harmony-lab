package com.harmonylab.music.voiceleading;

import com.harmonylab.music.Chord;
import com.harmonylab.music.Voicing;

import java.util.List;

/** A candidate voicing of the target chord, ranked by voice-leading cost from the previous voicing. */
public record RankedVoicing(int rank, Chord chord, Voicing voicing, VoiceLeadingResult result, List<String> reasons) {
}
