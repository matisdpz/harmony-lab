package com.harmonylab.project;

import com.harmonylab.project.ProjectDtos.ProjectRequest;
import com.harmonylab.project.ProjectDtos.ProjectResponse;
import com.harmonylab.project.ProjectDtos.ProjectSummary;
import com.harmonylab.project.ProjectDtos.RenameRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
@Tag(name = "Projects", description = "Saved Harmony Lab workspaces (single-user, no authentication)")
public class ProjectController {

    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List projects, most recently updated first")
    public List<ProjectSummary> list() {
        return service.list();
    }

    @PostMapping
    @Operation(summary = "Create a project")
    public ResponseEntity<ProjectResponse> create(@Valid @RequestBody ProjectRequest request) {
        ProjectResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/projects/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a project with its ordered progression")
    public ProjectResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace a project's content; requires the version that was loaded (409 on conflict)")
    public ProjectResponse update(@PathVariable UUID id, @Valid @RequestBody ProjectRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Rename a project; requires the current version")
    public ProjectResponse rename(@PathVariable UUID id, @Valid @RequestBody RenameRequest request) {
        return service.rename(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a project")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/duplicate")
    @Operation(summary = "Duplicate a project")
    public ResponseEntity<ProjectResponse> duplicate(@PathVariable UUID id) {
        ProjectResponse copy = service.duplicate(id);
        return ResponseEntity.created(URI.create("/api/projects/" + copy.id())).body(copy);
    }
}
