package com.harmonylab.theory;

import com.harmonylab.api.dto.ChordInput;
import com.harmonylab.api.dto.ChordView;
import com.harmonylab.api.dto.KeyDto;
import com.harmonylab.api.dto.RegisterDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

/** Request and response records for the theory endpoints, grouped to keep the package small. */
public final class TheoryDtos {

    private TheoryDtos() {
    }

    // ---- catalog -------------------------------------------------------------------------------------

    public record QualityInfo(String id, String name, String suffix, String family, List<String> intervals, int size) {
    }

    public record ObjectiveInfo(String id, String label, String description) {
    }

    public record CatalogResponse(List<QualityInfo> qualities, List<String> roots, Map<String, List<String>> keyTonics,
                                  List<ObjectiveInfo> objectives, List<String> voicingStyles, RegisterDto defaultRegister,
                                  String pitchConvention) {
    }

    // ---- chords --------------------------------------------------------------------------------------

    /**
     * @param style           voicing template; when null and {@code previousVoicing} is given, the voicing is
     *                        chosen for the smoothest connection from it (keeping the requested inversion)
     */
    public record ChordResolveRequest(
            @NotBlank(message = "is required") @Size(max = 3) String root,
            @NotBlank(message = "is required") String quality,
            @Min(value = 0, message = "must be between 0 and 5") @Max(value = 5, message = "must be between 0 and 5") Integer inversion,
            String style,
            @Valid RegisterDto register,
            @Size(min = 1, max = 8, message = "must contain between 1 and 8 notes") List<Integer> previousVoicing,
            @Valid KeyDto key) {
    }

    public record ChordParseRequest(
            @NotBlank(message = "is required") @Size(max = 24, message = "is too long") String symbol,
            String style,
            @Valid RegisterDto register,
            @Size(min = 1, max = 8, message = "must contain between 1 and 8 notes") List<Integer> previousVoicing,
            @Valid KeyDto key) {
    }

    public record InterpretationView(String label, String category, String function, boolean functionConfident,
                                     List<String> notesOutsideScale, String explanation) {
    }

    public record ChordDetailsResponse(ChordView chord, List<ChordView> inversions, InterpretationView relation) {
    }

    public record IdentifyRequest(
            @NotEmpty(message = "select at least one note") @Size(max = 8, message = "at most 8 notes")
            List<@NotNull @Min(0) @Max(127) Integer> midiNotes,
            @Valid KeyDto key) {
    }

    public record IdentifiedChord(ChordView chord, boolean rootPosition, String explanation) {
    }

    public record IdentifyResponse(List<IdentifiedChord> candidates, String message) {
    }

    // ---- keys ----------------------------------------------------------------------------------------

    public record TransposeRequest(
            @NotNull(message = "is required") @Valid KeyDto key,
            @NotEmpty(message = "must contain at least one chord") @Size(max = 64, message = "must contain at most 64 chords")
            List<@Valid ChordInput> chords,
            @NotNull(message = "is required") @Min(value = -11, message = "must be between -11 and 11")
            @Max(value = 11, message = "must be between -11 and 11") Integer semitones) {
    }

    public record TransposeResponse(KeyDto key, String keyLabel, List<ChordView> chords) {
    }

    public record KeyDetectionRequest(
            @NotEmpty(message = "must contain at least one chord") @Size(max = 64, message = "must contain at most 64 chords")
            List<@Valid ChordInput> chords) {
    }

    public record KeyCandidateView(KeyDto key, String label, double correlation) {
    }

    /** @param confidence STRONG, MODERATE or WEAK */
    public record KeyDetectionResponse(List<KeyCandidateView> candidates, String confidence, String explanation) {
    }

    public record DiatonicChordView(int degree, String roman, String function, ChordView chord) {
    }

    public record KeyView(String tonic, String mode, String label, List<String> scale, int signature,
                          String signatureText, List<DiatonicChordView> triads, List<DiatonicChordView> sevenths) {
    }

    // ---- progression analysis ------------------------------------------------------------------------

    public record ProgressionRequest(
            @NotNull(message = "is required") @Valid KeyDto key,
            @NotEmpty(message = "must contain at least one chord") @Size(max = 64, message = "must contain at most 64 chords")
            List<@Valid ChordInput> chords,
            @Valid RegisterDto register) {
    }

    public record MotionView(int from, int to, int semitones, String fromNote, String toNote) {
    }

    public record VoiceLeadingView(int totalMovement, int heldVoices, int stepwiseVoices, int leaps, int largestMove,
                                   int crossings, int overlaps, int parallelPerfects, double cost, List<MotionView> motions) {
    }

