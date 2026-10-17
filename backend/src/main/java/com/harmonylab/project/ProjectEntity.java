package com.harmonylab.project;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A saved workspace. The progression is an ordered element collection: Hibernate writes each chord's list
 * index to {@code project_chords.position}, so order is explicit in the database (primary key
 * {@code (project_id, position)}). {@code version} enables optimistic locking against lost updates.
 */
@Entity
@Table(name = "projects")
public class ProjectEntity {

    @Id
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "key_tonic", nullable = false, length = 3)
    private String keyTonic;

    @Column(name = "key_mode", nullable = false, length = 10)
    private String keyMode;

    @Column(name = "tempo_bpm", nullable = false)
    private int tempoBpm;

    @Column(name = "register_low", nullable = false)
    private int registerLow;

    @Column(name = "register_high", nullable = false)
    private int registerHigh;

    @Version
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "project_chords", joinColumns = @JoinColumn(name = "project_id"))
    @OrderColumn(name = "position")
    private List<ProjectChord> chords = new ArrayList<>();

    protected ProjectEntity() {
    }

    public ProjectEntity(UUID id, Instant createdAt) {
        this.id = id;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setKey(String tonic, String mode) {
        this.keyTonic = tonic;
        this.keyMode = mode;
    }

    public void setTempoBpm(int tempoBpm) {
        this.tempoBpm = tempoBpm;
    }

    public void setRegister(int low, int high) {
        this.registerLow = low;
        this.registerHigh = high;
    }

    public void touch(Instant now) {
        this.updatedAt = now;
    }

    /** Replaces the whole progression; the list order becomes the stored position. */
    public void replaceChords(List<ProjectChord> newChords) {
        chords.clear();
        chords.addAll(newChords);
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getKeyTonic() {
        return keyTonic;
    }

    public String getKeyMode() {
        return keyMode;
    }

    public int getTempoBpm() {
        return tempoBpm;
    }

    public int getRegisterLow() {
        return registerLow;
    }

    public int getRegisterHigh() {
        return registerHigh;
    }

    public Long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<ProjectChord> getChords() {
        return List.copyOf(chords);
    }
}
