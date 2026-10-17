package com.harmonylab.music;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class RomanNumeralTest {

    @ParameterizedTest(name = "{0} in {1} {2} = {3}")
    @CsvSource({
            "C,C,MAJOR,I", "Am,C,MAJOR,vi", "F,C,MAJOR,IV", "G,C,MAJOR,V", "G7,C,MAJOR,V7", "Bdim,C,MAJOR,vii°",
            "Bm7b5,C,MAJOR,viiø7", "Dm7,C,MAJOR,ii7", "Cmaj7,C,MAJOR,Imaj7", "Ab,C,MAJOR,bVI", "Bb,C,MAJOR,bVII",
            "C/E,C,MAJOR,I6", "G/D,C,MAJOR,V6/4", "G7/B,C,MAJOR,V6/5", "G7/D,C,MAJOR,V4/3", "G7/F,C,MAJOR,V4/2",
            "Am,A,MINOR,i", "F,A,MINOR,VI", "C,A,MINOR,III", "G,A,MINOR,VII", "E,A,MINOR,V", "E7,A,MINOR,V7",
            "G#dim7,A,MINOR,#vii°7", "Bdim,A,MINOR,ii°", "Caug,A,MINOR,III+", "Gsus4,C,MAJOR,Vsus4"})
    void labelsChordsRelativeToTheKey(String symbol, String tonic, Mode mode, String expected) {
        assertThat(RomanNumeral.of(ChordSymbol.parse(symbol), Key.of(tonic, mode)).format()).isEqualTo(expected);
    }
}
