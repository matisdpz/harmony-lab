package com.harmonylab.music.analysis;

import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordSymbol;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class KeyDetectorTest {

    private static KeyDetector.Result detect(String symbols, Integer... beats) {
        List<Chord> chords = Arrays.stream(symbols.split(" ")).map(ChordSymbol::parse).toList();
        return KeyDetector.detect(chords, beats.length == 0 ? Collections.nCopies(chords.size(), 4) : List.of(beats));
    }

    @Test
    void findsAMajorKeyFromACadentialProgression() {
        var result = detect("C F G7 C Am Dm7 G7 C");
        assertThat(result.best().key()).isEqualTo(Key.of("C", Mode.MAJOR));
        assertThat(result.confidence()).isNotEqualTo(KeyDetector.Confidence.WEAK);
        assertThat(result.candidates()).hasSize(3);
        assertThat(result.explanation()).contains("C major").contains("Only major and natural minor");
    }

    @Test
    void findsAMinorKeyWhenTheLeadingToneAndTonicAreStressed() {
        var result = detect("Am Dm E7 Am Dm E7 Am", 4, 2, 2, 4, 2, 2, 8);
        assertThat(result.best().key()).isEqualTo(Key.of("A", Mode.MINOR));
    }

    @Test
    void reportsRelativeKeysAsTheMainAmbiguity() {
        var result = detect("Am F C G");
        assertThat(List.of(result.candidates().get(0).key(), result.candidates().get(1).key()))
                .contains(Key.of("C", Mode.MAJOR));
        assertThat(result.confidence()).isEqualTo(KeyDetector.Confidence.WEAK);
        assertThat(result.explanation()).contains("use the same notes").contains("Am … G");
    }

    @Test
    void longerChordsCountMore() {
        double[] weights = KeyDetector.distribution(List.of(ChordSymbol.parse("C"), ChordSymbol.parse("G")), List.of(8, 1));
        assertThat(weights[0]).isEqualTo(8); // C
        assertThat(weights[7]).isEqualTo(9); // G is in both chords
        assertThat(weights[11]).isEqualTo(1); // B only in G
    }

    @Test
    void spellsTheTonicWithTheFewestAccidentals() {
        var result = detect("Db Gb Ab7 Db");
        assertThat(result.best().key()).hasToString("Db major");
    }

    @Test
    void isPerfectlyCorrelatedWithItsOwnProfile() {
        assertThat(KeyDetector.correlate(KeyDetector.MAJOR_PROFILE, KeyDetector.MAJOR_PROFILE, 0)).isCloseTo(1.0,
                org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void rejectsAnEmptyProgression() {
        assertThatThrownBy(() -> KeyDetector.detect(List.of(), List.of())).isInstanceOf(InvalidMusicInputException.class);
    }
}
