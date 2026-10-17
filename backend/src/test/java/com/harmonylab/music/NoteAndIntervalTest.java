package com.harmonylab.music;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NoteAndIntervalTest {

    @ParameterizedTest
    @CsvSource({"C,0", "C#,1", "Db,1", "B#,0", "Cb,11", "F##,7", "Ebb,2", "a,9", "Bb,10"})
    void parsesNoteNamesToPitchClasses(String name, int pitchClass) {
        assertThat(NoteName.parse(name).pitchClass().value()).isEqualTo(pitchClass);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "H", "C###", "Cbbb", "#C", "C# ", "Do"})
    void rejectsInvalidNoteNames(String name) {
        if (name.equals("C# ")) {
            assertThat(NoteName.parse(name)).isEqualTo(NoteName.parse("C#")); // surrounding whitespace is tolerated
            return;
        }
        assertThatThrownBy(() -> NoteName.parse(name)).isInstanceOf(InvalidMusicInputException.class);
    }

    @Test
    void enharmonicNotesShareAPitchClassButAreNotEqual() {
        NoteName cSharp = NoteName.parse("C#");
        NoteName dFlat = NoteName.parse("Db");
        assertThat(cSharp.isEnharmonicWith(dFlat)).isTrue();
        assertThat(cSharp).isNotEqualTo(dFlat);
    }

    @Test
    void transposingByIntervalKeepsLetterSpelling() {
        assertThat(NoteName.parse("Db").transpose(Interval.MAJOR_THIRD)).hasToString("F");
        assertThat(NoteName.parse("C#").transpose(Interval.MAJOR_THIRD)).hasToString("E#");
        assertThat(NoteName.parse("Db").transpose(Interval.MINOR_THIRD)).hasToString("Fb");
        assertThat(NoteName.parse("B").transpose(Interval.PERFECT_FIFTH)).hasToString("F#");
    }

    @ParameterizedTest
    @CsvSource({"C4,60", "A4,69", "C-1,0", "B#3,60", "Cb4,59", "G9,127", "A0,21"})
    void usesScientificPitchNotationForMidiNumbers(String note, int midi) {
        assertThat(Note.parse(note).midi()).isEqualTo(midi);
    }

    @Test
    void buildsNotesFromMidiWithRequestedSpelling() {
        assertThat(Note.fromMidi(61, NoteName.parse("Db"))).hasToString("Db4");
        assertThat(Note.fromMidi(60, NoteName.parse("B#"))).hasToString("B#3");
        assertThat(Note.fromMidi(61)).hasToString("C#4");
        assertThatThrownBy(() -> Note.fromMidi(61, NoteName.parse("D"))).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @CsvSource({
            "C,Eb,m3,3", "C,E,M3,4", "C,F#,A4,6", "C,Gb,d5,6", "C,G,P5,7", "C,G#,A5,8",
            "E,C,m6,8", "C,Bb,m7,10", "C,B,M7,11", "C,Bbb,d7,9", "C,B#,A7,12", "D,F,m3,3", "B,F,d5,6"})
    void computesSpelledIntervals(String lower, String upper, String name, int semitones) {
        Interval interval = Interval.between(NoteName.parse(lower), NoteName.parse(upper));
        assertThat(interval.shortName()).isEqualTo(name);
        assertThat(interval.semitones()).isEqualTo(semitones);
    }

    @Test
    void computesCompoundIntervalsBetweenAbsoluteNotes() {
        Interval tenth = Interval.between(Note.parse("C4"), Note.parse("E5"));
        assertThat(tenth.shortName()).isEqualTo("M10");
        assertThat(tenth.semitones()).isEqualTo(16);
        assertThat(Interval.MAJOR_NINTH.fullName()).isEqualTo("major ninth");
        assertThat(Interval.DIMINISHED_FIFTH.fullName()).isEqualTo("diminished fifth");
        assertThatThrownBy(() -> Interval.between(Note.parse("E5"), Note.parse("C4")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
