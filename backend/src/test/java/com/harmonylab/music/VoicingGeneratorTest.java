package com.harmonylab.music;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VoicingGeneratorTest {

    private static final Register DEFAULT = Register.DEFAULT;

    @Test
    void closeVoicingIsCentredInTheRegisterWithTheBassAtTheBottom() {
        assertThat(VoicingGenerator.voice(Chord.of("C", ChordQuality.MAJOR), VoicingStyle.CLOSE, DEFAULT).notes())
                .containsExactly(60, 64, 67);
        assertThat(VoicingGenerator.voice(Chord.of("A", ChordQuality.MINOR), VoicingStyle.CLOSE, DEFAULT).notes())
                .containsExactly(57, 60, 64);
        assertThat(VoicingGenerator.voice(ChordSymbol.parse("G7/F"), VoicingStyle.CLOSE, DEFAULT).notes())
                .containsExactly(53, 55, 59, 62);
    }

    @Test
    void openAndDrop2VoicingsKeepTheChordsBass() {
        Voicing open = VoicingGenerator.voice(Chord.of("C", ChordQuality.MAJOR), VoicingStyle.OPEN, DEFAULT);
        assertThat(intervalsAboveBass(open)).containsExactly(0, 7, 16);

        Voicing drop2 = VoicingGenerator.voice(Chord.of("C", ChordQuality.MAJOR7), VoicingStyle.DROP2, DEFAULT);
        assertThat(intervalsAboveBass(drop2)).containsExactly(0, 7, 11, 16);
        assertThat(drop2.mismatchWith(Chord.of("C", ChordQuality.MAJOR7))).isNull();

        Chord firstInversion = ChordSymbol.parse("Dm7/F");
        assertThat(VoicingGenerator.voice(firstInversion, VoicingStyle.DROP2, DEFAULT).mismatchWith(firstInversion)).isNull();
    }

    @Test
    void failsClearlyWhenTheVoicingCannotFitTheRegister() {
        assertThatThrownBy(() -> VoicingGenerator.voice(Chord.of("C", ChordQuality.MAJOR7), VoicingStyle.OPEN, new Register(60, 75)))
                .isInstanceOf(InvalidMusicInputException.class).hasMessageContaining("does not fit");
        assertThatThrownBy(() -> new Register(60, 65)).isInstanceOf(InvalidMusicInputException.class);
        assertThatThrownBy(() -> new Register(10, 60)).isInstanceOf(InvalidMusicInputException.class);
    }

    @Test
    void candidatesAreValidSortedAndInsideTheRegister() {
        Chord chord = Chord.of("F", ChordQuality.MAJOR7);
        Register register = new Register(48, 72);
        List<Voicing> candidates = VoicingGenerator.candidates(chord, register, false);
        assertThat(candidates).isNotEmpty().doesNotHaveDuplicates();
        for (Voicing v : candidates) {
            assertThat(v.mismatchWith(chord)).isNull();
            assertThat(register.contains(v)).isTrue();
            assertThat(v.span()).isLessThanOrEqualTo(VoicingGenerator.MAX_SPAN);
        }
        assertThat(candidates).isSortedAccordingTo((a, b) -> VoicingGenerator.compareLexicographically(a.notes(), b.notes()));
        assertThat(VoicingGenerator.candidates(chord, register, false)).isEqualTo(candidates);
    }

    @Test
    void anyInversionCandidatesIncludeOtherBassNotes() {
        Chord c = Chord.of("C", ChordQuality.MAJOR);
        List<Voicing> all = VoicingGenerator.candidates(c, DEFAULT, true);
        assertThat(all).anyMatch(v -> v.lowest() % 12 == 4).anyMatch(v -> v.lowest() % 12 == 7);
        assertThat(VoicingGenerator.candidates(c, DEFAULT, false)).allMatch(v -> v.lowest() % 12 == 0);
    }

    @Test
    void voicingValidationDetectsMismatches() {
        Chord am = Chord.of("A", ChordQuality.MINOR);
        assertThat(Voicing.of(57, 60, 64).mismatchWith(am)).isNull();
        assertThat(Voicing.of(57, 61, 64).mismatchWith(am)).contains("not a tone");
        assertThat(Voicing.of(57, 60).mismatchWith(am)).contains("every tone");
        assertThat(Voicing.of(60, 64, 69).mismatchWith(am)).contains("lowest note");
        assertThatThrownBy(() -> Voicing.of(60, 60)).isInstanceOf(InvalidMusicInputException.class);
        assertThatThrownBy(() -> Voicing.of(128)).isInstanceOf(InvalidMusicInputException.class);
    }

    private static List<Integer> intervalsAboveBass(Voicing v) {
        return v.notes().stream().map(n -> n - v.lowest()).toList();
    }
}
