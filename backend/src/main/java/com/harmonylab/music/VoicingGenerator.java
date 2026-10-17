package com.harmonylab.music;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Produces concrete voicings for chords inside a register. Pure and deterministic. */
public final class VoicingGenerator {

    /** Maximum distance between the lowest and highest note of a generated candidate (two octaves). */
    public static final int MAX_SPAN = 24;
    /** Maximum gap between adjacent upper voices (keeps candidates playable and blended). */
    public static final int MAX_UPPER_GAP = 12;
    /** Maximum gap between the bass and the next voice up. */
    public static final int MAX_BASS_GAP = 19;

    private VoicingGenerator() {
    }

    /**
     * Places the chord in the given style so that its centre is as close as possible to the register's
     * centre. The lowest note is always the chord's bass, so the voicing agrees with the inversion.
     */
    public static Voicing voice(Chord chord, VoicingStyle style, Register register) {
        List<Integer> offsets = switch (style) {
            case CLOSE -> closeOffsets(chord.tonesFromBass());
            case OPEN -> openOffsets(chord.tonesFromBass());
            case DROP2 -> drop2Offsets(chord);
        };
        int top = offsets.stream().max(Integer::compare).orElseThrow();
        int bassPc = chord.bass().pitchClass().value();

        Integer bestBass = null;
        double bestDistance = Double.MAX_VALUE;
        for (int bass = register.low(); bass + top <= register.high(); bass++) {
            if (Math.floorMod(bass, 12) != bassPc) {
                continue;
            }
            double distance = Math.abs(bass + top / 2.0 - register.center());
            if (distance < bestDistance) { // strict '<' keeps the lower placement on ties
                bestDistance = distance;
                bestBass = bass;
            }
        }
        if (bestBass == null) {
            throw new InvalidMusicInputException("A " + style.name().toLowerCase() + " voicing of " + chord.symbol()
                    + " (span " + top + " semitones) does not fit in the selected register");
        }
        int bass = bestBass;
        return new Voicing(offsets.stream().map(o -> bass + o).toList());
    }

    /**
     * Enumerates every voicing that uses each chord tone exactly once, lies within the register and respects
     * the spacing limits ({@link #MAX_SPAN}, {@link #MAX_UPPER_GAP}, {@link #MAX_BASS_GAP}).
     *
     * @param anyInversion when false, only voicings whose lowest note is the chord's bass are returned
     * @return candidates in ascending lexicographic order (deterministic); empty if none fit
     */
    public static List<Voicing> candidates(Chord chord, Register register, boolean anyInversion) {
        List<Integer> pitchClasses = new ArrayList<>(chord.pitchClasses());
        List<List<Integer>> options = new ArrayList<>();
        for (int pc : pitchClasses) {
            List<Integer> placements = new ArrayList<>();
            for (int midi = register.low(); midi <= register.high(); midi++) {
                if (Math.floorMod(midi, 12) == pc) {
                    placements.add(midi);
                }
            }
            options.add(placements);
        }
        int bassPc = chord.bass().pitchClass().value();
        List<Voicing> result = new ArrayList<>();
        collect(options, 0, new ArrayList<>(), result, anyInversion ? -1 : bassPc);
        result.sort(Comparator.comparing(Voicing::notes, VoicingGenerator::compareLexicographically));
        return List.copyOf(result);
    }

    private static void collect(List<List<Integer>> options, int index, List<Integer> chosen,
                                List<Voicing> result, int requiredBassPc) {
        if (index == options.size()) {
            Voicing voicing = new Voicing(chosen);
            if (isAcceptable(voicing, requiredBassPc)) {
                result.add(voicing);
            }
            return;
        }
        for (int midi : options.get(index)) {
            chosen.add(midi);
            collect(options, index + 1, chosen, result, requiredBassPc);
            chosen.removeLast();
        }
    }

    private static boolean isAcceptable(Voicing voicing, int requiredBassPc) {
        if (requiredBassPc >= 0 && Math.floorMod(voicing.lowest(), 12) != requiredBassPc) {
            return false;
        }
        if (voicing.span() > MAX_SPAN) {
            return false;
        }
        List<Integer> notes = voicing.notes();
        for (int i = 1; i < notes.size(); i++) {
            int gap = notes.get(i) - notes.get(i - 1);
            if (gap > (i == 1 ? MAX_BASS_GAP : MAX_UPPER_GAP)) {
                return false;
            }
        }
        return true;
    }

    public static int compareLexicographically(List<Integer> a, List<Integer> b) {
        for (int i = 0; i < Math.min(a.size(), b.size()); i++) {
            int cmp = Integer.compare(a.get(i), b.get(i));
            if (cmp != 0) {
                return cmp;
            }
        }
        return Integer.compare(a.size(), b.size());
    }

    /** Stacks the tones upward, each one at the nearest position above the previous tone. */
    private static List<Integer> closeOffsets(List<NoteName> tonesFromBass) {
        List<Integer> offsets = new ArrayList<>();
        int current = 0;
        int previousPc = tonesFromBass.getFirst().pitchClass().value();
        offsets.add(0);
        for (NoteName tone : tonesFromBass.subList(1, tonesFromBass.size())) {
            int pc = tone.pitchClass().value();
            int step = Math.floorMod(pc - previousPc, 12);
            current += step == 0 ? 12 : step;
            offsets.add(current);
            previousPc = pc;
        }
        return offsets;
    }

    private static List<Integer> openOffsets(List<NoteName> tonesFromBass) {
        List<Integer> close = closeOffsets(tonesFromBass);
        List<Integer> open = new ArrayList<>();
        for (int i = 0; i < close.size(); i++) {
            open.add(i % 2 == 1 ? close.get(i) + 12 : close.get(i));
        }
        open.sort(Integer::compare);
        return open;
    }

    /**
     * Drop-2 with the chord's bass preserved: start a close voicing so that the bass tone is second from the
     * top, then drop that tone an octave so that it becomes the lowest note.
     */
    private static List<Integer> drop2Offsets(Chord chord) {
        List<NoteName> fromBass = chord.tonesFromBass();
        int n = fromBass.size();
        if (n < 3) {
            return closeOffsets(fromBass);
        }
        int start = Math.floorMod(2 - n, n) % n;
        List<NoteName> rotated = new ArrayList<>(fromBass.subList(start, n));
        rotated.addAll(fromBass.subList(0, start));
        List<Integer> close = closeOffsets(rotated);
        List<Integer> dropped = new ArrayList<>(close);
        dropped.set(n - 2, close.get(n - 2) - 12);
        int min = dropped.stream().min(Integer::compare).orElseThrow();
        return dropped.stream().map(o -> o - min).sorted().toList();
    }
}
