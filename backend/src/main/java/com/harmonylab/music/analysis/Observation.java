package com.harmonylab.music.analysis;

/**
 * A single analysis statement. FACT statements are computed directly from the notes; HEURISTIC statements
 * apply stylistic conventions and may not hold for every musical style.
 */
public record Observation(Kind kind, Severity severity, String message) {

    public enum Kind { FACT, HEURISTIC }

    public enum Severity { INFO, WARNING }

    static Observation fact(String message) {
        return new Observation(Kind.FACT, Severity.INFO, message);
    }

    static Observation factWarning(String message) {
        return new Observation(Kind.FACT, Severity.WARNING, message);
    }

    static Observation heuristic(String message) {
        return new Observation(Kind.HEURISTIC, Severity.INFO, message);
    }

    static Observation heuristicWarning(String message) {
        return new Observation(Kind.HEURISTIC, Severity.WARNING, message);
    }
}
