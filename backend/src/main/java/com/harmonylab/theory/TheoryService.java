package com.harmonylab.theory;

import com.harmonylab.api.DomainMapper;
import com.harmonylab.api.FieldValidationException;
import com.harmonylab.api.dto.ChordInput;
import com.harmonylab.api.dto.ChordView;
import com.harmonylab.api.dto.RegisterDto;
import com.harmonylab.music.Chord;
import com.harmonylab.music.ChordCandidate;
import com.harmonylab.music.ChordIdentifier;
import com.harmonylab.music.ChordQuality;
import com.harmonylab.music.ChordSymbol;
import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.music.Key;
import com.harmonylab.music.Transposer;
import com.harmonylab.music.analysis.KeyDetector;
import com.harmonylab.api.dto.KeyDto;
import com.harmonylab.music.Mode;
import com.harmonylab.music.Note;
import com.harmonylab.music.NoteName;
import com.harmonylab.music.Register;
import com.harmonylab.music.Voicing;
import com.harmonylab.music.VoicingGenerator;
import com.harmonylab.music.VoicingStyle;
import com.harmonylab.music.analysis.ChordInterpretation;
import com.harmonylab.music.improvisation.ImprovisationGuide;
import com.harmonylab.music.improvisation.ProgressionPresets;
import com.harmonylab.music.analysis.ChordInterpreter;
import com.harmonylab.music.analysis.HarmonicAnalyzer;
import com.harmonylab.music.analysis.ProgressionAnalysis;
import com.harmonylab.music.analysis.ProgressionChord;
import com.harmonylab.music.analysis.ProgressionMetrics;
import com.harmonylab.music.analysis.TransitionAnalysis;
import com.harmonylab.music.suggestion.AlternativeGenerator;
import com.harmonylab.music.suggestion.Objective;
import com.harmonylab.music.suggestion.ProgressionAlternative;
import com.harmonylab.music.suggestion.SuggestionEngine;
import com.harmonylab.music.suggestion.SuggestionResult;
import com.harmonylab.music.voiceleading.OptimizedProgression;
import com.harmonylab.music.voiceleading.ProgressionVoicer;
import com.harmonylab.music.voiceleading.RankedVoicing;
import com.harmonylab.music.voiceleading.VoiceLeadingExplainer;
import com.harmonylab.music.voiceleading.VoiceLeadingOptimizer;
import com.harmonylab.music.voiceleading.VoiceLeadingResult;
import com.harmonylab.theory.TheoryDtos.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Application service for the stateless theory endpoints: converts DTOs to domain objects, calls the
 * pure music engine and converts the results back. No business rules live here.
 */
@Service
public class TheoryService {

    static final List<String> ROOTS = List.of("C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B");
    private static final List<String> MAJOR_TONICS =
            List.of("C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb");
    private static final List<String> MINOR_TONICS =
            List.of("A", "E", "B", "F#", "C#", "G#", "D#", "A#", "D", "G", "C", "F", "Bb", "Eb", "Ab");
    /**
     * Tonics with a real key signature (at most 7 sharps or flats), per mode, in circle-of-fifths order. A mode of the
     * major scale shares its signature with the major key it comes from (D Dorian has C major's), so its tonics are
     * that degree of each major key; harmonic and melodic minor use the natural minor's tonics.
     */
    static final Map<String, List<String>> KEY_TONICS = keyTonics();

    private static Map<String, List<String>> keyTonics() {
        Map<String, List<String>> result = new java.util.LinkedHashMap<>();
        for (Mode mode : Mode.values()) {
            List<String> tonics;
            if (mode == Mode.MAJOR) {
                tonics = MAJOR_TONICS;
            } else if (mode.signatureMode() == Mode.MINOR) {
                tonics = MINOR_TONICS;
            } else {
                tonics = MAJOR_TONICS.stream()
                        .map(t -> Key.of(t, Mode.MAJOR).scale().get(mode.majorScaleDegree() - 1).toString())
                        .toList();
            }
            result.put(mode.name(), tonics);
        }
        return java.util.Collections.unmodifiableMap(result);
    }
    static final String COST_FUNCTION = "cost = Σ|movement| + Σ max(0, |movement| − 5) + 4·crossings + 3·overlaps"
            + " + 2·parallel fifths/octaves + 1·|voice count change|  (hand-tuned heuristic weights)";

