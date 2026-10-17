package com.harmonylab.api;

import com.harmonylab.api.dto.ChordInput;
import com.harmonylab.api.dto.ChordView;
import com.harmonylab.api.dto.IntervalView;
import com.harmonylab.api.dto.KeyDto;
import com.harmonylab.api.dto.RegisterDto;
import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordQuality;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Mode;
import com.harmonylab.music.NoteName;
import com.harmonylab.music.Register;
import com.harmonylab.music.Voicing;
import com.harmonylab.music.analysis.ProgressionChord;

import java.util.ArrayList;
import java.util.List;

/**
 * Converts API DTOs into domain objects (reporting problems with precise field paths) and domain chords
 * into display-ready views. Kept free of Spring so it can be reused by every controller/service.
 */
public final class DomainMapper {

    private DomainMapper() {
    }

    public static Key toKey(KeyDto dto, String path) {
        if (dto == null) {
            throw FieldValidationException.single(path, "is required");
        }
        try {
            return new Key(NoteName.parse(dto.tonic()), Mode.fromId(dto.mode()));
        } catch (InvalidMusicInputException e) {
            throw FieldValidationException.single(path, e.getMessage());
        }
    }

    public static Register toRegister(RegisterDto dto, String path) {
        if (dto == null) {
            return Register.DEFAULT;
        }
        try {
            return new Register(dto.low(), dto.high());
        } catch (InvalidMusicInputException e) {
            throw FieldValidationException.single(path, e.getMessage());
        }
    }

    public static Chord toChord(ChordInput input, String path) {
        List<FieldValidationException.FieldError> errors = new ArrayList<>();
        Chord chord = toChord(input, path, errors);
        if (!errors.isEmpty()) {
            throw new FieldValidationException(errors);
        }
        return chord;
    }

    private static Chord toChord(ChordInput input, String path, List<FieldValidationException.FieldError> errors) {
        if (input == null) {
            errors.add(new FieldValidationException.FieldError(path, "is required"));
            return null;
        }
        NoteName root = null;
        ChordQuality quality = null;
        try {
            root = NoteName.parse(input.root());
        } catch (InvalidMusicInputException e) {
            errors.add(new FieldValidationException.FieldError(path + ".root", e.getMessage()));
        }
        try {
            quality = ChordQuality.fromId(input.quality());
        } catch (InvalidMusicInputException e) {
            errors.add(new FieldValidationException.FieldError(path + ".quality", e.getMessage()));
        }
        if (root == null || quality == null) {
            return null;
        }
        try {
            return new Chord(root, quality, input.inversionOrDefault());
        } catch (InvalidMusicInputException e) {
            errors.add(new FieldValidationException.FieldError(path + ".inversion", e.getMessage()));
            return null;
        }
    }

    /**
     * Converts a list of chord inputs, collecting every error before failing.
     *
     * @param requireVoicing when true, every chord must carry a voicing that matches it
     */
    public static List<ProgressionChord> toProgression(List<ChordInput> inputs, String path, boolean requireVoicing) {
        List<FieldValidationException.FieldError> errors = new ArrayList<>();
        List<ProgressionChord> result = new ArrayList<>();
        if (inputs == null) {
            throw FieldValidationException.single(path, "is required");
        }
        for (int i = 0; i < inputs.size(); i++) {
            String itemPath = path + "[" + i + "]";
            Chord chord = toChord(inputs.get(i), itemPath, errors);
            if (chord == null) {
                continue;
            }
            Voicing voicing = toVoicing(inputs.get(i).voicing(), chord, itemPath + ".voicing", requireVoicing, errors);
            if (voicing != null || !requireVoicing) {
                result.add(new ProgressionChord(chord, voicing));
            }
        }
        if (!errors.isEmpty()) {
            throw new FieldValidationException(errors);
        }
        return result;
    }

    private static Voicing toVoicing(List<Integer> notes, Chord chord, String path, boolean required,
                                     List<FieldValidationException.FieldError> errors) {
        if (notes == null) {
            if (required) {
                errors.add(new FieldValidationException.FieldError(path, "is required"));
            }
            return null;
        }
        try {
            Voicing voicing = new Voicing(notes);
            String mismatch = voicing.mismatchWith(chord);
            if (mismatch != null) {
                errors.add(new FieldValidationException.FieldError(path, mismatch));
                return null;
            }
            return voicing;
        } catch (InvalidMusicInputException e) {
            errors.add(new FieldValidationException.FieldError(path, e.getMessage()));
            return null;
        }
    }

    public static Voicing toVoicing(List<Integer> notes, String path) {
        if (notes == null) {
            throw FieldValidationException.single(path, "is required");
        }
        try {
            return new Voicing(notes);
        } catch (InvalidMusicInputException e) {
            throw FieldValidationException.single(path, e.getMessage());
        }
    }

    public static ChordView toView(Chord chord, Voicing voicing, Integer durationBeats) {
        List<NoteName> tones = chord.tones();
        List<IntervalView> intervals = new ArrayList<>();
        for (int i = 0; i < tones.size(); i++) {
            var interval = chord.intervals().get(i);
            intervals.add(new IntervalView(tones.get(i).toString(), interval.shortName(), interval.fullName(), interval.semitones()));
        }
        return new ChordView(
                chord.symbol(),
                chord.root().toString(),
                chord.quality().name(),
                chord.quality().displayName(),
                chord.inversion(),
                chord.bass().toString(),
                tones.stream().map(NoteName::toString).toList(),
                chord.tonesFromBass().stream().map(NoteName::toString).toList(),
                List.copyOf(chord.pitchClasses()),
                intervals,
                voicing == null ? null : voicing.notes(),
                voicing == null ? null : voicing.spelledNotes(chord),
                durationBeats);
    }

    public static ChordView toView(ProgressionChord chord) {
        return toView(chord.chord(), chord.voicing(), null);
    }
}
