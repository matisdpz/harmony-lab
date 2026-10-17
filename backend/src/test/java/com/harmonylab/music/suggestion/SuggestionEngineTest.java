package com.harmonylab.music.suggestion;

import com.harmonylab.music.ChordSymbol;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;
import com.harmonylab.music.Register;
import com.harmonylab.music.VoicingGenerator;
import com.harmonylab.music.VoicingStyle;
import com.harmonylab.music.analysis.ChordCategory;
import com.harmonylab.music.analysis.ProgressionChord;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SuggestionEngineTest {

    private static final Key C_MAJOR = Key.of("C", Mode.MAJOR);

    private static List<ProgressionChord> voiced(String... symbols) {
        return Stream.of(symbols).map(ChordSymbol::parse)
                .map(c -> new ProgressionChord(c, VoicingGenerator.voice(c, VoicingStyle.CLOSE, Register.DEFAULT)))
                .toList();
    }

    @Test
    void rankingIsDeterministicAndSortedByScore() {
        List<ProgressionChord> progression = voiced("Am", "F", "C", "G");
        SuggestionResult first = SuggestionEngine.suggest(C_MAJOR, progression, 1, Objective.SMOOTH_VOICE_LEADING, Register.DEFAULT, 8);
        SuggestionResult second = SuggestionEngine.suggest(C_MAJOR, progression, 1, Objective.SMOOTH_VOICE_LEADING, Register.DEFAULT, 8);
        assertThat(first).isEqualTo(second);
        assertThat(first.suggestions()).hasSize(8);
        assertThat(first.suggestions()).extracting(Suggestion::score).isSortedAccordingTo((a, b) -> b - a);
        assertThat(first.suggestions()).allSatisfy(s -> {
            assertThat(s.reasons()).isNotEmpty();
            assertThat(s.breakdown().values().stream().mapToInt(Integer::intValue).sum()).isEqualTo(s.score());
            assertThat(s.chord().hasSamePitchClasses(ChordSymbol.parse("F"))).isFalse();
            assertThat(s.voicing().mismatchWith(s.chord())).isNull();
        });
    }

    @Test
    void diatonicObjectiveOnlyReturnsDiatonicChordsPreferringTheSameFunction() {
        SuggestionResult result = SuggestionEngine.suggest(C_MAJOR, voiced("C", "F", "G", "C"), 1,
                Objective.DIATONIC_ALTERNATIVES, Register.DEFAULT, 5);
        assertThat(result.suggestions()).isNotEmpty()
                .allMatch(s -> C_MAJOR.isDiatonic(s.chord()) && s.category() == ChordCategory.DIATONIC);
        // F is predominant; ii-type chords (Dm, Dm7) share its function and two of its notes
        assertThat(result.suggestions().getFirst().chord().root().toString()).isEqualTo("D");
    }

    @Test
    void resolutionObjectiveFavoursDominantsBeforeTheTonic() {
        SuggestionResult result = SuggestionEngine.suggest(C_MAJOR, voiced("C", "F", "Am", "C"), 2,
                Objective.STRONGER_RESOLUTION, Register.DEFAULT, 3);
        assertThat(result.suggestions()).isNotEmpty();
        Suggestion top = result.suggestions().getFirst();
        assertThat(top.chord().root().toString()).isIn("G", "B");
        assertThat(top.reasons()).anyMatch(r -> r.contains("fifth") || r.contains("leading tone"));
    }

    @Test
    void resolutionAtTheEndPrefersTheTonic() {
        SuggestionResult result = SuggestionEngine.suggest(C_MAJOR, voiced("F", "G", "Am"), 2,
                Objective.STRONGER_RESOLUTION, Register.DEFAULT, 3);
        assertThat(result.suggestions().getFirst().chord().root().toString()).isEqualTo("C");
        assertThat(result.suggestions().getFirst().reasons()).anyMatch(r -> r.contains("authentic cadence"));
    }

    @Test
    void colourObjectiveReturnsExtendedOrChromaticChords() {
        SuggestionResult result = SuggestionEngine.suggest(C_MAJOR, voiced("C", "F", "G", "C"), 1,
                Objective.HARMONIC_COLOR, Register.DEFAULT, 6);
        assertThat(result.suggestions()).isNotEmpty().allMatch(s -> s.chord().size() > 3
                || !C_MAJOR.isDiatonic(s.chord()) || s.chord().quality().family() != com.harmonylab.music.ChordQuality.Family.TRIAD);
    }

    @Test
    void explainsWhenNoStrongSuggestionExists() {
        // F# major has no notes in common with C major and no function there, so no diatonic chord can
        // stand in for it convincingly: the engine says so instead of inventing a result.
        SuggestionResult result = SuggestionEngine.suggest(C_MAJOR, voiced("C", "F#", "C"), 1,
                Objective.DIATONIC_ALTERNATIVES, Register.DEFAULT, 5);
        assertThat(result.suggestions()).isEmpty();
        assertThat(result.message()).contains("No candidate");
    }

    @Test
    void neverSuggestsARepeatOfANeighbouringChord() {
        List<ProgressionChord> progression = voiced("Am", "F", "C", "G");
        for (Objective objective : Objective.values()) {
            SuggestionResult result = SuggestionEngine.suggest(C_MAJOR, progression, 0, objective, Register.DEFAULT, 20);
            assertThat(result.suggestions()).noneMatch(s -> s.chord().hasSamePitchClasses(ChordSymbol.parse("F")));
        }
    }

    @Test
    void invertedOrSuspendedTonicsCloseLessStronglyThanRootPosition() {
        SuggestionResult result = SuggestionEngine.suggest(C_MAJOR, voiced("Am", "F", "C", "G"), 3,
                Objective.STRONGER_RESOLUTION, Register.DEFAULT, 20);
        Suggestion top = result.suggestions().getFirst();
        assertThat(top.chord().root().toString()).isEqualTo("C");
        assertThat(top.chord().inversion()).isZero();
        assertThat(top.chord().quality().family()).isNotEqualTo(com.harmonylab.music.ChordQuality.Family.SUSPENDED);
        result.suggestions().stream()
                .filter(s -> s.chord().quality().family() == com.harmonylab.music.ChordQuality.Family.SUSPENDED)
                .forEach(s -> assertThat(s.score()).isLessThan(top.score()));
    }

    @Test
    void diatonicAlternativesPreferSubstitutesOnOtherRoots() {
        SuggestionResult result = SuggestionEngine.suggest(C_MAJOR, voiced("Am", "F", "C", "G"), 3,
                Objective.DIATONIC_ALTERNATIVES, Register.DEFAULT, 3);
        assertThat(result.suggestions().getFirst().chord().root().toString()).isNotEqualTo("G");
        assertThat(result.suggestions().getFirst().breakdown()).containsEntry("differentRoot", 15);
    }

    @Test
    void validatesInput() {
        assertThatThrownBy(() -> SuggestionEngine.suggest(C_MAJOR, voiced("C"), 3, Objective.SMOOTH_VOICE_LEADING, Register.DEFAULT, 5))
                .isInstanceOf(InvalidMusicInputException.class);
        assertThatThrownBy(() -> SuggestionEngine.suggest(C_MAJOR, List.of(), 0, Objective.SMOOTH_VOICE_LEADING, Register.DEFAULT, 5))
                .isInstanceOf(InvalidMusicInputException.class);
        assertThatThrownBy(() -> Objective.fromId("louder")).isInstanceOf(InvalidMusicInputException.class);
    }

    @Test
    void alternativesIncludeRevoicingAndObjectiveVariants() {
        List<ProgressionChord> progression = voiced("Am", "F", "C", "G");
        List<ProgressionAlternative> alternatives = AlternativeGenerator.generate(C_MAJOR, progression, Register.DEFAULT);
        assertThat(alternatives.getFirst().title()).isEqualTo("Smoothest voicings");
        assertThat(alternatives.getFirst().chords()).hasSize(4);
        assertThat(alternatives).hasSizeGreaterThan(1);
        for (ProgressionAlternative alternative : alternatives.subList(1, alternatives.size())) {
            assertThat(alternative.changedIndex()).isNotNull();
            assertThat(alternative.chords().get(alternative.changedIndex()).chord()
                    .hasSamePitchClasses(progression.get(alternative.changedIndex()).chord())).isFalse();
        }
        assertThat(AlternativeGenerator.generate(C_MAJOR, progression, Register.DEFAULT)).isEqualTo(alternatives);
    }
}