    public CatalogResponse catalog() {
        List<QualityInfo> qualities = Arrays.stream(ChordQuality.values())
                .map(q -> new QualityInfo(q.name(), q.displayName(), q.suffix(), q.family().name(),
                        q.intervals().stream().map(i -> i.shortName()).toList(), q.size()))
                .toList();
        List<ObjectiveInfo> objectives = Arrays.stream(Objective.values())
                .map(o -> new ObjectiveInfo(o.name(), o.label(), o.description())).toList();
        return new CatalogResponse(qualities, ROOTS, KEY_TONICS, objectives,
                Arrays.stream(VoicingStyle.values()).map(Enum::name).toList(),
                new RegisterDto(Register.DEFAULT.low(), Register.DEFAULT.high()),
                "Scientific pitch notation: middle C = C4 = MIDI 60, A4 = MIDI 69");
    }

    public ChordDetailsResponse resolve(ChordResolveRequest request) {
        Chord chord = DomainMapper.toChord(new ChordInput(request.root(), request.quality(), request.inversion(), null, null), "chord");
        return details(chord, request.style(), request.register(), request.previousVoicing(), request.key());
    }

    public ChordDetailsResponse parse(ChordParseRequest request) {
        Chord chord;
        try {
            chord = ChordSymbol.parse(request.symbol());
        } catch (InvalidMusicInputException e) {
            throw FieldValidationException.single("symbol", e.getMessage());
        }
        return details(chord, request.style(), request.register(), request.previousVoicing(), request.key());
    }

    private ChordDetailsResponse details(Chord chord, String styleId, RegisterDto registerDto,
                                         List<Integer> previousVoicing, com.harmonylab.api.dto.KeyDto keyDto) {
        Register register = DomainMapper.toRegister(registerDto, "register");
        VoicingStyle style = parseStyle(styleId);
        Voicing voicing;
        if (style == null && previousVoicing != null) {
            Voicing previous = DomainMapper.toVoicing(previousVoicing, "previousVoicing");
            voicing = VoiceLeadingOptimizer.best(previous, chord, register, false).voicing();
        } else {
            voicing = VoicingGenerator.voice(chord, style == null ? VoicingStyle.CLOSE : style, register);
        }
        List<ChordView> inversions = new ArrayList<>();
        for (int i = 0; i < chord.size(); i++) {
            Chord inverted = chord.withInversion(i);
            inversions.add(DomainMapper.toView(inverted, VoicingGenerator.voice(inverted, VoicingStyle.CLOSE, register), null));
        }
        InterpretationView relation = null;
        if (keyDto != null) {
            Key key = DomainMapper.toKey(keyDto, "key");
            relation = toView(ChordInterpreter.interpret(key, chord, null));
        }
        return new ChordDetailsResponse(DomainMapper.toView(chord, voicing, null), inversions, relation);
    }

    public IdentifyResponse identify(IdentifyRequest request) {
        Key key = request.key() == null ? null : DomainMapper.toKey(request.key(), "key");
        List<ChordCandidate> candidates = ChordIdentifier.identify(request.midiNotes(), key);
        Voicing voicing = new Voicing(request.midiNotes().stream().distinct().toList());
        List<IdentifiedChord> views = candidates.stream()
                .map(c -> new IdentifiedChord(DomainMapper.toView(c.chord(), voicing, null), c.rootPosition(), c.explanation()))
                .toList();
        String notes = String.join(" ", voicing.notes().stream().map(n -> Note.fromMidi(n).toString()).toList());
        String message = views.isEmpty()
                ? "No supported chord contains exactly these pitch classes (" + notes + "). Identification only finds exact matches."
                : views.size() == 1 ? "One interpretation of " + notes + "."
                : views.size() + " interpretations of " + notes + " — note sets can be ambiguous; root-position readings are listed first.";
        return new IdentifyResponse(views, message);
    }

