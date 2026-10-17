package com.harmonylab.project;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.List;

/**
 * Stores a voicing as a comma-separated list of MIDI numbers ("57,60,64"). A voicing is always read and
 * written as a whole, so a dedicated table would add joins without benefit; a CHECK constraint in the
 * migration guarantees the format.
 */
@Converter
public class VoicingConverter implements AttributeConverter<List<Integer>, String> {

    @Override
    public String convertToDatabaseColumn(List<Integer> notes) {
        return notes == null ? null : String.join(",", notes.stream().map(String::valueOf).toList());
    }

    @Override
    public List<Integer> convertToEntityAttribute(String column) {
        if (column == null || column.isBlank()) {
            return List.of();
        }
        return Arrays.stream(column.split(",")).map(String::trim).map(Integer::valueOf).toList();
    }
}
