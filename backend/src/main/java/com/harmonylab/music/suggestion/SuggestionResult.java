package com.harmonylab.music.suggestion;

import java.util.List;

/** Suggestions plus an explanatory message (always set when the list is empty). */
public record SuggestionResult(Objective objective, List<Suggestion> suggestions, String message) {
}
