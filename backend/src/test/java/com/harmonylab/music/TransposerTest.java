package com.harmonylab.music;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TransposerTest {

    private static List<Chord> chords(String symbols) {
        return Arrays.stream(symbols.split(" ")).map(ChordSymbol::parse).toList();
    }

    private static String symbols(Transposer.Result result) {
        return String.join(" ", result.chords().stream().map(Chord::symbol).toList());
    }

    @Test
    void spellsTheNewKeyWithTheFewestAccidentalsAndMovesChordsByTheSameInterval() {
        var result = Transposer.transpose(Key.of("A", Mode.MINOR), chords("Am F C G E7/G#"), null, 1);
        assertThat(result.key()).hasToString("Bb minor");
        assertThat(symbols(result)).isEqualTo("Bbm Gb Db Ab F7/A");

        assertThat(Transposer.transpose(Key.of("C", Mode.MAJOR), chords("C"), null, -1).key()).hasToString("B major");
        assertThat(Transposer.transpose(Key.of("E", Mode.MAJOR), chords("E"), null, -3).key()).hasToString("Db major");
        assertThat(Transposer.transpose(Key.of("D", Mode.DORIAN), chords("Dm7 G7"), null, 2).key()).hasToString("E Dorian");
    }

    @Test
    void movesVoicingsTheShortestWaySoRepeatedTranspositionDoesNotDrift() {
        List<Voicing> voicings = List.of(Voicing.of(57, 60, 64));
        assertThat(Transposer.transpose(Key.of("A", Mode.MINOR), chords("Am"), voicings, 1).voicings().getFirst().notes())
                .containsExactly(58, 61, 65);
        // +7 semitones is played 5 semitones lower: same pitch classes, smaller jump
        assertThat(Transposer.transpose(Key.of("A", Mode.MINOR), chords("Am"), voicings, 7).voicings().getFirst().notes())
                .containsExactly(52, 55, 59);
    }

    @Test
    void keepsQualitiesAndInversions() {
        var result = Transposer.transpose(Key.of("C", Mode.MAJOR), chords("Dm9 G13/F Cmaj7/E"), null, 2);
        assertThat(symbols(result)).isEqualTo("Em9 A13/G Dmaj7/F#");
    }

    @Test
    void rejectsOutOfRangeAmounts() {
        assertThatThrownBy(() -> Transposer.transpose(Key.of("C", Mode.MAJOR), chords("C"), null, 12))
                .isInstanceOf(InvalidMusicInputException.class);
    }
}
