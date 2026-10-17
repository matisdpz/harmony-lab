package com.harmonylab.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** Inclusive MIDI range used when generating voicings (C4 = 60). */
public record RegisterDto(
        @NotNull(message = "is required") @Min(value = 21, message = "must be at least 21 (A0)") @Max(value = 108, message = "must be at most 108 (C8)") Integer low,
        @NotNull(message = "is required") @Min(value = 21, message = "must be at least 21 (A0)") @Max(value = 108, message = "must be at most 108 (C8)") Integer high) {
}
