package com.harmonylab.music;

import com.harmonylab.music.analysis.ChordCategory;
import com.harmonylab.music.analysis.ChordInterpreter;
import com.harmonylab.music.voiceleading.ProgressionVoicer;
import com.harmonylab.music.voiceleading.VoiceLeadingOptimizer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Extended (9, 11, 13) and altered dominant chords, and four-part voicings with doubled tones. */
class ExtendedChordsTest {

    private static List<String> tones(String symbol) {
        return ChordSymbol.parse(symbol).tones().stream().map(NoteName::toString).toList();
    }

    @ParameterizedTest
    @CsvSource({
            "C9, C E G Bb D",
            "Cmaj9, C E G B D",
            "Dm9, D F A C E",
            "G11, G D F A C",
            "Am11, A C E G B D",
            "G13, G B D F A E",
            "C7b9, C E G Bb Db",
            "C7#9, C E G Bb D#",
            "C7#11, C E G Bb F#",
            "C7b13, C E G Bb Ab",
            "G7alt, G B F Ab A# Eb",
            "Eb9, Eb G Bb Db F",
    })
    void spellsExtensionsAndAlterationsLetterByLetter(String symbol, String expected) {
        assertThat(String.join(" ", tones(symbol))).isEqualTo(expected);
    }

    @Test
    void parsesAliasesAndSlashChordsAndFormatsCanonically() {
        assertThat(ChordSymbol.parse("C7(b9)").quality()).isEqualTo(ChordQuality.DOMINANT7_FLAT9);
        assertThat(ChordSymbol.parse("CM9").quality()).isEqualTo(ChordQuality.MAJOR9);
        Chord inverted = ChordSymbol.parse("G13/F");
        assertThat(inverted.inversion()).isEqualTo(3);
        assertThat(inverted.symbol()).isEqualTo("G13/F");
        assertThat(ChordSymbol.parse("Galt").symbol()).isEqualTo("G7alt");
    }

    @Test
    void writesRomanNumeralsWithTheExtension() {
        Key cMajor = Key.of("C", Mode.MAJOR);
        assertThat(RomanNumeral.of(ChordSymbol.parse("G9"), cMajor).format()).isEqualTo("V9");
        assertThat(RomanNumeral.of(ChordSymbol.parse("Dm9"), cMajor).format()).isEqualTo("ii9");
        assertThat(RomanNumeral.of(ChordSymbol.parse("G11"), cMajor).format()).isEqualTo("V11");
        assertThat(RomanNumeral.of(ChordSymbol.parse("G7b9"), Key.of("C", Mode.MINOR)).format()).isEqualTo("V7b9");
    }

    @Test
    void treatsExtendedDominantsAsDominants() {
        assertThat(ChordQuality.DOMINANT13.isDominantType()).isTrue();
        assertThat(ChordQuality.ALTERED.isDominantType()).isTrue();
        assertThat(ChordQuality.MAJOR9.isDominantType()).isFalse();
        var reading = ChordInterpreter.interpret(Key.of("C", Mode.MAJOR), ChordSymbol.parse("D9"), ChordSymbol.parse("G"));
        assertThat(reading.category()).isEqualTo(ChordCategory.SECONDARY_DOMINANT);
        assertThat(reading.label()).isEqualTo("V7/V");
    }

    @Test
    void identifiesExtendedChordsFromTheirNotes() {
        // C E G Bb D with C in the bass
        var candidates = ChordIdentifier.identify(List.of(48, 52, 55, 58, 62), null);
        assertThat(candidates.getFirst().chord().symbol()).isEqualTo("C9");
    }

    @Test
    void everyStyleProducesTheRightNotesOrSaysItDoesNotFit() {
        for (ChordQuality quality : ChordQuality.values()) {
            for (int inversion = 0; inversion < quality.size(); inversion++) {
                Chord chord = new Chord(NoteName.parse("D"), quality, inversion);
                for (VoicingStyle style : VoicingStyle.values()) {
                    try {
                        Voicing voicing = VoicingGenerator.voice(chord, style, Register.DEFAULT);
                        assertThat(voicing.mismatchWith(chord)).as(chord + " " + style).isNull();
                    } catch (InvalidMusicInputException e) {
                        // wide styles of six-note chords can exceed the register; compact styles must always fit
                        assertThat(style).as(chord + " " + style).isIn(VoicingStyle.OPEN, VoicingStyle.DROP2);
                        assertThat(e.getMessage()).contains("does not fit");
                    }
                }
            }
        }
    }

    @Test
    void fourPartVoicingDoublesTheBassOfTriadsAndKeepsLargerChordsWhole() {
        Voicing c = VoicingGenerator.voice(Chord.of("C", ChordQuality.MAJOR), VoicingStyle.FOUR_PART, Register.DEFAULT);
        assertThat(c.size()).isEqualTo(4);
        assertThat(c.notes().stream().filter(n -> n % 12 == 0)).hasSize(2);
        assertThat(c.notes().get(1) - c.lowest()).as("upper voices sit at least a sixth above the bass").isGreaterThanOrEqualTo(9);
        assertThat(c.mismatchWith(Chord.of("C", ChordQuality.MAJOR))).isNull();

        Chord g7 = ChordSymbol.parse("G7/B");
        Voicing g7Voicing = VoicingGenerator.voice(g7, VoicingStyle.FOUR_PART, Register.DEFAULT);
        assertThat(g7Voicing.size()).isEqualTo(4);
        assertThat(g7Voicing.mismatchWith(g7)).isNull();
    }

    @Test
    void fourVoiceCandidatesDoubleTheRootOfTriadsInADifferentOctave() {
        Chord f = Chord.of("F", ChordQuality.MAJOR);
        List<Voicing> candidates = VoicingGenerator.candidates(f, Register.DEFAULT, false, true);
        assertThat(candidates).isNotEmpty().allSatisfy(v -> {
            assertThat(v.size()).isEqualTo(4);
            assertThat(v.notes().stream().filter(n -> n % 12 == 5)).hasSize(2);
            assertThat(v.mismatchWith(f)).isNull();
        });
        assertThat(candidates).doesNotHaveDuplicates();
        assertThat(VoicingGenerator.candidates(ChordSymbol.parse("G7"), Register.DEFAULT, false, true))
                .allSatisfy(v -> assertThat(v.size()).isEqualTo(4));
    }

    @Test
    void voiceLeadingAndOptimisationCanWriteInFourVoices() {
        Voicing cFourPart = Voicing.of(48, 60, 64, 67);
        var ranked = VoiceLeadingOptimizer.rank(cFourPart, Chord.of("F", ChordQuality.MAJOR), Register.DEFAULT, false, 3, true);
        assertThat(ranked).allSatisfy(r -> assertThat(r.voicing().size()).isEqualTo(4));
        var optimized = ProgressionVoicer.optimize(List.of(Chord.of("C", ChordQuality.MAJOR), Chord.of("F", ChordQuality.MAJOR),
                ChordSymbol.parse("G7"), Chord.of("C", ChordQuality.MAJOR)), Register.DEFAULT, false, null, true);
        assertThat(optimized.voicings()).allSatisfy(v -> assertThat(v.size()).isEqualTo(4));
    }
}
