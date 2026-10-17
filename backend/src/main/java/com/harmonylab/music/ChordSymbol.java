package com.harmonylab.music;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parsing and formatting of chord symbols such as {@code Am}, {@code F#m7b5}, {@code Cmaj7/E}.
 * Slash chords are supported only when the bass is a chord tone (i.e. an inversion).
 */
public final class ChordSymbol {

    private static final Pattern SYMBOL = Pattern.compile("^([A-G](?:##|bb|#|b|♯|♭)?)([^/]*)(?:/([A-Ga-g](?:##|bb|#|b|♯|♭)?))?$");

    private ChordSymbol() {
    }

    public static Chord parse(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            throw new InvalidMusicInputException("Chord symbol is empty");
        }
        String text = symbol.trim();
        Matcher matcher = SYMBOL.matcher(text);
        if (!matcher.matches()) {
            throw new InvalidMusicInputException("Invalid chord symbol '" + text
                    + "'. Start with an uppercase root (A-G), e.g. Am, F#7, Bbmaj7, C/E.");
        }
        NoteName root = NoteName.parse(matcher.group(1));
        String suffix = matcher.group(2);
        ChordQuality quality = ChordQuality.fromSuffix(suffix).orElseThrow(() -> new InvalidMusicInputException(
                "Unsupported chord quality '" + suffix + "' in '" + text + "'. Supported suffixes include: "
                        + "(none), m, dim, aug, sus2, sus4, maj7, m7, 7, m7b5, dim7, 6, m6, add9, madd9."));
        Chord chord = new Chord(root, quality, 0);
        if (matcher.group(3) == null) {
            return chord;
        }
        NoteName bass = NoteName.parse(matcher.group(3));
        for (int i = 0; i < chord.tones().size(); i++) {
            if (chord.tones().get(i).isEnharmonicWith(bass)) {
                return chord.withInversion(i);
            }
        }
        throw new InvalidMusicInputException("Bass note " + bass + " is not a chord tone of " + chord.symbol()
                + ". Slash chords with a non-chord-tone bass are not supported.");
    }

    public static String format(Chord chord) {
        String base = chord.root() + chord.quality().suffix();
        return chord.inversion() == 0 ? base : base + "/" + chord.bass();
    }
}
