package com.harmonylab.music.voiceleading;

import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordQuality;
import com.harmonylab.music.ChordSymbol;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Register;
import com.harmonylab.music.Voicing;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VoiceLeadingTest {

    private static final Voicing C_MAJOR = Voicing.of(60, 64, 67);

    @Test
    void identicalVoicingsHaveZeroMovementAndCost() {
        VoiceLeadingResult result = VoiceLeadingEvaluator.evaluate(C_MAJOR, C_MAJOR);
        assertThat(result.totalMovement()).isZero();
        assertThat(result.cost()).isZero();
        assertThat(result.heldVoices()).isEqualTo(3);
    }

    @Test
    void smallMovementCostsLessThanLargeMovement() {
        VoiceLeadingResult near = VoiceLeadingEvaluator.evaluate(C_MAJOR, Voicing.of(60, 65, 69)); // F/C
        VoiceLeadingResult far = VoiceLeadingEvaluator.evaluate(C_MAJOR, Voicing.of(53, 57, 60)); // F down a fifth
        assertThat(near.totalMovement()).isEqualTo(3);
        assertThat(near.cost()).isEqualTo(3.0);
        assertThat(far.totalMovement()).isEqualTo(21);
        assertThat(far.leaps()).isEqualTo(3);
        assertThat(far.overlaps()).isEqualTo(2);        // E and G move below the old C and E
        assertThat(far.parallelPerfects()).isEqualTo(1); // C-G fifth moves in parallel to F-C
        assertThat(far.cost()).isEqualTo(21 + 3 * 2 + 2 * 3.0 + 2.0);
    }

    @Test
    void largeLeapsCostMoreThanTheirDistance() {
        VoiceLeadingResult leap = VoiceLeadingEvaluator.evaluate(Voicing.of(60), Voicing.of(69));
        assertThat(leap.cost()).isEqualTo(9 + (9 - 5));
    }

    @Test
    void penalisesVoiceCrossingsInAnExplicitAssignment() {
        Voicing from = Voicing.of(60, 64);
        Voicing to = Voicing.of(62, 65);
        VoiceLeadingResult parallelMotion = VoiceLeadingEvaluator.evaluate(from, to);
        VoiceLeadingResult crossed = VoiceLeadingEvaluator.evaluateMotions(from, to,
                List.of(new VoiceMotion(60, 65), new VoiceMotion(64, 62)), VoiceLeadingWeights.DEFAULT);
        assertThat(parallelMotion.crossings()).isZero();
        assertThat(crossed.crossings()).isEqualTo(1);
        assertThat(crossed.cost()).isEqualTo(7 + 4.0 + 3.0); // movement + crossing + overlap
        assertThat(crossed.cost()).isGreaterThan(parallelMotion.cost());
    }

    @Test
    void defaultPairingNeverCrossesVoices() {
        VoiceLeadingResult result = VoiceLeadingEvaluator.evaluate(Voicing.of(48, 60, 64, 67), Voicing.of(50, 53, 59, 65));
        assertThat(result.crossings()).isZero();
        for (int i = 1; i < result.motions().size(); i++) {
            assertThat(result.motions().get(i).to()).isGreaterThanOrEqualTo(result.motions().get(i - 1).to());
        }
    }

    @Test
    void penalisesOverlapsAndParallelPerfectIntervals() {
        VoiceLeadingResult overlap = VoiceLeadingEvaluator.evaluate(Voicing.of(60, 64), Voicing.of(65, 67));
        assertThat(overlap.overlaps()).isEqualTo(1);
        assertThat(overlap.cost()).isEqualTo(8 + 3.0);

        VoiceLeadingResult fifths = VoiceLeadingEvaluator.evaluate(Voicing.of(48, 55), Voicing.of(50, 57));
        assertThat(fifths.parallelPerfects()).isEqualTo(1);
        assertThat(fifths.cost()).isEqualTo(4 + 2.0);

        VoiceLeadingResult contrary = VoiceLeadingEvaluator.evaluate(Voicing.of(48, 55), Voicing.of(50, 54));
        assertThat(contrary.parallelPerfects()).isZero();
    }

    @Test
    void handlesChordsWithDifferentNumbersOfNotes() {
        Voicing g7 = Voicing.of(59, 62, 65, 67);
        VoiceLeadingResult expand = VoiceLeadingEvaluator.evaluate(C_MAJOR, g7);
        assertThat(expand.motions()).hasSize(4);
        assertThat(expand.totalMovement()).isEqualTo(4);
        assertThat(expand.cost()).isEqualTo(4 + 1.0);

        VoiceLeadingResult reduce = VoiceLeadingEvaluator.evaluate(g7, C_MAJOR);
        assertThat(reduce.motions()).hasSize(4);
        assertThat(reduce.totalMovement()).isEqualTo(4);
        assertThat(reduce.motions()).allMatch(m -> g7.notes().contains(m.from()) && C_MAJOR.notes().contains(m.to()));

        VoiceLeadingResult single = VoiceLeadingEvaluator.evaluate(Voicing.of(60), C_MAJOR);
        assertThat(single.totalMovement()).isEqualTo(4 + 7);
    }

    @Test
    void rejectsMissingInput() {
        assertThatThrownBy(() -> VoiceLeadingEvaluator.evaluate(null, C_MAJOR)).isInstanceOf(InvalidMusicInputException.class);
        assertThatThrownBy(() -> VoiceLeadingOptimizer.rank(null, Chord.of("F", ChordQuality.MAJOR), Register.DEFAULT, true, 5))
                .isInstanceOf(InvalidMusicInputException.class);
        assertThatThrownBy(() -> VoiceLeadingOptimizer.rank(C_MAJOR, Chord.of("F", ChordQuality.MAJOR), Register.DEFAULT, true, 0))
                .isInstanceOf(InvalidMusicInputException.class);
    }

    @Test
    void ranksTheCommonToneVoicingFirst() {
        List<RankedVoicing> ranked = VoiceLeadingOptimizer.rank(C_MAJOR, Chord.of("F", ChordQuality.MAJOR), Register.DEFAULT, true, 5);
        assertThat(ranked).hasSize(5);
        assertThat(ranked.getFirst().voicing().notes()).containsExactly(60, 65, 69);
        assertThat(ranked.getFirst().chord().symbol()).isEqualTo("F/C");
        assertThat(ranked.getFirst().reasons()).anyMatch(r -> r.contains("C4"));
        assertThat(ranked).extracting(r -> r.result().cost()).isSorted();
        assertThat(ranked).extracting(RankedVoicing::rank).containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void zeroMovementIsFoundForTheSameChord() {
        RankedVoicing best = VoiceLeadingOptimizer.best(C_MAJOR, Chord.of("C", ChordQuality.MAJOR), Register.DEFAULT, false);
        assertThat(best.voicing()).isEqualTo(C_MAJOR);
        assertThat(best.result().cost()).isZero();
    }

    @Test
    void respectsInversionAndRegisterConstraints() {
        Register narrow = new Register(55, 72);
        List<RankedVoicing> rootPosition = VoiceLeadingOptimizer.rank(C_MAJOR, Chord.of("F", ChordQuality.MAJOR), narrow, false, 50);
        assertThat(rootPosition).isNotEmpty().allSatisfy(r -> {
            assertThat(r.voicing().lowest() % 12).isEqualTo(5);
            assertThat(r.voicing().notes()).allMatch(narrow::contains);
            assertThat(r.chord().inversion()).isZero();
        });
        assertThatThrownBy(() -> VoiceLeadingOptimizer.rank(C_MAJOR, Chord.of("G", ChordQuality.MAJOR), new Register(60, 72), false, 3))
                .isInstanceOf(InvalidMusicInputException.class).hasMessageContaining("No voicing of G");
    }

    @Test
    void rankingIsDeterministic() {
        Chord target = ChordSymbol.parse("Dm7");
        List<RankedVoicing> first = VoiceLeadingOptimizer.rank(C_MAJOR, target, Register.DEFAULT, true, 10);
        List<RankedVoicing> second = VoiceLeadingOptimizer.rank(C_MAJOR, target, Register.DEFAULT, true, 10);
        assertThat(first).isEqualTo(second);
    }

    @Test
    void progressionVoicerIsAtLeastAsGoodAsGreedyChoices() {
        List<Chord> chords = List.of("C", "Am", "F", "G7", "C").stream().map(ChordSymbol::parse).toList();
        OptimizedProgression optimized = ProgressionVoicer.optimize(chords, Register.DEFAULT, true, C_MAJOR);
        assertThat(optimized.voicings().getFirst()).isEqualTo(C_MAJOR);
        assertThat(optimized.voicings()).hasSize(5);
        for (int i = 0; i < chords.size(); i++) {
            assertThat(optimized.voicings().get(i).mismatchWith(optimized.chords().get(i))).isNull();
        }

        double greedy = 0;
        Voicing current = C_MAJOR;
        for (Chord chord : chords.subList(1, chords.size())) {
            RankedVoicing best = VoiceLeadingOptimizer.best(current, chord, Register.DEFAULT, true);
            greedy += best.result().cost();
            current = best.voicing();
        }
        assertThat(optimized.totalCost()).isLessThanOrEqualTo(greedy);
        assertThatThrownBy(() -> ProgressionVoicer.optimize(List.of(), Register.DEFAULT, true, null))
                .isInstanceOf(InvalidMusicInputException.class);
    }
}
