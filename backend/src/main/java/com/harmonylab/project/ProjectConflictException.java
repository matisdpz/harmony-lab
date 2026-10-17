package com.harmonylab.project;

/** The client edited an outdated version of the project (optimistic locking). */
public class ProjectConflictException extends RuntimeException {

    private final long currentVersion;

    public ProjectConflictException(long submittedVersion, long currentVersion) {
        super("The project was changed elsewhere (you edited version " + submittedVersion + ", the saved version is "
                + currentVersion + "). Reload it or save your work as a copy.");
        this.currentVersion = currentVersion;
    }

    public long currentVersion() {
        return currentVersion;
    }
}
