package com.harmonylab.music;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** A key: spelled tonic plus mode. Scale spelling uses one letter per degree (F major has Bb, not A#). */
public record Key(NoteName tonic, Mode mode) {

    public Key {
        if (tonic == null || mode == null) {
            throw new InvalidMusicInputException("A key needs a tonic and a mode");
        }
        int signature = signatureOf(tonic, mode);
        if (Math.abs(signature) > 7) {
            throw new InvalidMusicInputException(tonic + " " + mode.label() + " is a theoretical key ("
                    + Math.abs(signature) + (signature > 0 ? " sharps" : " flats")
                    + "). Use its enharmonic equivalent instead.");
        }
    }

    public static Key of(String tonic, Mode mode) {
        return new Key(NoteName.parse(tonic), mode);
    }

    public List<NoteName> scale() {
        return scaleOf(tonic, mode);
    }

    private static List<NoteName> scaleOf(NoteName tonic, Mode mode) {
        return mode.scaleIntervals().stream().map(tonic::transpose).toList();
    }

    /**
     * Key signature: positive = number of sharps, negative = number of flats. Harmonic and melodic minor use the
     * natural minor's signature (their raised degrees are written as accidentals).
     */
    public int signature() {
        return signatureOf(tonic, mode);
    }

    private static int signatureOf(NoteName tonic, Mode mode) {
        return scaleOf(tonic, mode.signatureMode()).stream().mapToInt(NoteName::accidental).sum();
    }

    public boolean containsPitchClass(int pitchClass) {
        return degreeOf(pitchClass).isPresent();
    }

    /** 1-based scale degree of a pitch class, if it belongs to the scale. */
    public Optional<Integer> degreeOf(int pitchClass) {
        List<NoteName> scale = scale();
        for (int i = 0; i < scale.size(); i++) {
            if (scale.get(i).pitchClass().value() == Math.floorMod(pitchClass, 12)) {
                return Optional.of(i + 1);
            }
        }
        return Optional.empty();
    }

    /** Spells a pitch class: scale spelling when diatonic, otherwise flats in flat keys and sharps elsewhere. */
    public NoteName spell(int pitchClass) {
        int pc = Math.floorMod(pitchClass, 12);
        return scale().stream().filter(n -> n.pitchClass().value() == pc).findFirst()
                .orElseGet(() -> signature() < 0 ? PitchClass.of(pc).spelling(true) : PitchClass.of(pc).defaultSpelling());
    }

    /** True when every pitch class of the chord belongs to the scale. */
    public boolean isDiatonic(Chord chord) {
        return chord.pitchClasses().stream().allMatch(this::containsPitchClass);
    }

    /** Chord tones that are not in the scale, in chord order. */
    public List<NoteName> notesOutsideScale(Chord chord) {
        return chord.tones().stream().filter(t -> !containsPitchClass(t.pitchClass().value())).toList();
    }

    /** Diatonic triad (or seventh chord) built by stacking scale thirds on a degree (1..7). */
    public Chord diatonicChord(int degree, boolean seventh) {
        if (degree < 1 || degree > 7) {
            throw new InvalidMusicInputException("Scale degree must be between 1 and 7");
        }
        List<NoteName> scale = scale();
        NoteName root = scale.get(degree - 1);
        List<Integer> semitones = new ArrayList<>();
        int count = seventh ? 4 : 3;
        for (int i = 0; i < count; i++) {
            NoteName tone = scale.get((degree - 1 + 2 * i) % 7);
            semitones.add(root.pitchClass().semitonesUpTo(tone.pitchClass()));
        }
        ChordQuality quality = ChordQuality.fromSemitones(semitones)
                .orElseThrow(() -> new IllegalStateException("No quality for stacked thirds " + semitones));
        return new Chord(root, quality, 0);
    }

    public List<Chord> diatonicChords(boolean sevenths) {
        List<Chord> chords = new ArrayList<>();
        for (int degree = 1; degree <= 7; degree++) {
            chords.add(diatonicChord(degree, sevenths));
        }
        return chords;
    }

    public Key parallel() {
        return new Key(tonic, mode.parallel());
    }

    public Chord tonicChord() {
        return diatonicChord(1, false);
    }

    @Override
    public String toString() {
        return tonic + " " + mode.label();
    }
}
