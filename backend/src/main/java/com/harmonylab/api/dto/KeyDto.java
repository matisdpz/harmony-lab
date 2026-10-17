package com.harmonylab.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A key as sent over the API, e.g. {"tonic": "A", "mode": "MINOR"}. */
public record KeyDto(
        @NotBlank(message = "is required") @Size(max = 3, message = "must be a note name such as C, F# or Bb") String tonic,
        @NotBlank(message = "is required") String mode) {
}
