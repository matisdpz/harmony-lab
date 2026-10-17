package com.harmonylab.project;

import java.util.UUID;

public class ProjectNotFoundException extends RuntimeException {

    public ProjectNotFoundException(UUID id) {
        super("No project with id " + id + " exists. It may have been deleted.");
    }
}
