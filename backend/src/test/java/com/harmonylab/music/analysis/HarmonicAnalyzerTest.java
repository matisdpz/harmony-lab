package com.harmonylab.music.analysis;

import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordSymbol;
import com.harmonylab.music.HarmonicFunction;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;
import com.harmonylab.music.Register;
import com.harmonylab.music.Voicing;
import com.harmonylab.music.VoicingGenerator;
import com.harmonylab.music.VoicingStyle;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HarmonicAnalyzerTest {

    private static final Key C_MAJOR = Key.of("C", Mode.MAJOR);
    private static final Key A_MINOR = Key.of("A", Mode.MINOR);

    private static List<ProgressionChord> voiced(String... symbols) {
        return Stream.of(symbols).map(ChordSymbol::parse)
                .map(c -> new ProgressionChord(c, VoicingGenerator.voice(c, VoicingStyle.CLOSE, Register.DEFAULT)))
                .toList();
    }

    private static List<String> labels(ProgressionAnalysis analysis) {
        return analysis.chords().stream().map(ChordInterpretation::label).toList();
    }

    @Test
    void labelsTheSameChordsDifferentlyDependingOnTheKey() {
        ProgressionAnalysis inC = HarmonicAnalyzer.analyze(C_MAJOR, voiced("C", "Am", "F", "G"));
        ProgressionAnalysis inA = HarmonicAnalyzer.analyze(A_MINOR, voiced("C", "Am", "F", "G"));
        assertThat(labels(inC)).containsExactly("I", "vi", "IV", "V");
        assertThat(labels(inA)).containsExactly("III", "i", "VI", "VII");
        assertThat(inC.chords()).allMatch(ChordInterpretation::isDiatonic);
        assertThat(inC.chords().get(3).function()).isEqualTo(HarmonicFunction.DOMINANT);
        assertThat(inA.chords().get(1).function()).isEqualTo(HarmonicFunction.TONIC);
    }

    @Test
    void recognisesHarmonicMinorDominants() {
        ProgressionAnalysis analysis = HarmonicAnalyzer.analyze(A_MINOR, voiced("Am", "Dm", "E7", "Am"));
        ChordInterpretation e7 = analysis.chords().get(2);
        assertThat(e7.category()).isEqualTo(ChordCategory.HARMONIC_MINOR);
        assertThat(e7.label()).isEqualTo("V7");
        assertThat(e7.notesOutsideScale()).map(Object::toString).containsExactly("G#");
        assertThat(e7.function()).isEqualTo(HarmonicFunction.DOMINANT);
        assertThat(analysis.metrics().cadence()).isEqualTo("authentic cadence (V → I)");
    }

    @Test
    void recognisesSecondaryDominantsAndWhetherTheyResolve() {
        ProgressionAnalysis resolving = HarmonicAnalyzer.analyze(C_MAJOR, voiced("C", "A7", "Dm", "G7", "C"));
        ChordInterpretation a7 = resolving.chords().get(1);
        assertThat(a7.category()).isEqualTo(ChordCategory.SECONDARY_DOMINANT);
        assertThat(a7.label()).isEqualTo("V7/ii");
        assertThat(a7.functionConfident()).isTrue();
        assertThat(resolving.transitions().get(1).functionalLabel()).contains("secondary dominant");

        ProgressionAnalysis unresolved = HarmonicAnalyzer.analyze(C_MAJOR, voiced("C", "A7", "F"));
        assertThat(unresolved.chords().get(1).functionConfident()).isFalse();
        assertThat(unresolved.observations()).anyMatch(o -> o.kind() == Observation.Kind.HEURISTIC
                && o.message().contains("does not move to its target"));
    }

    @Test
    void recognisesBorrowedAndChromaticChords() {
        ProgressionAnalysis analysis = HarmonicAnalyzer.analyze(C_MAJOR, voiced("C", "Ab", "Fm", "F#", "C"));
        assertThat(analysis.chords().get(1).category()).isEqualTo(ChordCategory.BORROWED);
        assertThat(analysis.chords().get(1).label()).isEqualTo("bVI");
        assertThat(analysis.chords().get(2).category()).isEqualTo(ChordCategory.BORROWED);
        assertThat(analysis.chords().get(2).label()).isEqualTo("iv");
        ChordInterpretation fSharp = analysis.chords().get(3);
        assertThat(fSharp.category()).isEqualTo(ChordCategory.CHROMATIC);
        assertThat(fSharp.function()).isNull();
        assertThat(analysis.metrics().diatonicCount()).isEqualTo(2);
    }

    @Test
    void detectsCadences() {
        assertThat(HarmonicAnalyzer.analyze(C_MAJOR, voiced("Am", "F", "C", "G")).metrics().cadence())
                .isEqualTo("half cadence (ends on V)");
        assertThat(HarmonicAnalyzer.analyze(C_MAJOR, voiced("C", "F", "C")).metrics().cadence())
                .isEqualTo("plagal cadence (IV → I)");
        assertThat(HarmonicAnalyzer.analyze(C_MAJOR, voiced("C", "G7", "Am")).metrics().cadence())
                .isEqualTo("deceptive cadence (V → vi)");
        assertThat(HarmonicAnalyzer.analyze(C_MAJOR, voiced("C", "Dm", "Em")).metrics().cadence()).isNull();
    }

    @Test
    void observationsAreDerivedFromTheInput() {
        ProgressionAnalysis four = HarmonicAnalyzer.analyze(C_MAJOR, voiced("Am", "F", "C", "G"));
        ProgressionAnalysis three = HarmonicAnalyzer.analyze(C_MAJOR, voiced("C", "E", "Am"));
        assertThat(four.observations()).anyMatch(o -> o.message().startsWith("The progression contains 4 chords"));
        assertThat(three.observations()).anyMatch(o -> o.message().startsWith("The progression contains 3 chords"));
        assertThat(three.observations()).anyMatch(o -> o.kind() == Observation.Kind.FACT
                && o.severity() == Observation.Severity.WARNING && o.message().contains("G#"));
        assertThat(four.summary()).contains("vi – IV – I – V");
    }

    @Test
    void measuresVoiceLeadingBetweenActualVoicings() {
        Chord c = ChordSymbol.parse("C");
        Chord am = ChordSymbol.parse("Am/C");
        ProgressionAnalysis analysis = HarmonicAnalyzer.analyze(C_MAJOR, List.of(
                new ProgressionChord(c, Voicing.of(60, 64, 67)), new ProgressionChord(am, Voicing.of(60, 64, 69))));
        TransitionAnalysis transition = analysis.transitions().getFirst();
        assertThat(transition.voiceLeading().totalMovement()).isEqualTo(2);
        assertThat(transition.commonTones()).containsExactly("C", "E");
        assertThat(transition.rootMotion()).isEqualTo("descending minor third");
        assertThat(analysis.metrics().totalVoiceMovement()).isEqualTo(2);
        assertThat(analysis.metrics().heldVoices()).isEqualTo(2);
    }

    @Test
    void parallelFifthsProduceAHeuristicWarning() {
        ProgressionAnalysis analysis = HarmonicAnalyzer.analyze(C_MAJOR, List.of(
                new ProgressionChord(ChordSymbol.parse("C"), Voicing.of(48, 55, 64)),
                new ProgressionChord(ChordSymbol.parse("Dm"), Voicing.of(50, 57, 65))));
        assertThat(analysis.observations()).anyMatch(o -> o.kind() == Observation.Kind.HEURISTIC
                && o.severity() == Observation.Severity.WARNING && o.message().contains("parallel fifths"));
    }

    @Test
    void rejectsEmptyProgressionsAndMismatchedVoicings() {
        assertThatThrownBy(() -> HarmonicAnalyzer.analyze(C_MAJOR, List.of()))
                .isInstanceOf(InvalidMusicInputException.class).hasMessageContaining("empty");
        assertThatThrownBy(() -> new ProgressionChord(ChordSymbol.parse("C"), Voicing.of(60, 63, 67)))
                .isInstanceOf(InvalidMusicInputException.class);
    }
}
