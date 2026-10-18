package com.harmonylab.music.improvisation;

import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordQuality;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;

import java.util.List;

import static com.harmonylab.music.ChordQuality.*;

/**
 * Common progressions defined by scale degree and quality, realised in any key of the matching mode
 * (so "ii–V–I" in Eb major spells Fm7–Bb7–Ebmaj7).
 */
public final class ProgressionPresets {

    /** One chord of a preset: 1-based scale degree, quality and length in beats. */
    public record Step(int degree, ChordQuality quality, int beats) {
    }

    public record Preset(String id, String name, Mode mode, String description, List<Step> steps) {
    }

    /** A preset realised in a concrete key. */
    public record RealizedChord(Chord chord, int beats) {
    }

    private static Step s(int degree, ChordQuality quality) {
        return new Step(degree, quality, 4);
    }

    public static final List<Preset> ALL = List.of(
            new Preset("pop", "Pop (I–V–vi–IV)", Mode.MAJOR, "The most common loop in pop music.",
                    List.of(s(1, MAJOR), s(5, MAJOR), s(6, MINOR), s(4, MAJOR))),
            new Preset("fifties", "50s (I–vi–IV–V)", Mode.MAJOR, "Doo-wop progression; ends on the dominant so it loops naturally.",
                    List.of(s(1, MAJOR), s(6, MINOR), s(4, MAJOR), s(5, MAJOR))),
            new Preset("jazz-251", "Jazz ii–V–I", Mode.MAJOR, "The core cadence of jazz harmony, with seventh chords.",
                    List.of(s(2, MINOR7), s(5, DOMINANT7), s(1, MAJOR7), s(1, MAJOR7))),
            new Preset("canon", "Canon (I–V–vi–iii–IV–I–IV–V)", Mode.MAJOR, "Pachelbel's descending bass line.",
                    List.of(s(1, MAJOR), s(5, MAJOR), s(6, MINOR), s(3, MINOR), s(4, MAJOR), s(1, MAJOR), s(4, MAJOR), s(5, MAJOR))),
            new Preset("blues", "12-bar blues", Mode.MAJOR, "Dominant seventh chords on I, IV and V; try the blue notes.",
                    List.of(s(1, DOMINANT7), s(1, DOMINANT7), s(1, DOMINANT7), s(1, DOMINANT7), s(4, DOMINANT7), s(4, DOMINANT7),
                            s(1, DOMINANT7), s(1, DOMINANT7), s(5, DOMINANT7), s(4, DOMINANT7), s(1, DOMINANT7), s(5, DOMINANT7))),
            new Preset("minor-pop", "Minor pop (i–VI–III–VII)", Mode.MINOR, "The minor-key relative of the pop loop.",
                    List.of(s(1, MINOR), s(6, MAJOR), s(3, MAJOR), s(7, MAJOR))),
            new Preset("andalusian", "Andalusian cadence (i–VII–VI–V)", Mode.MINOR, "Descending flamenco progression; V uses the raised leading tone.",
                    List.of(s(1, MINOR), s(7, MAJOR), s(6, MAJOR), s(5, MAJOR))),
            new Preset("minor-251", "Minor ii–V–i", Mode.MINOR, "Half-diminished ii and dominant V resolving to the minor tonic.",
                    List.of(s(2, HALF_DIMINISHED7), s(5, DOMINANT7), s(1, MINOR7), s(1, MINOR7))),
            new Preset("minor-blues", "Minor blues", Mode.MINOR, "12 bars in minor: i7, iv7, VI7 and V7.",
                    List.of(s(1, MINOR7), s(1, MINOR7), s(1, MINOR7), s(1, MINOR7), s(4, MINOR7), s(4, MINOR7),
                            s(1, MINOR7), s(1, MINOR7), s(6, DOMINANT7), s(5, DOMINANT7), s(1, MINOR7), s(5, DOMINANT7))),
            new Preset("dorian-vamp", "Dorian vamp (i7–IV7)", Mode.DORIAN, "The major IV with a minor tonic is the Dorian sound (\"Oye Como Va\").",
                    List.of(s(1, MINOR7), s(4, DOMINANT7))),
            new Preset("phrygian-vamp", "Phrygian vamp (i–♭II)", Mode.PHRYGIAN, "The half-step ♭II above the tonic gives Phrygian its Spanish colour.",
                    List.of(s(1, MINOR), s(2, MAJOR))),
            new Preset("lydian-vamp", "Lydian vamp (Imaj7–II)", Mode.LYDIAN, "The major II carries the raised fourth, Lydian's bright note.",
                    List.of(s(1, MAJOR7), s(2, MAJOR))),
            new Preset("mixolydian-rock", "Mixolydian rock (I–♭VII–IV–I)", Mode.MIXOLYDIAN, "The ♭VII chord avoids the leading tone, as in many rock songs.",
                    List.of(s(1, MAJOR), s(7, MAJOR), s(4, MAJOR), s(1, MAJOR))),
            new Preset("locrian-vamp", "Locrian vamp (iø7–♭IImaj7)", Mode.LOCRIAN, "An unstable tonic over a diminished fifth: Locrian's tense colour.",
                    List.of(s(1, HALF_DIMINISHED7), s(2, MAJOR7))));

    private ProgressionPresets() {
    }

    /** Harmonic and melodic minor keys use the minor-key presets (written with their own accidentals). */
    public static List<Preset> forMode(Mode mode) {
        return ALL.stream().filter(p -> p.mode() == mode.signatureMode()).toList();
    }

    public static Preset byId(String id) {
        return ALL.stream().filter(p -> p.id().equals(id)).findFirst()
                .orElseThrow(() -> new InvalidMusicInputException("Unknown preset '" + id + "'"));
    }

    public static List<RealizedChord> realize(Preset preset, Key key) {
        if (preset.mode() != key.mode().signatureMode()) {
            throw new InvalidMusicInputException(preset.name() + " is a " + preset.mode().label() + " progression");
        }
        // Degrees are read in the preset's own scale (natural minor for minor presets), so VII stays the subtonic.
        Key scaleKey = new Key(key.tonic(), preset.mode());
        return preset.steps().stream()
                .map(step -> new RealizedChord(new Chord(scaleKey.scale().get(step.degree() - 1), step.quality(), 0), step.beats()))
                .toList();
    }
}
