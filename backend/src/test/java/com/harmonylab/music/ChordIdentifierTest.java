package com.harmonylab.music;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChordIdentifierTest {

    @Test
    void identifiesRootPositionTriad() {
        List<ChordCandidate> result = ChordIdentifier.identify(List.of(60, 64, 67), null);
        assertThat(result).hasSize(1);
        assertThat(result.getFirst().chord().symbol()).isEqualTo("C");
        assertThat(result.getFirst().rootPosition()).isTrue();
    }

    @Test
    void identifiesInversionFromTheLowestNote() {
        List<ChordCandidate> result = ChordIdentifier.identify(List.of(64, 67, 72), null);
        assertThat(result.getFirst().chord().symbol()).isEqualTo("C/E");
        assertThat(result.getFirst().chord().inversion()).isEqualTo(1);
    }

    @Test
    void reportsAllInterpretationsOfAmbiguousSetsInDeterministicOrder() {
        // C E G A: C6 or Am7. The bass decides which is listed first.
        List<String> withCBass = ChordIdentifier.identify(List.of(48, 64, 67, 69), null).stream()
                .map(c -> c.chord().symbol()).toList();
        List<String> withABass = ChordIdentifier.identify(List.of(45, 60, 64, 67), null).stream()
                .map(c -> c.chord().symbol()).toList();
        List<String> withEBass = ChordIdentifier.identify(List.of(52, 57, 60, 67), null).stream()
                .map(c -> c.chord().symbol()).toList();
        assertThat(withCBass).containsExactly("C6", "Am7/C");
        assertThat(withABass).containsExactly("Am7", "C6/A");
        assertThat(withEBass).containsExactly("Am7/E", "C6/E"); // seventh chords outrank sixth chords
    }

    @Test
    void symmetricChordsHaveSeveralRoots() {
        List<ChordCandidate> augmented = ChordIdentifier.identify(List.of(60, 64, 68), null);
        assertThat(augmented).hasSize(3);
        assertThat(augmented.getFirst().chord().symbol()).isEqualTo("Caug");
    }

    @Test
    void usesKeyContextForSpelling() {
        Key aFlatMajor = Key.of("Ab", Mode.MAJOR);
        List<ChordCandidate> result = ChordIdentifier.identify(List.of(61, 65, 68), aFlatMajor);
        assertThat(result.getFirst().chord().symbol()).isEqualTo("Db");
        assertThat(ChordIdentifier.identify(List.of(61, 65, 68), null).getFirst().chord().symbol()).isEqualTo("C#");
    }

    @Test
    void returnsEmptyListWhenNothingMatchesAndRejectsEmptyInput() {
        assertThat(ChordIdentifier.identify(List.of(60, 61, 62), null)).isEmpty();
        assertThatThrownBy(() -> ChordIdentifier.identify(List.of(), null)).isInstanceOf(InvalidMusicInputException.class);
    }
}
