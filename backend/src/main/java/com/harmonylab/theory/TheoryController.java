package com.harmonylab.theory;

import com.harmonylab.theory.TheoryDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Stateless music-theory endpoints backed by the deterministic engine in {@code com.harmonylab.music}. */
@RestController
@RequestMapping("/api/theory")
@Tag(name = "Theory", description = "Chord construction, analysis, voice leading and suggestions")
public class TheoryController {

    private final TheoryService service;

    public TheoryController(TheoryService service) {
        this.service = service;
    }

    @GetMapping("/catalog")
    @Operation(summary = "Supported chord qualities, roots, keys, objectives and voicing styles")
    public CatalogResponse catalog() {
        return service.catalog();
    }

    @PostMapping("/chords/resolve")
    @Operation(summary = "Build a chord from root, quality and inversion, with a voicing and its inversions")
    public ChordDetailsResponse resolve(@Valid @RequestBody ChordResolveRequest request) {
        return service.resolve(request);
    }

    @PostMapping("/chords/parse")
    @Operation(summary = "Parse a chord symbol such as F#m7b5 or C/E")
    public ChordDetailsResponse parse(@Valid @RequestBody ChordParseRequest request) {
        return service.parse(request);
    }

    @PostMapping("/chords/identify")
    @Operation(summary = "Identify possible chords from MIDI notes (all exact interpretations, ranked)")
    public IdentifyResponse identify(@Valid @RequestBody IdentifyRequest request) {
        return service.identify(request);
    }

    @GetMapping("/keys")
    @Operation(summary = "Scale, key signature and diatonic chords of a key")
    public KeyView key(@RequestParam String tonic, @RequestParam String mode) {
        return service.key(tonic, mode);
    }

    @PostMapping("/analyze")
    @Operation(summary = "Roman numeral, diatonic and voice-leading analysis of a progression")
    public AnalysisResponse analyze(@Valid @RequestBody ProgressionRequest request) {
        return service.analyze(request);
    }

    @PostMapping("/voice-leading")
    @Operation(summary = "Rank voicings of a target chord by voice-leading cost from a given voicing")
    public VoiceLeadingResponse voiceLeading(@Valid @RequestBody VoiceLeadingRequest request) {
        return service.voiceLeading(request);
    }

    @PostMapping("/voice-leading/optimize")
    @Operation(summary = "Re-voice a whole progression with minimum total voice-leading cost (dynamic programming)")
    public OptimizeResponse optimize(@Valid @RequestBody OptimizeRequest request) {
        return service.optimize(request);
    }

    @PostMapping("/suggestions")
    @Operation(summary = "Ranked, explained alternatives for the selected chord")
    public SuggestionResponse suggestions(@Valid @RequestBody SuggestionRequest request) {
        return service.suggest(request);
    }

    @PostMapping("/alternatives")
    @Operation(summary = "Whole-progression alternatives with comparison metrics")
    public AlternativesResponse alternatives(@Valid @RequestBody ProgressionRequest request) {
        return service.alternatives(request);
    }
}
