package com.harmonylab.api;

import java.util.List;

/** Validation failure with one or more field-level messages (paths like {@code chords[2].voicing}). */
public class FieldValidationException extends RuntimeException {

    public record FieldError(String field, String message) {
    }

    private final List<FieldError> errors;

    public FieldValidationException(List<FieldError> errors) {
        super(errors.isEmpty() ? "Validation failed" : errors.getFirst().field() + ": " + errors.getFirst().message());
        this.errors = List.copyOf(errors);
    }

    public static FieldValidationException single(String field, String message) {
        return new FieldValidationException(List.of(new FieldError(field, message)));
    }

    public List<FieldError> errors() {
        return errors;
    }
}
