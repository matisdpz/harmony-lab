package com.harmonylab.project;

import com.harmonylab.api.FieldValidationException;
import com.harmonylab.api.dto.ChordInput;
import com.harmonylab.api.dto.KeyDto;
import com.harmonylab.project.ProjectDtos.ProjectRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    private static final Instant NOW = Instant.parse("2026-01-15T10:00:00Z");

    @Mock
    ProjectRepository repository;

    ProjectService service;

    @BeforeEach
    void setUp() {
        service = new ProjectService(repository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static ProjectRequest request(Long version, ChordInput... chords) {
        return new ProjectRequest(" Song ", new KeyDto("A", "MINOR"), 100, null, List.of(chords), version);
    }

    private static ChordInput am() {
        return new ChordInput("A", "MINOR", 0, List.of(57, 60, 64), null);
    }

    private static ProjectEntity storedEntity(UUID id, long version) throws Exception {
        ProjectEntity entity = new ProjectEntity(id, NOW);
        entity.setName("Stored");
        entity.setKey("A", "MINOR");
        entity.setTempoBpm(100);
        entity.setRegister(45, 79);
        Field field = ProjectEntity.class.getDeclaredField("version");
        field.setAccessible(true);
        field.set(entity, version);
        return entity;
    }

    @Test
    void createNormalisesInputAndUsesTheClock() {
        when(repository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        var response = service.create(request(null, am()));
        ArgumentCaptor<ProjectEntity> saved = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(repository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getName()).isEqualTo("Song");
        assertThat(saved.getValue().getChords()).hasSize(1);
        assertThat(saved.getValue().getChords().getFirst().getDurationBeats()).isEqualTo(4);
        assertThat(response.createdAt()).isEqualTo(NOW);
        assertThat(response.register().low()).isEqualTo(45);
    }

    @Test
    void staleVersionIsRejectedBeforeAnythingIsWritten() throws Exception {
        UUID id = UUID.randomUUID();
        when(repository.findWithChordsById(id)).thenReturn(Optional.of(storedEntity(id, 3)));
        assertThatThrownBy(() -> service.update(id, request(2L, am())))
                .isInstanceOf(ProjectConflictException.class)
                .satisfies(e -> assertThat(((ProjectConflictException) e).currentVersion()).isEqualTo(3));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void invalidChordsAreRejectedWithFieldPaths() throws Exception {
        UUID id = UUID.randomUUID();
        when(repository.findWithChordsById(id)).thenReturn(Optional.of(storedEntity(id, 0)));
        ChordInput wrongVoicing = new ChordInput("C", "MAJOR", 1, List.of(60, 64, 67), null); // C/E must have E lowest
        assertThatThrownBy(() -> service.update(id, request(0L, am(), wrongVoicing)))
                .isInstanceOf(FieldValidationException.class)
                .satisfies(e -> assertThat(((FieldValidationException) e).errors().getFirst().field()).isEqualTo("chords[1].voicing"));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void missingProjectsAreReported() {
        UUID id = UUID.randomUUID();
        when(repository.findWithChordsById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(id)).isInstanceOf(ProjectNotFoundException.class);
        when(repository.existsById(id)).thenReturn(false);
        assertThatThrownBy(() -> service.delete(id)).isInstanceOf(ProjectNotFoundException.class);
    }
}