    public KeyView key(String tonic, String mode) {
        Key key;
        try {
            key = new Key(NoteName.parse(tonic), Mode.fromId(mode));
        } catch (InvalidMusicInputException e) {
            throw FieldValidationException.single("key", e.getMessage());
        }
        int signature = key.signature();
        String signatureText = signature == 0 ? "no sharps or flats"
                : Math.abs(signature) + (signature > 0 ? " sharp" : " flat") + (Math.abs(signature) > 1 ? "s" : "");
        return new KeyView(key.tonic().toString(), key.mode().name(), key.toString(),
                key.scale().stream().map(NoteName::toString).toList(), signature, signatureText,
                diatonic(key, false), diatonic(key, true));
    }

    private List<DiatonicChordView> diatonic(Key key, boolean sevenths) {
        List<DiatonicChordView> result = new ArrayList<>();
        for (int degree = 1; degree <= 7; degree++) {
            Chord chord = key.diatonicChord(degree, sevenths);
            ChordInterpretation interpretation = ChordInterpreter.interpret(key, chord, null);
            result.add(new DiatonicChordView(degree, interpretation.label(),
                    interpretation.function() == null ? null : interpretation.function().name(),
                    DomainMapper.toView(chord, null, null)));
        }
        return result;
    }

    public TransposeResponse transpose(TransposeRequest request) {
        Key key = DomainMapper.toKey(request.key(), "key");
        List<ProgressionChord> progression = DomainMapper.toProgression(request.chords(), "chords", false);
        Transposer.Result result = Transposer.transpose(key, progression.stream().map(ProgressionChord::chord).toList(),
                progression.stream().map(ProgressionChord::voicing).toList(), request.semitones());
        List<ChordView> chords = new ArrayList<>();
        for (int i = 0; i < result.chords().size(); i++) {
            chords.add(DomainMapper.toView(result.chords().get(i), result.voicings().get(i),
                    request.chords().get(i).durationOrDefault(), request.chords().get(i).pattern()));
        }
        return new TransposeResponse(new KeyDto(result.key().tonic().toString(), result.key().mode().name()),
                result.key().toString(), chords);
    }

    public KeyDetectionResponse detectKey(KeyDetectionRequest request) {
        List<ProgressionChord> progression = DomainMapper.toProgression(request.chords(), "chords", false);
        KeyDetector.Result result = KeyDetector.detect(progression.stream().map(ProgressionChord::chord).toList(),
                request.chords().stream().map(ChordInput::durationOrDefault).toList());
        List<KeyCandidateView> candidates = result.candidates().stream()
                .map(c -> new KeyCandidateView(new KeyDto(c.key().tonic().toString(), c.key().mode().name()), c.key().toString(),
                        Math.round(c.correlation() * 100) / 100.0)) // same rounding as the explanation
                .toList();
        return new KeyDetectionResponse(candidates, result.confidence().name(), result.explanation());
    }

    public AnalysisResponse analyze(ProgressionRequest request) {
        Key key = DomainMapper.toKey(request.key(), "key");
        List<ProgressionChord> progression = DomainMapper.toProgression(request.chords(), "chords", false);
        ProgressionAnalysis analysis = HarmonicAnalyzer.analyze(key, progression);
        return toView(analysis);
    }