    public record ChordAnalysisView(int index, String symbol, String label, String category, String function,
                                    boolean functionConfident, List<String> notesOutsideScale, String explanation) {
    }

    public record TransitionView(int fromIndex, int toIndex, String rootMotion, List<String> commonTones,
                                 String functionalLabel, VoiceLeadingView voiceLeading) {
    }

    public record ObservationView(String kind, String severity, String message) {
    }

    public record MetricsView(int chordCount, int diatonicCount, int distinctChords, int totalVoiceMovement,
                              double averageMovementPerTransition, int heldVoices, int stepwiseMotions, int totalMotions,
                              int parallelPerfects, int commonToneTotal, boolean startsOnTonic, boolean endsOnTonic,
                              String cadence) {
    }

    public record AnalysisResponse(String key, List<ChordAnalysisView> chords, List<TransitionView> transitions,
                                   List<ObservationView> observations, MetricsView metrics, String summary) {
    }

    // ---- voice leading -------------------------------------------------------------------------------

    /** @param fromChord optional; only used to spell the starting notes (e.g. G#4 rather than Ab4) */
    public record VoiceLeadingRequest(
            @NotNull(message = "is required") @Size(min = 1, max = 8, message = "must contain between 1 and 8 notes") List<Integer> fromVoicing,
            @Valid ChordInput fromChord,
            @NotNull(message = "is required") @Valid ChordInput target,
            @Valid RegisterDto register,
            Boolean allowInversions,
            @Min(value = 1, message = "must be between 1 and 20") @Max(value = 20, message = "must be between 1 and 20") Integer limit,
            Boolean fourVoices) {
    }

    public record RankedVoicingView(int rank, ChordView chord, VoiceLeadingView voiceLeading, List<String> reasons) {
    }

    public record VoiceLeadingResponse(List<RankedVoicingView> candidates, String costFunction) {
    }

    public record OptimizeRequest(
            @NotEmpty(message = "must contain at least one chord") @Size(max = 64, message = "must contain at most 64 chords")
            List<@Valid ChordInput> chords,
            @Valid RegisterDto register,
            Boolean allowInversions,
            Boolean keepFirstVoicing,
            Boolean fourVoices) {
    }

    public record OptimizeResponse(List<ChordView> chords, int totalMovement, double totalCost) {
    }

    // ---- suggestions ---------------------------------------------------------------------------------

    public record SuggestionRequest(
            @NotNull(message = "is required") @Valid KeyDto key,
            @NotEmpty(message = "must contain at least one chord") @Size(max = 64, message = "must contain at most 64 chords")
            List<@Valid ChordInput> chords,
            @NotNull(message = "is required") @Min(value = 0, message = "must not be negative") Integer selectedIndex,
            String objective,
            @Valid RegisterDto register,
            @Min(value = 1, message = "must be between 1 and 20") @Max(value = 20, message = "must be between 1 and 20") Integer limit) {
    }

    public record SuggestionView(ChordView chord, String romanLabel, String category, String source, int score,
                                 Map<String, Integer> breakdown, List<String> reasons) {
    }

    public record SuggestionResponse(String objective, String objectiveLabel, String message, List<SuggestionView> suggestions) {
    }

    public record AlternativeView(String title, String objective, String description, Integer changedIndex,
                                  List<ChordView> chords, MetricsView metrics) {
    }

    public record AlternativesResponse(MetricsView current, List<AlternativeView> alternatives) {
    }

    // ---- improvisation -------------------------------------------------------------------------------

    public record PresetView(String id, String name, String description, String mode, List<ChordView> chords) {
    }

    /** Either {@code chords} (structured) or {@code symbols} (e.g. ["Am", "F", "C", "G"]) must be given. */
    public record ImprovisationRequest(
            @NotNull(message = "is required") @Valid KeyDto key,
            @Size(max = 64, message = "must contain at most 64 chords") List<@Valid ChordInput> chords,
            @Size(max = 64, message = "must contain at most 64 chords") List<String> symbols,
            @Valid RegisterDto register,
            @Min(value = 1, message = "must be between 1 and 16") @Max(value = 16, message = "must be between 1 and 16") Integer beatsPerChord) {
    }

    public record GuideNoteView(int pitchClass, String note, String role, String reason) {
    }

    public record ImprovisationChordView(ChordView chord, List<GuideNoteView> guide) {
    }

    public record ImprovisationResponse(String key, List<ImprovisationChordView> chords, String legend) {
    }
}
