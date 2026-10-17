package com.harmonylab.music;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * A chord as a structured value: spelled root, quality and inversion. Chord symbols are only a
 * textual representation produced and consumed by {@link ChordSymbol}.
 *
 * @param inversion 0 = root position, 1 = first inversion (third in the bass), 2 = second, 3 = third
 */
public record Chord(NoteName root, ChordQuality quality, int inversion) {

    public Chord {
        if (root == null || quality == null) {
            throw new InvalidMusicInputException("A chord needs a root and a quality");
        }
        if (inversion < 0 || inversion >= quality.size()) {
            throw new InvalidMusicInputException("Inversion " + inversion + " is not valid for a "
                    + quality.displayName().toLowerCase() + " (allowed: 0-" + (quality.size() - 1) + ")");
        }
    }

    public static Chord of(String root, ChordQuality quality) {
        return new Chord(NoteName.parse(root), quality, 0);
    }

    /** Chord tones in root-position order, correctly spelled (e.g. Db minor = Db, Fb, Ab). */
    public List<NoteName> tones() {
        return quality.intervals().stream().map(root::transpose).toList();
    }

    /** Chord tones starting from the bass note according to the inversion. */
    public List<NoteName> tonesFromBass() {
        List<NoteName> tones = tones();
        List<NoteName> rotated = new ArrayList<>(tones.subList(inversion, tones.size()));
        rotated.addAll(tones.subList(0, inversion));
        return rotated;
    }

    public NoteName bass() {
        return tones().get(inversion);
    }

    public List<Interval> intervals() {
        return quality.intervals();
    }

    public int size() {
        return quality.size();
    }

    /** Distinct pitch classes (values 0-11), sorted ascending. */
    public Set<Integer> pitchClasses() {
        Set<Integer> result = new TreeSet<>();
        tones().forEach(tone -> result.add(tone.pitchClass().value()));
        return result;
    }

    public boolean containsPitchClass(int pitchClass) {
        return pitchClasses().contains(Math.floorMod(pitchClass, 12));
    }

    /** Spelled chord tone for a pitch class, or null when the pitch class is not a chord tone. */
    public NoteName spellingOf(int pitchClass) {
        int pc = Math.floorMod(pitchClass, 12);
        return tones().stream().filter(t -> t.pitchClass().value() == pc).findFirst().orElse(null);
    }

    public Chord withInversion(int newInversion) {
        return new Chord(root, quality, newInversion);
    }

    /** Inversion whose bass is the given pitch class; throws if it is not a chord tone. */
    public Chord withBassPitchClass(int pitchClass) {
        List<NoteName> tones = tones();
        for (int i = 0; i < tones.size(); i++) {
            if (tones.get(i).pitchClass().value() == Math.floorMod(pitchClass, 12)) {
                return withInversion(i);
            }
        }
        throw new InvalidMusicInputException("Pitch class " + pitchClass + " is not a tone of " + symbol());
    }

    /** Transposes by a spelled interval, keeping quality and inversion (C + M2 = D, not Ebb). */
    public Chord transpose(Interval interval) {
        return new Chord(root.transpose(interval), quality, inversion);
    }

    /** Transposes by semitones (up or down), spelling the new root without key context. */
    public Chord transposeSemitones(int semitones, boolean preferFlats) {
        return new Chord(root.transposeSemitones(semitones, preferFlats), quality, inversion);
    }

    /** Same sounding notes regardless of spelling and inversion. */
    public boolean hasSamePitchClasses(Chord other) {
        return pitchClasses().equals(other.pitchClasses());
    }

    public String symbol() {
        return ChordSymbol.format(this);
    }

    @Override
    public String toString() {
        return symbol();
    }
}