    public VoiceLeadingResponse voiceLeading(VoiceLeadingRequest request) {
        Voicing from = DomainMapper.toVoicing(request.fromVoicing(), "fromVoicing");
        Chord fromChord = request.fromChord() == null ? null : DomainMapper.toChord(request.fromChord(), "fromChord");
        Chord target = DomainMapper.toChord(request.target(), "target");
        Register register = DomainMapper.toRegister(request.register(), "register");
        List<RankedVoicing> ranked = VoiceLeadingOptimizer.rank(from, target, register,
                request.allowInversions() == null || request.allowInversions(),
                request.limit() == null ? 8 : request.limit(),
                Boolean.TRUE.equals(request.fourVoices()));
        List<RankedVoicingView> views = ranked.stream()
                .map(r -> new RankedVoicingView(r.rank(), DomainMapper.toView(r.chord(), r.voicing(), null),
                        toView(r.result(), fromChord, r.chord()), r.reasons()))
                .toList();
        return new VoiceLeadingResponse(views, COST_FUNCTION);
    }

    public OptimizeResponse optimize(OptimizeRequest request) {
        List<ProgressionChord> progression = DomainMapper.toProgression(request.chords(), "chords", false);
        Register register = DomainMapper.toRegister(request.register(), "register");
        boolean keepFirst = request.keepFirstVoicing() == null || request.keepFirstVoicing();
        Voicing first = keepFirst ? progression.getFirst().voicing() : null;
        OptimizedProgression optimized = ProgressionVoicer.optimize(
                progression.stream().map(ProgressionChord::chord).toList(), register,
                request.allowInversions() == null || request.allowInversions(), first,
                Boolean.TRUE.equals(request.fourVoices()));
        List<ChordView> chords = new ArrayList<>();
        for (int i = 0; i < optimized.chords().size(); i++) {
            chords.add(DomainMapper.toView(optimized.chords().get(i), optimized.voicings().get(i),
                    request.chords().get(i).durationOrDefault()));
        }
        return new OptimizeResponse(chords, optimized.totalMovement(), Math.round(optimized.totalCost() * 10) / 10.0);
    }

    public SuggestionResponse suggest(SuggestionRequest request) {
        Key key = DomainMapper.toKey(request.key(), "key");
        List<ProgressionChord> progression = DomainMapper.toProgression(request.chords(), "chords", false);
        if (request.selectedIndex() >= progression.size()) {
            throw FieldValidationException.single("selectedIndex", "must refer to a chord in the progression");
        }
        Objective objective = Objective.fromId(request.objective());
        SuggestionResult result = SuggestionEngine.suggest(key, progression, request.selectedIndex(), objective,
                DomainMapper.toRegister(request.register(), "register"), request.limit() == null ? 8 : request.limit());
        List<SuggestionView> suggestions = result.suggestions().stream()
                .map(s -> new SuggestionView(DomainMapper.toView(s.chord(), s.voicing(), null), s.romanLabel(),
                        s.category().name(), s.source().name(), s.score(), s.breakdown(), s.reasons()))
                .toList();
        return new SuggestionResponse(objective.name(), objective.label(), result.message(), suggestions);
    }

    public AlternativesResponse alternatives(ProgressionRequest request) {
        Key key = DomainMapper.toKey(request.key(), "key");
        List<ProgressionChord> progression = withDefaultVoicings(
                DomainMapper.toProgression(request.chords(), "chords", false),
                DomainMapper.toRegister(request.register(), "register"));
        Register register = DomainMapper.toRegister(request.register(), "register");
        ProgressionMetrics current = HarmonicAnalyzer.analyze(key, progression).metrics();
        List<AlternativeView> views = new ArrayList<>();
        for (ProgressionAlternative alternative : AlternativeGenerator.generate(key, progression, register)) {
            List<ChordView> chords = new ArrayList<>();
            for (int i = 0; i < alternative.chords().size(); i++) {
                ProgressionChord pc = alternative.chords().get(i);
                chords.add(DomainMapper.toView(pc.chord(), pc.voicing(), request.chords().get(i).durationOrDefault()));
            }
            views.add(new AlternativeView(alternative.title(),
                    alternative.objective() == null ? null : alternative.objective().name(), alternative.description(),
                    alternative.changedIndex(), chords, toView(HarmonicAnalyzer.analyze(key, alternative.chords()).metrics())));
        }
        return new AlternativesResponse(toView(current), views);
    }

