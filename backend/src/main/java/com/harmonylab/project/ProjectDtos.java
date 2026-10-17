package com.harmonylab.project;

import com.harmonylab.api.dto.ChordInput;
import com.harmonylab.api.dto.ChordView;
import com.harmonylab.api.dto.KeyDto;
import com.harmonylab.api.dto.RegisterDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ProjectDtos {

    public static final int MIN_TEMPO = 30;
    public static final int MAX_TEMPO = 300;

    private ProjectDtos() {
    }

    /**
     * Full project state for create (version ignored) and update (version required).
     * Every chord must carry a voicing that matches it; this is checked by the domain model.
     */
    public record ProjectRequest(
            @NotBlank(message = "is required") @Size(max = 100, message = "must be at most 100 characters") String name,
            @NotNull(message = "is required") @Valid KeyDto key,
            @NotNull(message = "is required") @Min(value = MIN_TEMPO, message = "must be between 30 and 300 BPM") @Max(value = MAX_TEMPO, message = "must be between 30 and 300 BPM") Integer tempoBpm,
            @Valid RegisterDto register,
            @NotNull(message = "is required") @Size(max = 64, message = "must contain at most 64 chords") List<@Valid ChordInput> chords,
            Long version) {
    }

    public record RenameRequest(
            @NotBlank(message = "is required") @Size(max = 100, message = "must be at most 100 characters") String name,
            @NotNull(message = "is required") Long version) {
    }

    public record ProjectResponse(UUID id, String name, KeyDto key, int tempoBpm, RegisterDto register,
                                  List<ChordView> chords, long version, Instant createdAt, Instant updatedAt) {
    }

    public record ProjectSummary(UUID id, String name, KeyDto key, String keyLabel, int tempoBpm, int chordCount,
                                 List<String> preview, long version, Instant createdAt, Instant updatedAt) {
    }
}
