package com.harmonylab.music.improvisation;

import com.harmonylab.music.ChordSymbol;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImprovisationGuideTest {

    private static final Key C_MAJOR = Key.of("C", Mode.MAJOR);
    private static final Key A_MINOR = Key.of("A", Mode.MINOR);

    private static Map<String, NoteRole> roles(Key key, String symbol) {
        return ImprovisationGuide.forChord(key, ChordSymbol.parse(symbol)).stream()
                .collect(Collectors.toMap(n -> n.name().toString(), GuideNote::role));
    }

    @Test
    void chordTonesAreStableAndTheRootIsDistinguished() {
        Map<String, NoteRole> cmaj7 = roles(C_MAJOR, "Cmaj7");
        assertThat(cmaj7).containsEntry("C", NoteRole.ROOT).containsEntry("E", NoteRole.CHORD_TONE)
                .containsEntry("G", NoteRole.CHORD_TONE).containsEntry("B", NoteRole.CHORD_TONE);
    }

    @Test
    void avoidNotesAreTensionsAndOtherScaleNotesAreSafe() {
        Map<String, NoteRole> cmaj7 = roles(C_MAJOR, "Cmaj7");
        assertThat(cmaj7).containsEntry("F", NoteRole.TENSION) // a semitone above E
                .containsEntry("D", NoteRole.SCALE).containsEntry("A", NoteRole.SCALE);

        Map<String, NoteRole> dm7 = roles(C_MAJOR, "Dm7"); // dorian: no avoid note
        assertThat(dm7).containsEntry("E", NoteRole.SCALE).containsEntry("G", NoteRole.SCALE).containsEntry("B", NoteRole.SCALE);
    }

    @Test
    void dominantChordsGetAlteredTensions() {
        Map<String, NoteRole> g7 = roles(C_MAJOR, "G7");
        assertThat(g7).containsEntry("C", NoteRole.TENSION)   // avoid: a semitone above B
                .containsEntry("Ab", NoteRole.TENSION)        // b9
                .containsEntry("A#", NoteRole.TENSION)        // #9
                .containsEntry("Eb", NoteRole.TENSION)        // b13 (also the blue b3 of C)
                .containsEntry("A", NoteRole.SCALE)
                .containsEntry("E", NoteRole.SCALE);
    }

    @Test
    void chordScaleAdaptsToNonDiatonicChordTones() {
        assertThat(ImprovisationGuide.chordScale(A_MINOR, ChordSymbol.parse("E7"))).map(Object::toString)
                .containsExactly("A", "B", "C", "D", "E", "F", "G#");
        Map<String, NoteRole> e7 = roles(A_MINOR, "E7");
        assertThat(e7).containsEntry("G#", NoteRole.CHORD_TONE).containsEntry("G", NoteRole.TENSION); // #9
        assertThat(roles(C_MAJOR, "C7")).containsEntry("Bb", NoteRole.CHORD_TONE).doesNotContainKey("B");
    }

    @Test
    void blueNotesDependOnTheMode() {
        Map<String, NoteRole> c = roles(C_MAJOR, "C");
        assertThat(c).containsEntry("Eb", NoteRole.TENSION).containsEntry("Gb", NoteRole.TENSION);
        Map<String, NoteRole> am = roles(A_MINOR, "Am");
        assertThat(am).containsEntry("Eb", NoteRole.TENSION) // b5 of A
                .containsEntry("C", NoteRole.CHORD_TONE)      // b3 is already a chord tone
                .containsEntry("F", NoteRole.TENSION);        // avoid: a semitone above E
    }

    @Test
    void everyPitchClassAppearsAtMostOnceWithAReason() {
        List<GuideNote> notes = ImprovisationGuide.forChord(C_MAJOR, ChordSymbol.parse("G7"));
        assertThat(notes).extracting(GuideNote::pitchClass).doesNotHaveDuplicates();
        assertThat(notes).allSatisfy(n -> assertThat(n.reason()).isNotBlank());
        assertThat(notes.getFirst().role()).isEqualTo(NoteRole.ROOT);
        assertThat(ImprovisationGuide.forChord(C_MAJOR, ChordSymbol.parse("G7"))).isEqualTo(notes);
        assertThatThrownBy(() -> ImprovisationGuide.forChord(C_MAJOR, null)).isInstanceOf(InvalidMusicInputException.class);
    }

    @Test
    void presetsAreRealisedInAnyKeyOfTheirMode() {
        var jazz = ProgressionPresets.realize(ProgressionPresets.byId("jazz-251"), Key.of("Eb", Mode.MAJOR));
        assertThat(jazz).extracting(c -> c.chord().symbol()).containsExactly("Fm7", "Bb7", "Ebmaj7", "Ebmaj7");
        var andalusian = ProgressionPresets.realize(ProgressionPresets.byId("andalusian"), A_MINOR);
        assertThat(andalusian).extracting(c -> c.chord().symbol()).containsExactly("Am", "G", "F", "E");
        assertThat(ProgressionPresets.realize(ProgressionPresets.byId("blues"), C_MAJOR)).hasSize(12);
        assertThat(ProgressionPresets.forMode(Mode.MINOR)).allMatch(p -> p.mode() == Mode.MINOR);
        assertThatThrownBy(() -> ProgressionPresets.realize(ProgressionPresets.byId("pop"), A_MINOR))
                .isInstanceOf(InvalidMusicInputException.class);
        assertThatThrownBy(() -> ProgressionPresets.byId("nope")).isInstanceOf(InvalidMusicInputException.class);
    }
}
