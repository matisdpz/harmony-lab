package com.harmonylab.api.dto;

/** One chord tone and its interval above the root. */
public record IntervalView(String note, String name, String fullName, int semitones) {
}
