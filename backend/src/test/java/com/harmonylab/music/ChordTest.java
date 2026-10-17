package com.harmonylab.music;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChordTest {

    @ParameterizedTest(name = "C {0} = {1}")
    @CsvSource({
            "MAJOR,C E G", "MINOR,C Eb G", "DIMINISHED,C Eb Gb", "AUGMENTED,C E G#",
            "SUS2,C D G", "SUS4,C F G", "MAJOR7,C E G B", "MINOR7,C Eb G Bb", "DOMINANT7,C E G Bb",
            "HALF_DIMINISHED7,C Eb Gb Bb", "DIMINISHED7,C Eb Gb Bbb", "MAJOR6,C E G A", "MINOR6,C Eb G A",
            "ADD9,C E G D", "MINOR_ADD9,C Eb G D"})
    void constructsEverySupportedQualityWithCorrectSpelling(ChordQuality quality, String expectedTones) {
        Chord chord = Chord.of("C", quality);
        assertThat(chord.tones()).map(NoteName::toString).containsExactlyElementsOf(Arrays.asList(expectedTones.split(" ")));
    }

    @Test
    void spellsChordsOnAccidentalRootsCorrectly() {
        assertThat(Chord.of("Db", ChordQuality.MINOR).tones()).map(Object::toString).containsExactly("Db", "Fb", "Ab");
        assertThat(Chord.of("F#", ChordQuality.DOMINANT7).tones()).map(Object::toString).containsExactly("F#", "A#", "C#", "E");
        assertThat(Chord.of("B", ChordQuality.DIMINISHED7).tones()).map(Object::toString).containsExactly("B", "D", "F", "Ab");
    }

    @Test
    void exposesIntervalsAndPitchClasses() {
        Chord g7 = Chord.of("G", ChordQuality.DOMINANT7);
        assertThat(g7.intervals()).map(Interval::shortName).containsExactly("P1", "M3", "P5", "m7");
        assertThat(g7.pitchClasses()).containsExactly(2, 5, 7, 11);
        assertThat(g7.containsPitchClass(17)).isTrue(); // F, any octave
    }

    @Test
    void handlesInversions() {
        Chord c = Chord.of("C", ChordQuality.MAJOR7);
        assertThat(c.withInversion(1).bass()).hasToString("E");
        assertThat(c.withInversion(3).tonesFromBass()).map(Object::toString).containsExactly("B", "C", "E", "G");
        assertThat(c.withBassPitchClass(7).inversion()).isEqualTo(2);
        assertThatThrownBy(() -> Chord.of("C", ChordQuality.MAJOR).withInversion(3))
                .isInstanceOf(InvalidMusicInputException.class).hasMessageContaining("Inversion 3");
        assertThatThrownBy(() -> c.withBassPitchClass(1)).isInstanceOf(InvalidMusicInputException.class);
    }

    @Test
    void transposesKeepingQualityAndInversion() {
        Chord cFirstInversion = Chord.of("C", ChordQuality.MINOR7).withInversion(1);
        Chord d = cFirstInversion.transpose(Interval.MAJOR_SECOND);
        assertThat(d.symbol()).isEqualTo("Dm7/F");
        assertThat(Chord.of("A", ChordQuality.MAJOR).transposeSemitones(1, true).symbol()).isEqualTo("Bb");
        assertThat(Chord.of("A", ChordQuality.MAJOR).transposeSemitones(-10, false).symbol()).isEqualTo("B");
        assertThat(Chord.of("E", ChordQuality.MAJOR).transposeSemitones(12, false)).isEqualTo(Chord.of("E", ChordQuality.MAJOR));
    }

    @Test
    void comparesSoundingNotesIndependentlyOfSpelling() {
        assertThat(Chord.of("C", ChordQuality.MAJOR6).hasSamePitchClasses(Chord.of("A", ChordQuality.MINOR7))).isTrue();
        assertThat(Chord.of("C#", ChordQuality.MAJOR).hasSamePitchClasses(Chord.of("Db", ChordQuality.MAJOR))).isTrue();
    }

    @ParameterizedTest
    @CsvSource({"Am,A,MINOR,0", "F#m7b5,F#,HALF_DIMINISHED7,0", "Bbmaj7,Bb,MAJOR7,0", "C/E,C,MAJOR,1",
            "G7/F,G,DOMINANT7,3", "Ebdim7,Eb,DIMINISHED7,0", "Dsus,D,SUS4,0", "C6/A,C,MAJOR6,3", "AbM7,Ab,MAJOR7,0",
            "Fadd9,F,ADD9,0", "Em6,E,MINOR6,0", "Caug,C,AUGMENTED,0", "Bø7,B,HALF_DIMINISHED7,0", "C/Fb,C,MAJOR,1"})
    void parsesChordSymbols(String symbol, String root, ChordQuality quality, int inversion) {
        Chord chord = ChordSymbol.parse(symbol);
        assertThat(chord.root()).isEqualTo(NoteName.parse(root));
        assertThat(chord.quality()).isEqualTo(quality);
        assertThat(chord.inversion()).isEqualTo(inversion);
    }

    @Test
    void formatsAndRoundTripsChordSymbols() {
        for (String symbol : List.of("C", "Am", "F#m7b5", "Bbmaj7", "C/E", "G7/F", "Dbdim7", "Esus2", "Aadd9", "Cmadd9", "Gm6")) {
            assertThat(ChordSymbol.format(ChordSymbol.parse(symbol))).isEqualTo(symbol);
        }
    }

    @Test
    void rejectsInvalidOrUnsupportedChordSymbols() {
        assertThatThrownBy(() -> ChordSymbol.parse("")).isInstanceOf(InvalidMusicInputException.class).hasMessageContaining("empty");
        assertThatThrownBy(() -> ChordSymbol.parse("H7")).hasMessageContaining("Invalid chord symbol");
        assertThatThrownBy(() -> ChordSymbol.parse("am")).hasMessageContaining("uppercase root");
        assertThatThrownBy(() -> ChordSymbol.parse("C13#11")).hasMessageContaining("Unsupported chord quality");
        assertThatThrownBy(() -> ChordSymbol.parse("C/D")).hasMessageContaining("not a chord tone");
    }
}
