package com.harmonylab.music;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class KeyTest {

    @ParameterizedTest
    @CsvSource({
            "C,MAJOR,C D E F G A B,0", "G,MAJOR,G A B C D E F#,1", "F,MAJOR,F G A Bb C D E,-1",
            "F#,MAJOR,F# G# A# B C# D# E#,6", "Db,MAJOR,Db Eb F Gb Ab Bb C,-5",
            "A,MINOR,A B C D E F G,0", "E,MINOR,E F# G A B C D,1", "C,MINOR,C D Eb F G Ab Bb,-3",
            "G#,MINOR,G# A# B C# D# E F#,5"})
    void buildsCorrectlySpelledScalesAndSignatures(String tonic, Mode mode, String notes, int signature) {
        Key key = Key.of(tonic, mode);
        assertThat(String.join(" ", key.scale().stream().map(Object::toString).toList())).isEqualTo(notes);
        assertThat(key.signature()).isEqualTo(signature);
    }

    @Test
    void buildsDiatonicTriadsInMajorAndMinor() {
        assertThat(Key.of("C", Mode.MAJOR).diatonicChords(false)).map(Chord::symbol)
                .containsExactly("C", "Dm", "Em", "F", "G", "Am", "Bdim");
        assertThat(Key.of("A", Mode.MINOR).diatonicChords(false)).map(Chord::symbol)
                .containsExactly("Am", "Bdim", "C", "Dm", "Em", "F", "G");
    }

    @Test
    void buildsDiatonicSeventhChords() {
        assertThat(Key.of("C", Mode.MAJOR).diatonicChords(true)).map(Chord::symbol)
                .containsExactly("Cmaj7", "Dm7", "Em7", "Fmaj7", "G7", "Am7", "Bm7b5");
        assertThat(Key.of("E", Mode.MINOR).diatonicChords(true)).map(Chord::symbol)
                .containsExactly("Em7", "F#m7b5", "Gmaj7", "Am7", "Bm7", "Cmaj7", "D7");
    }

    @Test
    void distinguishesDiatonicAndNonDiatonicChords() {
        Key c = Key.of("C", Mode.MAJOR);
        assertThat(c.isDiatonic(Chord.of("A", ChordQuality.MINOR7))).isTrue();
        assertThat(c.isDiatonic(Chord.of("D", ChordQuality.MAJOR))).isFalse();
        assertThat(c.notesOutsideScale(Chord.of("D", ChordQuality.DOMINANT7))).map(Object::toString).containsExactly("F#");
        assertThat(c.degreeOf(9)).contains(6);
        assertThat(c.degreeOf(10)).isEmpty();
    }

    @Test
    void spellsNonDiatonicPitchClassesByKeyDirection() {
        assertThat(Key.of("F", Mode.MAJOR).spell(3)).hasToString("Eb");
        assertThat(Key.of("D", Mode.MAJOR).spell(3)).hasToString("Eb"); // default spelling for neutral/sharp keys
        assertThat(Key.of("E", Mode.MAJOR).spell(8)).hasToString("G#");
    }

    @Test
    void rejectsTheoreticalKeys() {
        assertThatThrownBy(() -> Key.of("G#", Mode.MAJOR)).isInstanceOf(InvalidMusicInputException.class)
                .hasMessageContaining("theoretical key");
        assertThatThrownBy(() -> Mode.fromId("aeolian-dominant")).isInstanceOf(InvalidMusicInputException.class)
                .hasMessageContaining("DORIAN");
    }
}
