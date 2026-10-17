package com.harmonylab.project;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<ProjectEntity, UUID> {

    /** Loads chords in the same query to avoid N+1 selects when listing. */
    @EntityGraph(attributePaths = "chords")
    List<ProjectEntity> findAllByOrderByUpdatedAtDesc();

    @EntityGraph(attributePaths = "chords")
    Optional<ProjectEntity> findWithChordsById(UUID id);
}
