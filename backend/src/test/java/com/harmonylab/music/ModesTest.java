package com.harmonylab.music;

import com.harmonylab.music.analysis.ChordCategory;
import com.harmonylab.music.analysis.ChordInterpreter;
import com.harmonylab.music.improvisation.ProgressionPresets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Harmonic and melodic minor and the church modes. */
class ModesTest {

    private static String scale(String tonic, Mode mode) {
        return String.join(" ", Key.of(tonic, mode).scale().stream().map(NoteName::toString).toList());
    }

    private static String chords(String tonic, Mode mode, boolean sevenths) {
        Key key = Key.of(tonic, mode);
        return String.join(" ", key.diatonicChords(sevenths).stream().map(c -> RomanNumeral.of(c, key).format()).toList());
    }

    @ParameterizedTest
    @CsvSource({
            "A, HARMONIC_MINOR, A B C D E F G#",
            "A, MELODIC_MINOR, A B C D E F# G#",
            "D, DORIAN, D E F G A B C",
            "E, PHRYGIAN, E F G A B C D",
            "F, LYDIAN, F G A B C D E",
            "G, MIXOLYDIAN, G A B C D E F",
            "B, LOCRIAN, B C D E F G A",
            "D#, HARMONIC_MINOR, D# E# F# G# A# B C##",
    })
    void spellsEveryModeLetterByLetter(String tonic, Mode mode, String expected) {
        assertThat(scale(tonic, mode)).isEqualTo(expected);
    }

    @Test
    void usesTheNaturalMinorSignatureForHarmonicAndMelodicMinor() {
        assertThat(Key.of("D#", Mode.HARMONIC_MINOR).signature()).isEqualTo(6);
        assertThat(Key.of("D", Mode.DORIAN).signature()).isZero();
        assertThat(Key.of("F#", Mode.MIXOLYDIAN).signature()).isEqualTo(5);
    }

    @Test
    void buildsTheDiatonicChordsOfEachMode() {
        assertThat(chords("A", Mode.HARMONIC_MINOR, false)).isEqualTo("i ii° III+ iv V VI vii°");
        assertThat(chords("A", Mode.HARMONIC_MINOR, true)).isEqualTo("imaj7 iiø7 III+maj7 iv7 V7 VImaj7 vii°7");
        assertThat(chords("A", Mode.MELODIC_MINOR, true)).isEqualTo("imaj7 ii7 III+maj7 IV7 V7 viø7 viiø7");
        assertThat(chords("D", Mode.DORIAN, false)).isEqualTo("i ii III IV v vi° VII");
        assertThat(chords("G", Mode.MIXOLYDIAN, false)).isEqualTo("I ii iii° IV v vi VII");
    }

    @Test
    void givesTonalFunctionsOnlyWhereTheyApply() {
        var dominant = ChordInterpreter.interpret(Key.of("A", Mode.HARMONIC_MINOR), ChordSymbol.parse("E7"), null);
        assertThat(dominant.category()).isEqualTo(ChordCategory.DIATONIC);
        assertThat(dominant.function()).isEqualTo(HarmonicFunction.DOMINANT);
        assertThat(dominant.functionConfident()).isTrue();

        Key dDorian = Key.of("D", Mode.DORIAN);
        assertThat(ChordInterpreter.interpret(dDorian, ChordSymbol.parse("Dm"), null).function()).isEqualTo(HarmonicFunction.TONIC);
        var fourth = ChordInterpreter.interpret(dDorian, ChordSymbol.parse("G"), null);
        assertThat(fourth.category()).isEqualTo(ChordCategory.DIATONIC);
        assertThat(fourth.function()).isNull();
        assertThat(fourth.explanation()).contains("No conventional function").contains("Dorian");

        var flatSix = ChordInterpreter.interpret(Key.of("A", Mode.DORIAN), ChordSymbol.parse("F"), null);
        assertThat(flatSix.category()).isEqualTo(ChordCategory.BORROWED);
        assertThat(flatSix.explanation()).contains("borrowed from A minor");
    }

    @Test
    void realisesPresetsInModesAndMinorPresetsInHarmonicMinor() {
        assertThat(ProgressionPresets.forMode(Mode.DORIAN)).extracting(ProgressionPresets.Preset::id).containsExactly("dorian-vamp");
        var dorian = ProgressionPresets.realize(ProgressionPresets.byId("dorian-vamp"), Key.of("D", Mode.DORIAN));
        assertThat(dorian).extracting(c -> c.chord().symbol()).containsExactly("Dm7", "G7");

        Key harmonic = Key.of("A", Mode.HARMONIC_MINOR);
        assertThat(ProgressionPresets.forMode(Mode.HARMONIC_MINOR)).extracting(ProgressionPresets.Preset::id).contains("andalusian");
        var andalusian = ProgressionPresets.realize(ProgressionPresets.byId("andalusian"), harmonic);
        assertThat(andalusian).extracting(c -> c.chord().symbol()).containsExactly("Am", "G", "F", "E");
    }

    @Test
    void keepsSavedMajorAndMinorIdsAndListsAllModes() {
        assertThat(Mode.fromId("minor")).isEqualTo(Mode.MINOR);
        assertThat(List.of(Mode.values())).hasSize(9);
        assertThat(Key.of("A", Mode.MINOR).toString()).isEqualTo("A minor");
        assertThat(Key.of("D", Mode.DORIAN).toString()).isEqualTo("D Dorian");
    }
}
