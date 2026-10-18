package com.harmonylab.api.dto;

import java.util.List;

/**
 * A chord as returned by the API: structured fields plus derived, display-ready data.
 *
 * @param notes         chord tones in root-position order (spelled)
 * @param notesFromBass chord tones starting from the bass
 * @param voicing       concrete MIDI notes, or null when no voicing was requested
 * @param voicingNotes  spelled notes with octaves for the voicing (C4 = middle C)
 * @param pattern       playback pattern of a saved chord, or null outside projects
 */
public record ChordView(
        String symbol,
        String root,
        String quality,
        String qualityName,
        int inversion,
        String bass,
        List<String> notes,
        List<String> notesFromBass,
        List<Integer> pitchClasses,
        List<IntervalView> intervals,
        List<Integer> voicing,
        List<String> voicingNotes,
        Integer durationBeats,
        String pattern) {
}
