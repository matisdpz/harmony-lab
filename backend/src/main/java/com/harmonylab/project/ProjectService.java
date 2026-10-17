package com.harmonylab.project;

import com.harmonylab.api.DomainMapper;
import com.harmonylab.api.FieldValidationException;
import com.harmonylab.api.dto.ChordView;
import com.harmonylab.api.dto.KeyDto;
import com.harmonylab.api.dto.RegisterDto;
import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordQuality;
import com.harmonylab.music.Key;
import com.harmonylab.music.NoteName;
import com.harmonylab.music.Register;
import com.harmonylab.music.Voicing;
import com.harmonylab.music.analysis.ProgressionChord;
import com.harmonylab.project.ProjectDtos.ProjectRequest;
import com.harmonylab.project.ProjectDtos.ProjectResponse;
import com.harmonylab.project.ProjectDtos.ProjectSummary;
import com.harmonylab.project.ProjectDtos.RenameRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Project use cases. All input is validated against the music domain before anything is written, and every
 * write runs in one transaction, so a rejected update never leaves a partially modified project behind.
 * Updates must carry the version the client loaded; a mismatch is reported as a conflict instead of silently
 * overwriting someone else's (or another tab's) changes.
 */
@Service
@Transactional
public class ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);
    private static final int PREVIEW_SIZE = 8;

    private final ProjectRepository repository;
    private final Clock clock;

    public ProjectService(ProjectRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    private record ValidatedProject(String name, Key key, int tempo, Register register, List<ProjectChord> chords) {
    }

    @Transactional(readOnly = true)
    public List<ProjectSummary> list() {
        return repository.findAllByOrderByUpdatedAtDesc().stream().map(this::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse get(UUID id) {
        return toResponse(load(id));
    }

    public ProjectResponse create(ProjectRequest request) {
        ValidatedProject valid = validate(request);
        ProjectEntity entity = new ProjectEntity(UUID.randomUUID(), now());
        apply(entity, valid);
        ProjectEntity saved = repository.saveAndFlush(entity);
        log.info("Created project {} ('{}', {} chords)", saved.getId(), saved.getName(), valid.chords().size());
        return toResponse(saved);
    }

    public ProjectResponse update(UUID id, ProjectRequest request) {
        if (request.version() == null) {
            throw FieldValidationException.single("version", "is required when updating a project");
        }
        ProjectEntity entity = load(id);
        requireVersion(entity, request.version());
        ValidatedProject valid = validate(request);
        apply(entity, valid);
        entity.touch(now());
        ProjectEntity saved = repository.saveAndFlush(entity);
        log.info("Updated project {} to version {}", id, saved.getVersion());
        return toResponse(saved);
    }

    public ProjectResponse rename(UUID id, RenameRequest request) {
        ProjectEntity entity = load(id);
        requireVersion(entity, request.version());
        entity.setName(request.name().trim());
        entity.touch(now());
        return toResponse(repository.saveAndFlush(entity));
    }

    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new ProjectNotFoundException(id);
        }
        repository.deleteById(id);
        log.info("Deleted project {}", id);
    }

    public ProjectResponse duplicate(UUID id) {
        ProjectEntity source = load(id);
        ProjectEntity copy = new ProjectEntity(UUID.randomUUID(), now());
        String name = source.getName() + " (copy)";
        copy.setName(name.length() > 100 ? name.substring(0, 100) : name);
        copy.setKey(source.getKeyTonic(), source.getKeyMode());
        copy.setTempoBpm(source.getTempoBpm());
        copy.setRegister(source.getRegisterLow(), source.getRegisterHigh());
        copy.replaceChords(source.getChords());
        return toResponse(repository.saveAndFlush(copy));
    }

    private ProjectEntity load(UUID id) {
        if (id == null) {
            throw FieldValidationException.single("id", "is required");
        }
        return repository.findWithChordsById(id).orElseThrow(() -> new ProjectNotFoundException(id));
    }

    private static void requireVersion(ProjectEntity entity, long submitted) {
        if (entity.getVersion() == null || entity.getVersion() != submitted) {
            throw new ProjectConflictException(submitted, entity.getVersion() == null ? 0 : entity.getVersion());
        }
    }

    private static void apply(ProjectEntity entity, ValidatedProject valid) {
        entity.setName(valid.name());
        entity.setKey(valid.key().tonic().toString(), valid.key().mode().name());
        entity.setTempoBpm(valid.tempo());
        entity.setRegister(valid.register().low(), valid.register().high());
        entity.replaceChords(valid.chords());
    }

    /** Validates the request with the music domain; throws with field paths such as chords[2].voicing. */
    private static ValidatedProject validate(ProjectRequest request) {
        Key key = DomainMapper.toKey(request.key(), "key");
        Register register = DomainMapper.toRegister(request.register(), "register");
        List<ProgressionChord> progression = DomainMapper.toProgression(request.chords(), "chords", true);
        List<FieldValidationException.FieldError> errors = new ArrayList<>();
        List<ProjectChord> chords = new ArrayList<>();
        for (int i = 0; i < progression.size(); i++) {
            ProgressionChord pc = progression.get(i);
            if (pc.voicing().lowest() < Register.PIANO_LOW || pc.voicing().highest() > Register.PIANO_HIGH) {
                errors.add(new FieldValidationException.FieldError("chords[" + i + "].voicing",
                        "notes must be within the piano range (MIDI 21-108)"));
                continue;
            }
            chords.add(new ProjectChord(pc.chord().root().toString(), pc.chord().quality().name(),
                    pc.chord().inversion(), pc.voicing().notes(), request.chords().get(i).durationOrDefault()));
        }
        if (!errors.isEmpty()) {
            throw new FieldValidationException(errors);
        }
        return new ValidatedProject(request.name().trim(), key, request.tempoBpm(), register, chords);
    }

    private Instant now() {
        // PostgreSQL stores microseconds; truncating keeps responses identical before and after a reload.
        return Instant.now(clock).truncatedTo(ChronoUnit.MICROS);
    }

    private static Chord toChord(ProjectChord stored) {
        return new Chord(NoteName.parse(stored.getRoot()), ChordQuality.fromId(stored.getQuality()), stored.getInversion());
    }

    private ProjectResponse toResponse(ProjectEntity entity) {
        List<ChordView> chords = entity.getChords().stream()
                .map(c -> DomainMapper.toView(toChord(c), new Voicing(c.getVoicing()), c.getDurationBeats()))
                .toList();
        return new ProjectResponse(entity.getId(), entity.getName(), new KeyDto(entity.getKeyTonic(), entity.getKeyMode()),
                entity.getTempoBpm(), new RegisterDto(entity.getRegisterLow(), entity.getRegisterHigh()), chords,
                entity.getVersion() == null ? 0 : entity.getVersion(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    private ProjectSummary toSummary(ProjectEntity entity) {
        List<ProjectChord> chords = entity.getChords();
        List<String> preview = chords.stream().limit(PREVIEW_SIZE).map(c -> toChord(c).symbol()).toList();
        Key key = Key.of(entity.getKeyTonic(), com.harmonylab.music.Mode.valueOf(entity.getKeyMode()));
        return new ProjectSummary(entity.getId(), entity.getName(), new KeyDto(entity.getKeyTonic(), entity.getKeyMode()),
                key.toString(), entity.getTempoBpm(), chords.size(), preview,
                entity.getVersion() == null ? 0 : entity.getVersion(), entity.getCreatedAt(), entity.getUpdatedAt());
    }
}
