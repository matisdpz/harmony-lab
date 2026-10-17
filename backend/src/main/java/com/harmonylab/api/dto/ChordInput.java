package com.harmonylab.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * A chord as sent by the client: structured root/quality/inversion plus an optional voicing (MIDI numbers).
 * Musical validity (e.g. that the voicing matches the chord) is checked by the domain model.
 */
public record ChordInput(
        @NotBlank(message = "is required") @Size(max = 3, message = "must be a note name such as C, F# or Bb") String root,
        @NotBlank(message = "is required") @Size(max = 24, message = "is too long") String quality,
        @Min(value = 0, message = "must be between 0 and 3") @Max(value = 3, message = "must be between 0 and 3") Integer inversion,
        @Size(min = 1, max = 8, message = "must contain between 1 and 8 notes")
        List<@NotNull(message = "must not contain empty notes") @Min(value = 0, message = "notes must be MIDI 0-127") @Max(value = 127, message = "notes must be MIDI 0-127") Integer> voicing,
        @Min(value = 1, message = "must be between 1 and 16") @Max(value = 16, message = "must be between 1 and 16") Integer durationBeats) {

    public int inversionOrDefault() {
        return inversion == null ? 0 : inversion;
    }

    public int durationOrDefault() {
        return durationBeats == null ? 4 : durationBeats;
    }
}