    private static List<ProgressionChord> withDefaultVoicings(List<ProgressionChord> progression, Register register) {
        return progression.stream()
                .map(pc -> pc.voicing() != null ? pc
                        : new ProgressionChord(pc.chord(), VoicingGenerator.voice(pc.chord(), VoicingStyle.CLOSE, register)))
                .toList();
    }

    private static VoicingStyle parseStyle(String style) {
        if (style == null || style.isBlank()) {
            return null;
        }
        try {
            return VoicingStyle.valueOf(style.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw FieldValidationException.single("style", "must be one of CLOSE, OPEN, DROP2");
        }
    }

    // ---- improvisation ------------------------------------------------------------------------------

    static final String GUIDE_LEGEND = "Chord tones are the most stable targets, scale notes are safe for simple lines, "
            + "and tensions (avoid notes, altered dominant notes, blue notes) are expressive but should resolve. "
            + "These are stylistic conventions, not rules.";

    public List<PresetView> presets(String tonic, String mode) {
        Key key;
        try {
            key = new Key(NoteName.parse(tonic), Mode.fromId(mode));
        } catch (InvalidMusicInputException e) {
            throw FieldValidationException.single("key", e.getMessage());
        }
        List<PresetView> result = new ArrayList<>();
        for (ProgressionPresets.Preset preset : ProgressionPresets.forMode(key.mode())) {
            List<ProgressionPresets.RealizedChord> realized = ProgressionPresets.realize(preset, key);
            List<ChordView> chords = voiced(realized.stream().map(ProgressionPresets.RealizedChord::chord).toList(),
                    realized.stream().map(ProgressionPresets.RealizedChord::beats).toList(), Register.DEFAULT);
            result.add(new PresetView(preset.id(), preset.name(), preset.description(), preset.mode().name(), chords));
        }
        return result;
    }

    public ImprovisationResponse improvisation(ImprovisationRequest request) {
        Key key = DomainMapper.toKey(request.key(), "key");
        Register register = DomainMapper.toRegister(request.register(), "register");
        int defaultBeats = request.beatsPerChord() == null ? 4 : request.beatsPerChord();
        List<Chord> chords = new ArrayList<>();
        List<Integer> beats = new ArrayList<>();
        List<Voicing> givenVoicings = new ArrayList<>();
        if (request.symbols() != null && !request.symbols().isEmpty()) {
            List<FieldValidationException.FieldError> errors = new ArrayList<>();
            for (int i = 0; i < request.symbols().size(); i++) {
                try {
                    chords.add(ChordSymbol.parse(request.symbols().get(i)));
                    beats.add(defaultBeats);
                } catch (InvalidMusicInputException e) {
                    errors.add(new FieldValidationException.FieldError("symbols[" + i + "]", e.getMessage()));
                }
            }
            if (!errors.isEmpty()) {
                throw new FieldValidationException(errors);
            }
        } else if (request.chords() != null && !request.chords().isEmpty()) {
            for (ProgressionChord pc : DomainMapper.toProgression(request.chords(), "chords", false)) {
                chords.add(pc.chord());
                givenVoicings.add(pc.voicing());
            }
            request.chords().forEach(c -> beats.add(c.durationBeats() == null ? defaultBeats : c.durationOrDefault()));
        } else {
            throw FieldValidationException.single("chords", "give at least one chord (chords or symbols)");
        }

        List<ChordView> views = givenVoicings.size() == chords.size() && givenVoicings.stream().allMatch(java.util.Objects::nonNull)
                ? java.util.stream.IntStream.range(0, chords.size())
                    .mapToObj(i -> DomainMapper.toView(chords.get(i), givenVoicings.get(i), beats.get(i))).toList()
                : voiced(chords, beats, register);
        List<ImprovisationChordView> result = new ArrayList<>();
        for (int i = 0; i < chords.size(); i++) {
            Chord chord = chords.get(i);
            List<GuideNoteView> guide = ImprovisationGuide.forChord(key, chord).stream()
                    .map(n -> new GuideNoteView(n.pitchClass(), n.name().toString(), n.role().name(), n.reason()))
                    .toList();
            result.add(new ImprovisationChordView(views.get(i), guide));
        }
        return new ImprovisationResponse(key.toString(), result, GUIDE_LEGEND);
    }

    /** Smooth voicings for a chord list (inversions allowed), as views carrying their beat counts. */
    private static List<ChordView> voiced(List<Chord> chords, List<Integer> beats, Register register) {
        OptimizedProgression optimized = ProgressionVoicer.optimize(chords, register, true, null);
        List<ChordView> views = new ArrayList<>();
        for (int i = 0; i < chords.size(); i++) {
            views.add(DomainMapper.toView(optimized.chords().get(i), optimized.voicings().get(i), beats.get(i)));
        }
        return views;
    }

    // ---- domain → view conversions -------------------------------------------------------------------

    static InterpretationView toView(ChordInterpretation i) {
        return new InterpretationView(i.label(), i.category().name(), i.function() == null ? null : i.function().name(),
                i.functionConfident(), i.notesOutsideScale().stream().map(NoteName::toString).toList(), i.explanation());
    }

    /** @param fromChord/toChord used to spell note names; either may be null (default spelling) */
    static VoiceLeadingView toView(VoiceLeadingResult r, Chord fromChord, Chord toChord) {
        List<MotionView> motions = r.motions().stream()
                .map(m -> new MotionView(m.from(), m.to(), m.semitones(),
                        VoiceLeadingExplainer.spell(m.from(), fromChord), VoiceLeadingExplainer.spell(m.to(), toChord)))
                .toList();
        return new VoiceLeadingView(r.totalMovement(), r.heldVoices(), r.stepwiseVoices(), r.leaps(), r.largestMove(),
                r.crossings(), r.overlaps(), r.parallelPerfects(), r.cost(), motions);
    }

    static MetricsView toView(ProgressionMetrics m) {
        return new MetricsView(m.chordCount(), m.diatonicCount(), m.distinctChords(), m.totalVoiceMovement(),
                m.averageMovementPerTransition(), m.heldVoices(), m.stepwiseMotions(), m.totalMotions(),
                m.parallelPerfects(), m.commonToneTotal(), m.startsOnTonic(), m.endsOnTonic(), m.cadence());
    }

    static AnalysisResponse toView(ProgressionAnalysis a) {
        List<ChordAnalysisView> chords = new ArrayList<>();
        for (int i = 0; i < a.chords().size(); i++) {
            ChordInterpretation c = a.chords().get(i);
            chords.add(new ChordAnalysisView(i, c.chord().symbol(), c.label(), c.category().name(),
                    c.function() == null ? null : c.function().name(), c.functionConfident(),
                    c.notesOutsideScale().stream().map(NoteName::toString).toList(), c.explanation()));
        }
        List<TransitionView> transitions = new ArrayList<>();
        for (TransitionAnalysis t : a.transitions()) {
            transitions.add(new TransitionView(t.fromIndex(), t.toIndex(), t.rootMotion(), t.commonTones(),
                    t.functionalLabel(), t.voiceLeading() == null ? null
                    : toView(t.voiceLeading(), a.chords().get(t.fromIndex()).chord(), a.chords().get(t.toIndex()).chord())));
        }
        List<ObservationView> observations = a.observations().stream()
                .map(o -> new ObservationView(o.kind().name(), o.severity().name(), o.message())).toList();
        return new AnalysisResponse(a.key().toString(), chords, transitions, observations, toView(a.metrics()), a.summary());
    }
}
